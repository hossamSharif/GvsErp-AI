#!/usr/bin/env node
// Reads each scripts/generated/legacy-items-batch-*.sql file and applies it to
// Supabase by calling the `_import_run_sql` RPC helper (service_role).
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const GEN = resolve(REPO, 'scripts/generated');
const ENV_PATH = resolve(REPO, 'apps/api/.env');

// Parse .env (no dotenv dep)
const env = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
    process.exit(1);
}

const files = readdirSync(GEN)
    .filter((f) => /^legacy-items-batch-\d+\.sql$/.test(f))
    .sort();

if (files.length === 0) {
    console.error('No batch files found under scripts/generated/');
    process.exit(1);
}

console.error(`Applying ${files.length} batch file(s) to ${SUPABASE_URL}`);

let totalOk = 0;
let totalFail = 0;
for (const f of files) {
    const path = resolve(GEN, f);
    const sql = readFileSync(path, 'utf8');
    // Strip BEGIN;/COMMIT; — we run each file via EXECUTE inside a single plpgsql stmt,
    // which already runs in an implicit transaction.
    const cleaned = sql
        .split(/\r?\n/)
        .filter((l) => !/^\s*(BEGIN|COMMIT)\s*;\s*$/i.test(l))
        .join('\n');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/_import_run_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ sql_text: cleaned }),
    });

    if (res.ok) {
        totalOk++;
        console.error(`  ok  ${f}`);
    } else {
        totalFail++;
        const body = await res.text();
        console.error(`  FAIL ${f}: ${res.status} ${body.slice(0, 500)}`);
        break; // halt on first failure
    }
}

console.error(`Done. ${totalOk} ok, ${totalFail} failed.`);
process.exit(totalFail ? 1 : 0);
