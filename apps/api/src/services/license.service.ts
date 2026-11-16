/**
 * Local edition license service.
 *
 * Reads/writes the single app_license row (migration 046) with the service
 * role, works out the trial start (when the company was set up), tracks the
 * highest clock time seen, and caches the evaluated status for a few minutes.
 * Only used when DEPLOYMENT_MODE=local.
 */

import { getAdminClient } from './auth-admin';
import { AppError } from '../middleware/error';
import {
  evaluateLicense,
  formatMachineId,
  type LicenseEvaluation,
} from '../lib/license/license';
import { IS_TEST_KEY } from '../lib/license/public-key';

export interface LicenseStatus extends LicenseEvaluation {
  /** This PC's ID (to send to the vendor for a PC-locked key). */
  machineId: string | null;
  usersUsed: number;
  testKey: boolean;
}

const CACHE_MS = 5 * 60_000;
const LAST_SEEN_UPDATE_MS = 60 * 60_000;

interface LicenseRow {
  license_key: string | null;
  installed_at: string | null;
  last_seen_at: string | null;
}

let cached: { at: number; status: LicenseStatus } | null = null;

/** This install's PC ID, from GVS_MACHINE_ID (set by the installer). */
export function currentMachineId(): string | null {
  const raw = process.env.GVS_MACHINE_ID;
  return raw && raw.trim() ? formatMachineId(raw) : null;
}

// app_license isn't in the generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const licenseTable = () => (getAdminClient() as any).from('app_license');

async function readRow(): Promise<LicenseRow | null> {
  const { data, error } = await licenseTable()
    .select('license_key, installed_at, last_seen_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw AppError.internal(`License read failed: ${error.message}`);
  return data as LicenseRow | null;
}

async function trialStartedAt(): Promise<Date | null> {
  const { data, error } = await getAdminClient()
    .from('tenants')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw AppError.internal('Failed to read setup date');
  return data?.created_at ? new Date(data.created_at) : null;
}

async function countActiveUsers(): Promise<number> {
  const { count, error } = await getAdminClient()
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) throw AppError.internal('Failed to count users');
  return count ?? 0;
}

/** Keep last_seen_at at the highest time seen (clock rollback detection). */
async function touchLastSeen(row: LicenseRow | null, now: Date): Promise<void> {
  const last = row?.last_seen_at ? Date.parse(row.last_seen_at) : 0;
  if (row && now.getTime() - last < LAST_SEEN_UPDATE_MS) return;
  const next = new Date(Math.max(now.getTime(), last)).toISOString();
  const { error } = await licenseTable().upsert(
    { id: 1, last_seen_at: next, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) console.error('[license] failed to update last_seen_at:', error.message);
}

async function computeStatus(keyOverride?: string): Promise<LicenseStatus> {
  const now = new Date();
  const [row, startedAt, usersUsed] = await Promise.all([readRow(), trialStartedAt(), countActiveUsers()]);
  const machineId = currentMachineId();
  const evaluation = evaluateLicense({
    key: keyOverride ?? row?.license_key ?? null,
    now,
    machineId,
    trialStartedAt: startedAt,
    lastSeenAt: row?.last_seen_at ? new Date(row.last_seen_at) : null,
  });
  if (keyOverride === undefined) await touchLastSeen(row, now);
  return { ...evaluation, machineId, usersUsed, testKey: IS_TEST_KEY };
}

export async function getLicenseStatus(options: { fresh?: boolean } = {}): Promise<LicenseStatus> {
  if (!options.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.status;
  const status = await computeStatus();
  cached = { at: Date.now(), status };
  return status;
}

export function invalidateLicenseCache(): void {
  cached = null;
}

const REJECT_MESSAGES: Partial<Record<LicenseEvaluation['state'], string>> = {
  invalid: 'This license key is not valid. Check that it was copied completely.',
  wrong_machine: 'This license key is for a different PC. Send your PC ID to your supplier for a new key.',
  expired: 'This license key has expired.',
  clock_tampered: "This PC's date and time look wrong. Correct the clock, then try again.",
};

/** Validate and store a new license key. Throws a 400 with a clear reason. */
export async function installLicenseKey(key: string): Promise<LicenseStatus> {
  const trimmed = key.trim();
  const candidate = await computeStatus(trimmed);
  if (candidate.state !== 'valid') {
    throw new AppError('LICENSE_INVALID', REJECT_MESSAGES[candidate.state] ?? 'License key rejected', 400);
  }
  const now = new Date().toISOString();
  const { error } = await licenseTable().upsert(
    { id: 1, license_key: trimmed, installed_at: now, updated_at: now },
    { onConflict: 'id' }
  );
  if (error) throw AppError.internal(`License save failed: ${error.message}`);
  invalidateLicenseCache();
  return getLicenseStatus({ fresh: true });
}

/**
 * Throws LICENSE_USER_LIMIT if one more active user would exceed the license.
 * No-op outside the local edition (callers check isLocalMode()).
 */
export async function assertUserSlotAvailable(): Promise<void> {
  const status = await getLicenseStatus({ fresh: true });
  if (status.usersUsed >= status.maxUsers) {
    throw new AppError(
      'LICENSE_USER_LIMIT',
      `Your license allows ${status.maxUsers} active user(s). Deactivate a user or upgrade your license.`,
      403
    );
  }
}
