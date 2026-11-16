/**
 * Local edition license: key verification and status evaluation.
 *
 * Pure functions (no I/O) so they are easy to test; LicenseService
 * (services/license.service.ts) supplies the stored key, trial start and clock data.
 *
 * Key format (issued by scripts/license/issue.mjs):
 *   GVS1.<base64url(JSON payload)>.<base64url(Ed25519 signature of "GVS1.<payload>")>
 *
 * Protection is deterrent-level: whoever controls the PC can tamper with the
 * database or containers. An expired or missing license never locks a client
 * out of their data — it makes the app read-only.
 */

import { createHash, createPublicKey, verify } from 'node:crypto';
import { LICENSE_PUBLIC_KEY_PEM } from './public-key';

export const LICENSE_PREFIX = 'GVS1';
export const TRIAL_DAYS = 14;
export const TRIAL_MAX_USERS = 3;
/** How far the clock may go back before we treat it as tampering. */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 48 * 3600_000;
const DAY_MS = 86_400_000;

export interface LicensePayload {
  v: 1;
  id: string;
  client: string;
  maxUsers: number;
  issuedAt: string;
  expiresAt: string | null;
  machineId: string | null;
}

export type LicenseState =
  | 'valid'
  | 'trial'
  | 'trial_expired'
  | 'expired'
  | 'invalid'
  | 'wrong_machine'
  | 'clock_tampered';

export type VerifyResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'unsupported_version' };

export function verifyLicenseKey(key: string, publicKeyPem: string = LICENSE_PUBLIC_KEY_PEM): VerifyResult {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) return { ok: false, reason: 'malformed' };

  let signatureOk = false;
  try {
    signatureOk = verify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey(publicKeyPem),
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!signatureOk) return { ok: false, reason: 'bad_signature' };

  let payload: LicensePayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (payload?.v !== 1) return { ok: false, reason: 'unsupported_version' };
  if (!Number.isInteger(payload.maxUsers) || payload.maxUsers < 1 || typeof payload.client !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  return { ok: true, payload };
}

/**
 * The PC ID shown to the client and put into PC-locked keys:
 * a short hash of the raw machine identifier, XXXX-XXXX-XXXX-XXXX.
 */
export function formatMachineId(raw: string): string {
  const hex = createHash('sha256').update(`gvs-machine:${raw.trim()}`).digest('hex').slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

export interface LicenseInput {
  key: string | null;
  now: Date;
  /** This PC's ID (formatMachineId output), or null if unknown. */
  machineId: string | null;
  /** When the company was set up; trial runs from here. Null = not set up yet. */
  trialStartedAt: Date | null;
  /** Highest time this install has seen (clock rollback detection). */
  lastSeenAt: Date | null;
  publicKeyPem?: string;
}

export interface LicenseEvaluation {
  state: LicenseState;
  /** Writes allowed (valid license or running trial). */
  canWrite: boolean;
  maxUsers: number;
  client: string | null;
  licenseId: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  /** Days until the license or trial ends (null = never expires). */
  daysLeft: number | null;
  keyMachineId: string | null;
}

export function evaluateLicense(input: LicenseInput): LicenseEvaluation {
  const { now } = input;
  const base = {
    client: null,
    licenseId: null,
    expiresAt: null,
    trialEndsAt: null,
    daysLeft: null,
    keyMachineId: null,
  };
  const daysUntil = (t: number) => Math.max(0, Math.ceil((t - now.getTime()) / DAY_MS));

  if (input.lastSeenAt && now.getTime() < input.lastSeenAt.getTime() - CLOCK_ROLLBACK_TOLERANCE_MS) {
    return { ...base, state: 'clock_tampered', canWrite: false, maxUsers: TRIAL_MAX_USERS };
  }

  if (!input.key) {
    const start = input.trialStartedAt ?? now;
    const ends = start.getTime() + TRIAL_DAYS * DAY_MS;
    const running = now.getTime() < ends;
    return {
      ...base,
      state: running ? 'trial' : 'trial_expired',
      canWrite: running,
      maxUsers: TRIAL_MAX_USERS,
      trialEndsAt: new Date(ends).toISOString(),
      daysLeft: daysUntil(ends),
    };
  }

  const verified = verifyLicenseKey(input.key, input.publicKeyPem);
  if (!verified.ok) {
    return { ...base, state: 'invalid', canWrite: false, maxUsers: TRIAL_MAX_USERS };
  }
  const p = verified.payload;
  const details = {
    ...base,
    client: p.client,
    licenseId: p.id,
    expiresAt: p.expiresAt,
    keyMachineId: p.machineId,
    maxUsers: p.maxUsers,
    daysLeft: p.expiresAt ? daysUntil(Date.parse(p.expiresAt)) : null,
  };

  if (p.machineId && p.machineId !== input.machineId) {
    return { ...details, state: 'wrong_machine', canWrite: false };
  }
  if (p.expiresAt && now.getTime() >= Date.parse(p.expiresAt)) {
    return { ...details, state: 'expired', canWrite: false };
  }
  return { ...details, state: 'valid', canWrite: true };
}
