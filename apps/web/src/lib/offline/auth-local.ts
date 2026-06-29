/**
 * Offline auth identity + PIN
 *
 * After the first ONLINE login we snapshot the user's identity so the installed
 * PWA can recognise them offline. An optional local PIN (PBKDF2-hashed, never
 * stored in plaintext) gates offline access to the cached data, decoupled from
 * the Supabase token (which expires and can't refresh without a network).
 */

import { getDB, wipeOfflineDB, type AuthLocalEntry } from './db';

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const PBKDF2_ITERATIONS = 150_000;

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('WebCrypto not available');
  return c.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await subtle().importKey(
    'raw',
    enc.encode(pin) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

export interface OfflineIdentityInput {
  userId: string;
  tenantId: string;
  email: string;
  currentUser: unknown;
}

/** Snapshot identity after an online login. Preserves any existing PIN. */
export async function saveOfflineIdentity(input: OfflineIdentityInput): Promise<void> {
  if (typeof window === 'undefined') return;
  let db = getDB();
  const existing = await db.authLocal.get('current');
  const sameUser = existing?.userId === input.userId;

  // A different user on this device: wipe ALL cached data so user B never sees
  // user A's invoices/parties, then start a fresh identity (no inherited PIN).
  if (existing && !sameUser) {
    await wipeOfflineDB();
    db = getDB();
  }

  const entry: AuthLocalEntry = {
    key: 'current',
    userId: input.userId,
    tenantId: input.tenantId,
    email: input.email,
    currentUser: input.currentUser,
    pinHash: sameUser ? existing?.pinHash : undefined,
    pinSalt: sameUser ? existing?.pinSalt : undefined,
    pinIterations: sameUser ? existing?.pinIterations : undefined,
    failedAttempts: sameUser ? existing?.failedAttempts : 0,
    lockedUntil: sameUser ? existing?.lockedUntil : undefined,
    updatedAt: new Date().toISOString(),
  };
  await db.authLocal.put(entry);
}

export async function getOfflineIdentity(): Promise<AuthLocalEntry | undefined> {
  if (typeof window === 'undefined') return undefined;
  return getDB().authLocal.get('current');
}

export async function hasPin(): Promise<boolean> {
  const id = await getOfflineIdentity();
  return !!id?.pinHash;
}

/** Set or replace the offline-unlock PIN. */
export async function setPin(pin: string): Promise<void> {
  const db = getDB();
  const id = await db.authLocal.get('current');
  if (!id) throw new Error('No offline identity to attach a PIN to');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const pinHash = await derive(pin, salt, PBKDF2_ITERATIONS);
  await db.authLocal.update('current', {
    pinHash,
    pinSalt: toBase64(salt),
    pinIterations: PBKDF2_ITERATIONS,
    failedAttempts: 0,
    lockedUntil: undefined,
  });
}

export interface PinVerifyResult {
  ok: boolean;
  lockedUntil?: string;
  remainingAttempts?: number;
}

/** Verify a PIN with constant-ish work + lockout after repeated failures. */
export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const db = getDB();
  const id = await db.authLocal.get('current');
  if (!id?.pinHash || !id.pinSalt || !id.pinIterations) {
    return { ok: false };
  }

  if (id.lockedUntil && Date.now() < new Date(id.lockedUntil).getTime()) {
    return { ok: false, lockedUntil: id.lockedUntil };
  }

  const candidate = await derive(pin, fromBase64(id.pinSalt), id.pinIterations);
  if (candidate === id.pinHash) {
    await db.authLocal.update('current', { failedAttempts: 0, lockedUntil: undefined });
    return { ok: true };
  }

  const failedAttempts = (id.failedAttempts ?? 0) + 1;
  const locked = failedAttempts >= LOCKOUT_MAX_ATTEMPTS;
  await db.authLocal.update('current', {
    failedAttempts: locked ? 0 : failedAttempts,
    lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MS).toISOString() : undefined,
  });
  return {
    ok: false,
    lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MS).toISOString() : undefined,
    remainingAttempts: locked ? 0 : LOCKOUT_MAX_ATTEMPTS - failedAttempts,
  };
}

/** Clear the offline identity (e.g. on explicit sign-out). */
export async function clearOfflineIdentity(): Promise<void> {
  if (typeof window === 'undefined') return;
  await getDB().authLocal.delete('current');
}
