#!/usr/bin/env node
// Parse legacy MariaDB items dump and emit a Postgres staging SQL file.
// Reads: docs/dataFromotherSys/items (3).sql
// Writes: scripts/generated/legacy-items-staging.sql

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const SRC = resolve(REPO, 'docs/dataFromotherSys/items (3).sql');
const OUT = resolve(REPO, 'scripts/generated/legacy-items-staging.sql');
const TENANT_ID = 'ed54a978-0a3d-4f9c-a474-3c930a95d230';
const CURRENCY = 'SDG';

const raw = readFileSync(SRC, 'utf8');

// The dump contains multiple `INSERT INTO \`items\` ... VALUES ... ;` blocks.
// We iterate through all of them and parse tuples from each.
const startMarker = 'INSERT INTO `items`';
const rows = [];
let searchFrom = 0;
let blockCount = 0;
while (true) {
    const startIdx = raw.indexOf(startMarker, searchFrom);
    if (startIdx < 0) break;
    const valuesIdx = raw.indexOf('VALUES', startIdx);
    if (valuesIdx < 0) throw new Error(`VALUES keyword not found after INSERT at ${startIdx}`);
    const afterValues = raw.indexOf('\n', valuesIdx) + 1;
    const body = raw; // we parse in-place; `i` holds absolute offset

    // Tokenize top-level tuples: (...), (...), ...;
    let i = afterValues;
    const n = body.length;
    while (i < n) {
        while (i < n && /[\s,]/.test(body[i])) i++;
        if (i >= n) break;
        if (body[i] === ';') { i++; break; }
        if (body[i] !== '(') {
            throw new Error(`Unexpected char at offset ${i}: ${body[i]} (context: ${body.slice(Math.max(0, i - 20), i + 20)})`);
        }
        i++; // consume (
        const fields = [];
        let cur = '';
        let inString = false;
        while (i < n) {
            const c = body[i];
            if (inString) {
                if (c === '\\' && i + 1 < n) {
                    const nx = body[i + 1];
                    if (nx === 'n') cur += '\n';
                    else if (nx === 't') cur += '\t';
                    else if (nx === 'r') cur += '\r';
                    else if (nx === '0') cur += '\x00';
                    else cur += nx;
                    i += 2;
                    continue;
                }
                if (c === "'") {
                    if (i + 1 < n && body[i + 1] === "'") {
                        cur += "'";
                        i += 2;
                        continue;
                    }
                    inString = false;
                    i++;
                    continue;
                }
                cur += c;
                i++;
                continue;
            }
            if (c === "'") {
                inString = true;
                i++;
                continue;
            }
            if (c === ',' || c === ')') {
                fields.push(cur.trim());
                cur = '';
                if (c === ')') { i++; break; }
                i++;
                continue;
            }
            cur += c;
            i++;
        }
        rows.push(fields);
    }
    searchFrom = i;
    blockCount++;
}

console.error(`Parsed ${rows.length} tuples from ${blockCount} INSERT blocks.`);

// Expected column order from the dump:
// (id, item_name, model, part_no, brand, min_qty, item_unit, pay_price, perch_price, item_desc, item_parcode, aliasEn, category_id, retail_price)
const COL = {
    id: 0,
    item_name: 1,
    model: 2,
    part_no: 3,
    brand: 4,
    min_qty: 5,
    item_unit: 6,
    pay_price: 7,
    perch_price: 8,
    item_desc: 9,
    item_parcode: 10,
    aliasEn: 11,
    category_id: 12,
    retail_price: 13,
};

// Helpers -----------------------------------------------------------
const parseLiteral = (raw) => {
    // The tokenizer strips surrounding quotes for strings, so a string field
    // arrives as its content (quote-stripped). NULL arrives as the literal
    // token "NULL". Numeric literals arrive as digits.
    if (raw === 'NULL') return null;
    return raw;
};
const trimOrNull = (s) => {
    if (s === null || s === undefined) return null;
    const t = String(s).trim();
    return t === '' ? null : t;
};
const normalizeUnit = (u) => {
    const t = trimOrNull(u);
    if (!t) return 'piece';
    const up = t.toUpperCase();
    if (up === 'SET') return 'set';
    if (up === 'PCS') return 'piece';
    return 'piece';
};
const sanitizeBarcode = (b) => {
    const t = trimOrNull(b);
    if (!t) return null;
    if (t === 'barcode1') return null;
    return t;
};
const parseNumeric = (s) => {
    if (s === null || s === undefined) return null;
    if (s === 'NULL') return null;
    const n = Number(s);
    if (Number.isNaN(n)) return null;
    return n;
};
const escapeSqlString = (s) => {
    if (s === null || s === undefined) return 'NULL';
    return `'${String(s).replace(/'/g, "''")}'`;
};

// Transform rows + dedupe SKUs --------------------------------------
const seenSku = new Map(); // sku -> legacy_id that first claimed it
const dupSkus = [];
const nameCollisions = new Map(); // name -> count (for diagnostics only; not blocking)
const transformed = [];

for (const r of rows) {
    const legacyId = parseLiteral(r[COL.id]);
    const name = trimOrNull(parseLiteral(r[COL.item_name]));
    if (!name) {
        console.error(`  skip legacy_id=${legacyId}: empty item_name`);
        continue;
    }
    const nameAlias = trimOrNull(parseLiteral(r[COL.aliasEn]));
    let sku = trimOrNull(parseLiteral(r[COL.part_no]));
    if (sku) {
        if (seenSku.has(sku)) {
            dupSkus.push({ sku, firstId: seenSku.get(sku), dupId: legacyId });
            sku = null; // keep only the first
        } else {
            seenSku.set(sku, legacyId);
        }
    }
    const barcode = sanitizeBarcode(parseLiteral(r[COL.item_parcode]));
    const brand = trimOrNull(parseLiteral(r[COL.brand]));
    const unit = normalizeUnit(parseLiteral(r[COL.item_unit]));
    const payPrice = parseNumeric(parseLiteral(r[COL.pay_price]));
    const perchPrice = parseNumeric(parseLiteral(r[COL.perch_price]));

    nameCollisions.set(name, (nameCollisions.get(name) || 0) + 1);

    transformed.push({
        newId: randomUUID(),
        legacyId,
        name,
        nameAlias,
        sku,
        barcode,
        brand,
        unit,
        payPrice,
        perchPrice,
    });
}

console.error(`Transformed ${transformed.length} rows.`);
if (dupSkus.length) {
    console.error(`Dedup: ${dupSkus.length} duplicate SKU values nulled (kept first occurrence):`);
    for (const d of dupSkus.slice(0, 20)) console.error(`   ${d.sku}: kept id=${d.firstId}, nulled id=${d.dupId}`);
    if (dupSkus.length > 20) console.error(`   ... and ${dupSkus.length - 20} more`);
}
const collisions = [...nameCollisions.entries()].filter(([, c]) => c > 1);
if (collisions.length) {
    console.error(`Info: ${collisions.length} item names appear more than once (NOT blocking — names aren't unique):`);
    for (const [nm, c] of collisions.slice(0, 10)) console.error(`   ${c}x: ${nm}`);
}

// Also check barcode uniqueness (enforced by DB)
const seenBc = new Map();
const dupBc = [];
for (const t of transformed) {
    if (!t.barcode) continue;
    if (seenBc.has(t.barcode)) {
        dupBc.push({ barcode: t.barcode, firstId: seenBc.get(t.barcode), dupId: t.legacyId });
        t.barcode = null;
    } else {
        seenBc.set(t.barcode, t.legacyId);
    }
}
if (dupBc.length) {
    console.error(`Dedup: ${dupBc.length} duplicate barcodes nulled (kept first):`);
    for (const d of dupBc.slice(0, 10)) console.error(`   ${d.barcode}: kept id=${d.firstId}, nulled id=${d.dupId}`);
    if (dupBc.length > 10) console.error(`   ... and ${dupBc.length - 10} more`);
}

// Emit SQL in batch files ------------------------------------------
// Each batch is a self-contained transaction inserting items + prices directly
// (no temp table — UUIDs are client-generated so item_prices rows reference them).
const BATCH = 75;
mkdirSync(dirname(OUT), { recursive: true });
// Clean old batch files (synchronously, before we write new ones)
try {
    for (const f of readdirSync(dirname(OUT))) {
        if (f.startsWith('legacy-items-batch-') || f === 'legacy-items-staging.sql') {
            unlinkSync(resolve(dirname(OUT), f));
        }
    }
} catch { /* ignore */ }

let batchNum = 0;
const batchFiles = [];
for (let b = 0; b < transformed.length; b += BATCH) {
    batchNum++;
    const chunk = transformed.slice(b, b + BATCH);
    const lines = [];
    lines.push(`-- Batch ${batchNum}: rows ${b + 1}..${b + chunk.length} of ${transformed.length}`);
    lines.push(`-- Target tenant: GVS (${TENANT_ID})`);
    lines.push(`-- Currency: ${CURRENCY}`);
    lines.push(`BEGIN;`);
    lines.push(``);
    // Insert into items
    lines.push(`INSERT INTO items (id, tenant_id, name, name_alias, sku, barcode, brand, unit_of_measure) VALUES`);
    const itemTuples = chunk.map((t, idx) => {
        const comma = idx === chunk.length - 1 ? ';' : ',';
        return `  ('${t.newId}', '${TENANT_ID}', ${escapeSqlString(t.name)}, ${escapeSqlString(t.nameAlias)}, ${escapeSqlString(t.sku)}, ${escapeSqlString(t.barcode)}, ${escapeSqlString(t.brand)}, ${escapeSqlString(t.unit)})${comma}`;
    });
    lines.push(...itemTuples);
    lines.push(``);
    // Insert retail prices
    const retailRows = chunk.filter(t => t.payPrice !== null);
    if (retailRows.length) {
        lines.push(`INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency) VALUES`);
        const retailTuples = retailRows.map((t, idx) => {
            const comma = idx === retailRows.length - 1 ? ';' : ',';
            return `  ('${t.newId}', '${TENANT_ID}', 'retail', ${t.payPrice.toFixed(2)}, '${CURRENCY}')${comma}`;
        });
        lines.push(...retailTuples);
        lines.push(``);
    }
    // Insert cost prices
    const costRows = chunk.filter(t => t.perchPrice !== null);
    if (costRows.length) {
        lines.push(`INSERT INTO item_prices (item_id, tenant_id, price_tier, price, currency) VALUES`);
        const costTuples = costRows.map((t, idx) => {
            const comma = idx === costRows.length - 1 ? ';' : ',';
            return `  ('${t.newId}', '${TENANT_ID}', 'cost', ${t.perchPrice.toFixed(2)}, '${CURRENCY}')${comma}`;
        });
        lines.push(...costTuples);
        lines.push(``);
    }
    lines.push(`COMMIT;`);
    lines.push(``);
    const batchPath = resolve(dirname(OUT), `legacy-items-batch-${String(batchNum).padStart(2, '0')}.sql`);
    writeFileSync(batchPath, lines.join('\n'), 'utf8');
    batchFiles.push(batchPath);
}
console.error(`Wrote ${batchFiles.length} batch file(s) to ${dirname(OUT)} (${BATCH} items per batch).`);
console.error(`Total: ${transformed.length} items, ${transformed.filter(t => t.payPrice !== null).length} retail prices, ${transformed.filter(t => t.perchPrice !== null).length} cost prices.`);
