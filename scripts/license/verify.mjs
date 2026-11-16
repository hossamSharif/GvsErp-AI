#!/usr/bin/env node
/**
 * Inspect a license key (support tool).
 *
 *   node scripts/license/verify.mjs <key> [--pub public.pem]
 *
 * Without --pub it checks the signature against the public key embedded in
 * apps/api/src/lib/license/public-key.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeLicense, parseArgs, fail } from './lib.mjs';

const argv = process.argv.slice(2);
const key = argv.find((a) => a.startsWith('GVS1.'));
if (!key) fail('pass the license key (starts with GVS1.)');
const args = parseArgs(argv);

let pub;
if (args.pub && args.pub !== true) {
  pub = readFileSync(String(args.pub), 'utf8');
} else {
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/api/src/lib/license/public-key.ts'),
    'utf8'
  );
  pub = src.match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/)?.[0];
  if (!pub) fail('could not read the embedded public key');
}

const { payload, signatureOk } = decodeLicense(key, pub);
console.log(JSON.stringify(payload, null, 2));
console.log(`\nSignature: ${signatureOk ? 'VALID' : 'INVALID (wrong key or tampered)'}`);
if (payload.expiresAt) {
  const left = Math.ceil((Date.parse(payload.expiresAt) - Date.now()) / 86_400_000);
  console.log(left > 0 ? `Expires in ${left} day(s)` : 'EXPIRED');
}
process.exit(signatureOk ? 0 : 2);
