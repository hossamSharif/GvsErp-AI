#!/usr/bin/env node
// Seed the Alosra tenant with the pharmacy master list, through the real API
// so the result is identical to the user entering everything via the UI.
//
// Reads:  docs/pharmacy_inventory_master.json
// Writes: scripts/generated/pharmacy-import-map.json  (jsonId -> itemId, resumable)
//
// Usage:  node scripts/import-pharmacy-items.mjs <command>
//   settings   enable accounting + COGS + SDG default currency
//   items      create the items with cost/retail prices and expiry dates
//   opening    post opening stock into the pharmacy warehouse
//   verify     read everything back through the API
//   all        settings -> items -> opening -> verify

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const SRC = resolve(REPO, 'docs/pharmacy_inventory_master.json');
const MAP = resolve(REPO, 'scripts/generated/pharmacy-import-map.json');

const TENANT_ID = '0af3973f-5f13-4dc2-b5be-f4710a4ed33b'; // Alosra
const WAREHOUSE_ID = '2ad066fd-c0f1-4ead-995d-e3ea93a49385'; // صيدلية الأسرة
const EMAIL = 'alosra@gmail.com';
const PASSWORD = 'Alosra2000';
const CURRENCY = 'SDG';
const AS_OF_DATE = '2026-08-01';
const API = process.env.API_URL || 'http://localhost:3001/api/v1';

const CONCURRENCY = 4;
const OPENING_CHUNK = 50;
// The API enforces 100 requests/minute per client (apps/api/src/middleware/rate-limit.ts).
// Pace below that rather than hammering it — 429s are a real guardrail, not noise.
const MAX_REQUESTS_PER_MIN = 80;

// --- env ------------------------------------------------------------------
const env = {};
for (const line of readFileSync(resolve(REPO, 'apps/api/.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SUPABASE_URL = env.SUPABASE_URL;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

// --- helpers --------------------------------------------------------------
const log = (...a) => console.error(...a);

async function login() {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    const meta = body.user?.user_metadata ?? {};
    if (meta.tenant_id !== TENANT_ID) {
        throw new Error(`logged-in tenant ${meta.tenant_id} != expected ${TENANT_ID}`);
    }
    log(`Signed in as ${EMAIL} (tenant ${meta.tenant_id})`);
    return body.access_token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Simple token-bucket pacer shared by every request, so concurrent workers
// collectively stay under the API's per-minute limit.
let nextSlot = 0;
async function throttle() {
    const gap = 60_000 / MAX_REQUESTS_PER_MIN;
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + gap;
    if (slot > now) await sleep(slot - now);
}

async function api(token, method, path, body) {
    await throttle();
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { ok: res.ok, status: res.status, body: json };
}

// service-role PostgREST, read-only checks that bypass RLS
async function db(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            Prefer: 'count=exact',
        },
    });
    const range = res.headers.get('content-range');
    const data = await res.json();
    return { data, count: range ? Number(range.split('/')[1]) : null };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** "01/02/2028" -> "2028-02-01"; "" -> null */
function toIsoDate(s) {
    const t = String(s ?? '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) throw new Error(`unparseable expiry date: ${JSON.stringify(s)}`);
    const [, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${mm}-${dd}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(dd)) {
        throw new Error(`invalid expiry date: ${t}`);
    }
    return iso;
}

const trimOrNull = (s) => {
    const t = String(s ?? '').trim();
    return t === '' ? null : t;
};

function loadRecords() {
    const raw = JSON.parse(readFileSync(SRC, 'utf8'));
    return raw.map((r) => {
        const name = trimOrNull(r.name);
        if (!name) throw new Error(`record ${r.id} has no name`);
        const expiryDate = toIsoDate(r.expiry_date);
        return {
            jsonId: r.id,
            name,
            nameAlias: trimOrNull(r.alternative_name),
            unitOfMeasure: trimOrNull(r.unit) || 'piece',
            barcode: trimOrNull(r.barcode), // all empty in this file -> null
            tracksExpiry: expiryDate !== null,
            expiryDate,
            costPrice: round2(Number(r.cost_price)),
            retailPrice: round2(Number(r.retail_price)),
            quantity: Number(r.quantity),
        };
    });
}

function loadMap() {
    if (!existsSync(MAP)) return {};
    return JSON.parse(readFileSync(MAP, 'utf8'));
}
function saveMap(map) {
    mkdirSync(dirname(MAP), { recursive: true });
    writeFileSync(MAP, JSON.stringify(map, null, 2), 'utf8');
}

// --- commands -------------------------------------------------------------

async function cmdSettings(token) {
    log('\n=== Step 1: tenant settings ===');

    let r = await api(token, 'POST', '/settings/modules/accounting/enable');
    log(`  accounting enable      -> ${r.status}`);
    if (!r.ok) throw new Error(JSON.stringify(r.body));

    r = await api(token, 'PUT', '/accounting/cogs', { enabled: true });
    log(`  cogs enable            -> ${r.status}`);
    if (!r.ok) throw new Error(JSON.stringify(r.body));

    r = await api(token, 'PUT', '/settings', { default_currency: CURRENCY });
    log(`  default_currency=SDG   -> ${r.status}`);
    if (!r.ok) throw new Error(JSON.stringify(r.body));

    const { data } = await db(`tenants?select=settings&id=eq.${TENANT_ID}`);
    log('  tenants.settings now:', JSON.stringify(data[0].settings));
}

async function cmdItems(token) {
    log('\n=== Step 2: items ===');
    const records = loadRecords();
    const map = loadMap();
    const todo = records.filter((r) => !map[r.jsonId]);
    log(`  ${records.length} records, ${Object.keys(map).length} already imported, ${todo.length} to create`);
    if (todo.length === 0) return map;

    let done = 0;
    let failure = null;
    const queue = [...todo];

    const worker = async () => {
        while (queue.length && !failure) {
            const rec = queue.shift();
            const payload = {
                name: rec.name,
                nameAlias: rec.nameAlias,
                sku: null,
                barcode: rec.barcode,
                unitOfMeasure: rec.unitOfMeasure,
                taxRate: 0,
                isActive: true,
                tracksExpiry: rec.tracksExpiry,
                expiryDate: rec.expiryDate,
                prices: [
                    { priceTier: 'cost', price: rec.costPrice, currency: CURRENCY },
                    { priceTier: 'retail', price: rec.retailPrice, currency: CURRENCY },
                ],
            };

            let res;
            for (let attempt = 1; attempt <= 5; attempt++) {
                res = await api(token, 'POST', '/items', payload);
                if (res.ok) break;
                if (res.status === 429) {
                    // "Rate limit exceeded. Try again in N seconds."
                    const secs = Number(String(res.body?.message ?? '').match(/in (\d+) second/)?.[1] ?? 10);
                    log(`  rate limited — waiting ${secs + 1}s`);
                    await sleep((secs + 1) * 1000);
                    continue;
                }
                if (res.status < 500) break;
                await sleep(500 * attempt);
            }

            if (!res.ok) {
                failure = `item ${rec.jsonId} "${rec.name}": ${res.status} ${JSON.stringify(res.body)}`;
                return;
            }
            const itemId = res.body?.data?.id;
            if (!itemId) {
                failure = `item ${rec.jsonId} "${rec.name}": no id in response ${JSON.stringify(res.body)}`;
                return;
            }
            map[rec.jsonId] = { itemId, name: rec.name };
            done++;
            if (done % 25 === 0) {
                saveMap(map);
                log(`  ${done}/${todo.length} created`);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    saveMap(map);
    log(`  ${done}/${todo.length} created (map saved to ${MAP})`);
    if (failure) throw new Error(`STOPPED: ${failure}`);
    return map;
}

async function cmdOpening(token) {
    log('\n=== Step 3: opening stock ===');
    const records = loadRecords();
    const map = loadMap();

    const rows = [];
    for (const rec of records) {
        if (rec.quantity <= 0) continue;
        const mapped = map[rec.jsonId];
        if (!mapped) throw new Error(`record ${rec.jsonId} "${rec.name}" has no imported item id — run "items" first`);
        rows.push({ itemId: mapped.itemId, quantity: rec.quantity, unitCost: rec.costPrice });
    }
    log(`  ${rows.length} items with quantity > 0, asOfDate=${AS_OF_DATE}`);

    let updated = 0;
    const jeIds = [];
    for (let i = 0; i < rows.length; i += OPENING_CHUNK) {
        const chunk = rows.slice(i, i + OPENING_CHUNK);
        const res = await api(token, 'POST', `/warehouses/${WAREHOUSE_ID}/opening-stock`, {
            asOfDate: AS_OF_DATE,
            items: chunk,
        });
        if (!res.ok) {
            throw new Error(`chunk ${i}..${i + chunk.length}: ${res.status} ${JSON.stringify(res.body)}`);
        }
        updated += res.body?.data?.updated ?? 0;
        if (res.body?.data?.journalEntryId) jeIds.push(res.body.data.journalEntryId);
        log(`  chunk ${i / OPENING_CHUNK + 1}: ${chunk.length} sent, updated=${res.body?.data?.updated}, je=${res.body?.data?.journalEntryId ?? 'none'}`);
    }
    log(`  total updated=${updated}, ${jeIds.length} journal entries posted`);
}

async function cmdVerify(token) {
    log('\n=== Step 4: verification ===');
    const records = loadRecords();
    const expectedItems = records.length;
    const expectedExpiry = records.filter((r) => r.tracksExpiry).length;
    const withStock = records.filter((r) => r.quantity > 0);
    const expectedQty = withStock.reduce((s, r) => s + r.quantity, 0);
    const expectedValue = withStock.reduce((s, r) => s + r.quantity * r.costPrice, 0);

    const check = (label, actual, expected) => {
        const ok = String(actual) === String(expected);
        log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
        return ok;
    };
    let allOk = true;
    const t = (ok) => { allOk = allOk && ok; };

    // --- DB level ---
    log('\n  [database]');
    let r = await db(`items?select=id&tenant_id=eq.${TENANT_ID}&limit=1`);
    t(check('items count', r.count, expectedItems));

    r = await db(`items?select=id&tenant_id=eq.${TENANT_ID}&tracks_expiry=is.true&limit=1`);
    t(check('items with tracks_expiry', r.count, expectedExpiry));

    r = await db(`items?select=id&tenant_id=eq.${TENANT_ID}&barcode=not.is.null&limit=1`);
    t(check('items with a barcode (expect 0)', r.count, 0));

    r = await db(`items?select=id&tenant_id=eq.${TENANT_ID}&is_active=is.true&limit=1`);
    t(check('active items', r.count, expectedItems));

    r = await db(`item_prices?select=id&tenant_id=eq.${TENANT_ID}&limit=1`);
    t(check('item_prices rows', r.count, expectedItems * 2));

    r = await db(`item_prices?select=id&tenant_id=eq.${TENANT_ID}&currency=eq.SDG&limit=1`);
    t(check('item_prices in SDG', r.count, expectedItems * 2));

    r = await db(`item_prices?select=id&tenant_id=eq.${TENANT_ID}&price_tier=eq.cost&limit=1`);
    t(check('cost-tier prices', r.count, expectedItems));
    r = await db(`item_prices?select=id&tenant_id=eq.${TENANT_ID}&price_tier=eq.retail&limit=1`);
    t(check('retail-tier prices', r.count, expectedItems));

    const inv = await db(`inventory?select=item_id,quantity&tenant_id=eq.${TENANT_ID}&warehouse_id=eq.${WAREHOUSE_ID}&limit=1000`);
    t(check('inventory rows', inv.data.length, withStock.length));
    const invQty = inv.data.reduce((s, x) => s + Number(x.quantity), 0);
    t(check('inventory total quantity', invQty, expectedQty));

    const layers = await db(`stock_valuation_layers?select=item_id,qty_in,qty_remaining,unit_cost,layer_date,source_invoice_id&tenant_id=eq.${TENANT_ID}&warehouse_id=eq.${WAREHOUSE_ID}&limit=1000`);
    t(check('valuation layers', layers.data.length, withStock.length));
    t(check('layers flagged as opening (source_invoice_id NULL)', layers.data.filter((l) => l.source_invoice_id === null).length, withStock.length));
    t(check('layers fully unconsumed (qty_remaining = qty_in)', layers.data.filter((l) => Number(l.qty_remaining) === Number(l.qty_in)).length, withStock.length));
    t(check(`layers dated ${AS_OF_DATE}`, layers.data.filter((l) => String(l.layer_date).startsWith(AS_OF_DATE)).length, withStock.length));
    const layerValue = layers.data.reduce((s, l) => s + Number(l.qty_in) * Number(l.unit_cost), 0);
    t(check('opening stock value (SDG)', round2(layerValue), round2(expectedValue)));

    // per-item spot check of quantity + cost
    const layerByItem = new Map(layers.data.map((l) => [l.item_id, l]));
    const invByItem = new Map(inv.data.map((x) => [x.item_id, Number(x.quantity)]));
    const map = loadMap();
    let mismatches = 0;
    for (const rec of withStock) {
        const id = map[rec.jsonId]?.itemId;
        const l = layerByItem.get(id);
        if (!l || Number(l.qty_in) !== rec.quantity || Number(l.unit_cost) !== rec.costPrice) mismatches++;
        else if (invByItem.get(id) !== rec.quantity) mismatches++;
    }
    t(check('per-item qty+cost mismatches', mismatches, 0));

    // accounting
    const jl = await db(`journal_lines?select=debit,credit,account_id,accounts(code,name)&tenant_id=eq.${TENANT_ID}&limit=1000`);
    const byAccount = new Map();
    for (const line of jl.data) {
        const code = line.accounts?.code ?? '?';
        const cur = byAccount.get(code) ?? { name: line.accounts?.name, debit: 0, credit: 0 };
        cur.debit += Number(line.debit);
        cur.credit += Number(line.credit);
        byAccount.set(code, cur);
    }
    log('  [general ledger]');
    let totalDr = 0, totalCr = 0;
    for (const [code, v] of [...byAccount.entries()].sort()) {
        log(`    ${code} ${v.name}: Dr ${v.debit.toLocaleString()} / Cr ${v.credit.toLocaleString()}`);
        totalDr += v.debit; totalCr += v.credit;
    }
    t(check('trial balance (total Dr = total Cr)', round2(totalDr), round2(totalCr)));
    t(check('Dr Inventory (1130)', round2(byAccount.get('1130')?.debit ?? 0), round2(expectedValue)));
    t(check('Cr Opening Balance Equity (3200)', round2(byAccount.get('3200')?.credit ?? 0), round2(expectedValue)));

    // --- API level (what the UI renders) ---
    log('\n  [api — what the UI renders]');
    let res = await api(token, 'GET', '/items?page=1&limit=5&sort_by=name&sort_order=asc');
    t(check('GET /items status', res.status, 200));
    t(check('GET /items total', res.body?.meta?.total ?? res.body?.data?.meta?.total, expectedItems));
    const sample = (res.body?.data ?? [])[0];
    if (sample) {
        log(`    sample item: ${sample.name} | alias=${sample.nameAlias} | uom=${sample.unitOfMeasure} | expiry=${sample.expiryDate}`);
        log(`      prices: ${JSON.stringify(sample.prices)}`);
    }

    res = await api(token, 'GET', `/warehouses/${WAREHOUSE_ID}/opening-stock`);
    t(check('GET /opening-stock status', res.status, 200));
    const osRows = res.body?.data ?? [];
    t(check('opening-stock rows returned', osRows.length, expectedItems));
    t(check('rows with hasOpeningEntry', osRows.filter((x) => x.hasOpeningEntry).length, withStock.length));
    const osQty = osRows.reduce((s, x) => s + Number(x.currentQuantity), 0);
    t(check('opening-stock currentQuantity total', osQty, expectedQty));
    const osSample = osRows.find((x) => x.hasOpeningEntry);
    if (osSample) log(`    sample row: ${osSample.itemName} qty=${osSample.currentQuantity} openingQty=${osSample.openingQuantity} cost=${osSample.openingUnitCost}`);

    // item movement ledger for a couple of items
    const movementTargets = withStock.slice(0, 2).map((r) => ({ rec: r, id: map[r.jsonId]?.itemId }));
    for (const { rec, id } of movementTargets) {
        // dateFrom/dateTo are required by itemMovementParamsSchema
        res = await api(token, 'GET', `/items/${id}/movement?dateFrom=${AS_OF_DATE}&dateTo=2026-12-31&warehouseId=${WAREHOUSE_ID}`);
        const d = res.body?.data;
        const movements = d?.movements ?? [];
        const opening = movements.filter((m) => m.movementType === 'opening');
        log(`    movement "${rec.name}": status=${res.status} movements=${movements.length} opening=${opening.length} reconciles=${d?.closing?.reconciles}`);
        t(check(`  movement reconciles for "${rec.name}"`, d?.closing?.reconciles, true));
    }

    res = await api(token, 'GET', '/items/alerts/expiring?days=3650');
    const expiring = res.body?.data;
    log(`    GET /items/alerts/expiring status=${res.status} count=${Array.isArray(expiring) ? expiring.length : JSON.stringify(expiring).slice(0, 120)}`);

    log(`\n  ${allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED — see FAIL lines above'}`);
    if (!allOk) process.exitCode = 1;
}

// --- main -----------------------------------------------------------------
const cmd = process.argv[2] ?? 'all';
const token = await login();

if (cmd === 'settings') await cmdSettings(token);
else if (cmd === 'items') await cmdItems(token);
else if (cmd === 'opening') await cmdOpening(token);
else if (cmd === 'verify') await cmdVerify(token);
else if (cmd === 'all') {
    await cmdSettings(token);
    await cmdItems(token);
    await cmdOpening(token);
    await cmdVerify(token);
} else {
    log(`unknown command: ${cmd}`);
    process.exit(1);
}
