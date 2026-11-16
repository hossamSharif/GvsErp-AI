#!/usr/bin/env node
/**
 * Issue a license key for a client.
 *
 *   node scripts/license/issue.mjs --key C:\GvsLicense\gvs-license-private.pem \
 *     --client "Al Noor Pharmacy" --users 5 --days 365 [--machine XXXX-XXXX-XXXX-XXXX]
 *
 *   --days N        valid for N days from today; omit --days for a key that never expires
 *   --machine ID    lock the key to one PC (the PC ID shown on the client's License page);
 *                   omit it for a key that works on any PC
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { encodeLicense, parseArgs, fail } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.key || args.key === true) fail('--key <private.pem> is required');
if (!args.client || args.client === true) fail('--client "<name>" is required');
const users = Number(args.users ?? 5);
if (!Number.isInteger(users) || users < 1) fail('--users must be a whole number ≥ 1');

let expiresAt = null;
if (args.days !== undefined) {
  const days = Number(args.days);
  if (!Number.isFinite(days) || days < 1) fail('--days must be a number ≥ 1');
  expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
}

let machineId = null;
if (args.machine !== undefined) {
  machineId = String(args.machine).trim().toUpperCase();
  if (!/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(machineId)) fail('--machine must look like XXXX-XXXX-XXXX-XXXX');
}

const payload = {
  v: 1,
  id: randomUUID(),
  client: String(args.client),
  maxUsers: users,
  issuedAt: new Date().toISOString(),
  expiresAt,
  machineId,
};

const key = encodeLicense(payload, readFileSync(String(args.key), 'utf8'));
console.error(`Client:   ${payload.client}`);
console.error(`Users:    ${payload.maxUsers}`);
console.error(`Expires:  ${expiresAt ?? 'never'}`);
console.error(`PC:       ${machineId ?? 'any PC'}`);
console.error(`ID:       ${payload.id}\n`);
console.log(key);
