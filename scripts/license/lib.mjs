/**
 * GVS license key format (shared by the issuer scripts).
 * The API verifies the same format in apps/api/src/lib/license/license.ts.
 *
 *   GVS1.<base64url(JSON payload)>.<base64url(Ed25519 signature of "GVS1.<payload>")>
 *
 * Payload: { v: 1, id, client, maxUsers, issuedAt, expiresAt|null, machineId|null }
 * Dates are ISO strings. machineId is the PC ID shown on the License page
 * (XXXX-XXXX-XXXX-XXXX) or null for a key that works on any PC.
 */
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const PREFIX = 'GVS1';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function encodeLicense(payload, privateKeyPem) {
  const body = `${PREFIX}.${b64url(JSON.stringify(payload))}`;
  const sig = sign(null, Buffer.from(body), createPrivateKey(privateKeyPem));
  return `${body}.${b64url(sig)}`;
}

/** Returns { payload, signatureOk } or throws on a malformed key. */
export function decodeLicense(key, publicKeyPem) {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error('Not a GVS license key');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const signatureOk = publicKeyPem
    ? verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey(publicKeyPem), Buffer.from(parts[2], 'base64url'))
    : null;
  return { payload, signatureOk };
}

/** Minimal --flag value parser. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

export function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}
