#!/usr/bin/env node
/**
 * Generates deploy/local/.env with fresh, per-install secrets.
 *
 * - POSTGRES_PASSWORD, JWT_SECRET: random
 * - ANON_KEY / SERVICE_ROLE_KEY: HS256 JWTs signed with JWT_SECRET
 *   (the same format Supabase uses), valid for 20 years.
 *
 * No dependencies — runs on any Node >= 18:
 *   node deploy/local/scripts/generate-env.mjs            # writes deploy/local/.env
 *   node deploy/local/scripts/generate-env.mjs --force    # overwrite existing .env
 *   node deploy/local/scripts/generate-env.mjs --stdout   # print instead of writing
 *
 * Never run --force on a client PC that already has data: the database
 * password is set only when the database is first created.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// Alphanumeric only, so values are safe inside connection URLs and shells.
const randomToken = (len) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
};

const jwtSecret = randomToken(64);
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 20 * 365 * 24 * 3600;

const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret);
const serviceKey = signJwt({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret);

const content = `# GVS ERP — Local Edition environment.
# Generated ${new Date().toISOString()} by scripts/generate-env.mjs
# KEEP THIS FILE PRIVATE. Do not commit it. Do not regenerate on a PC that has data.

# Version of the GVS images to run (gvs-api, gvs-web, gvs-migrate)
GVS_VERSION=dev

# The only port exposed on the PC (bound to 127.0.0.1). Open http://localhost:<port>
GVS_PORT=8080

POSTGRES_PASSWORD=${randomToken(40)}
JWT_SECRET=${jwtSecret}
JWT_EXPIRY=3600
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
`;

if (args.has('--stdout')) {
  process.stdout.write(content);
} else {
  if (existsSync(envPath) && !args.has('--force')) {
    console.error(`Refusing to overwrite ${envPath} (use --force on a fresh install only).`);
    process.exit(1);
  }
  writeFileSync(envPath, content, { mode: 0o600 });
  console.log(`Wrote ${envPath}`);
}
