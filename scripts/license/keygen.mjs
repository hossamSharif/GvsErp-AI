#!/usr/bin/env node
/**
 * Create the license signing key pair. Run ONCE, on your own PC.
 *
 *   node scripts/license/keygen.mjs --out C:\GvsLicense
 *
 * - Writes the PRIVATE key to <out>/gvs-license-private.pem. Keep it safe and
 *   backed up (USB / password manager). Anyone with it can issue licenses; if
 *   you lose it you can't issue keys for existing installs.
 * - Prints the PUBLIC key: paste it into apps/api/src/lib/license/public-key.ts
 *   and set IS_TEST_KEY = false, then commit. Release builds refuse the test key.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, fail } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.out || args.out === true) fail('use --out <folder outside the repository>');

const repoRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const insideRepo = (p) => p === repoRoot || p.startsWith(repoRoot + sep);
const outDir = resolve(String(args.out));
// Check before creating anything, then again after resolving symlinks.
if (insideRepo(outDir)) fail('refusing to write the private key inside the repository — choose a folder outside it');
mkdirSync(outDir, { recursive: true });
const outReal = realpathSync(outDir);
if (insideRepo(outReal)) fail('refusing to write the private key inside the repository — choose a folder outside it');

const file = join(outReal, 'gvs-license-private.pem');
if (existsSync(file) && !args.force) fail(`${file} already exists (use --force to replace it — old keys stop verifying)`);

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });

console.log(`Private key written to: ${file}`);
console.log('KEEP IT SECRET. Back it up. Never commit it.\n');
console.log('Public key (paste into apps/api/src/lib/license/public-key.ts, set IS_TEST_KEY = false):\n');
console.log(publicKey.export({ type: 'spki', format: 'pem' }));
