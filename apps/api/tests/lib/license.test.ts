import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import {
  evaluateLicense,
  formatMachineId,
  verifyLicenseKey,
  TRIAL_DAYS,
  TRIAL_MAX_USERS,
  type LicensePayload,
} from '../../src/lib/license/license';

// TEST key pair: the matching public key is embedded in src/lib/license/public-key.ts.
const TEST_PRIVATE = readFileSync(join(__dirname, '../fixtures/license-test-private.pem'), 'utf8');
const DAY = 86_400_000;
const NOW = new Date('2026-11-16T12:00:00Z');
const PC = formatMachineId('pc-one');

function issue(overrides: Partial<LicensePayload> = {}, privateKeyPem = TEST_PRIVATE): string {
  const payload: LicensePayload = {
    v: 1,
    id: 'lic-1',
    client: 'Al Noor Pharmacy',
    maxUsers: 5,
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 365 * DAY).toISOString(),
    machineId: null,
    ...overrides,
  };
  const body = `GVS1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  const sig = sign(null, Buffer.from(body), createPrivateKey(privateKeyPem)).toString('base64url');
  return `${body}.${sig}`;
}

const evalWith = (key: string | null, extra: Partial<Parameters<typeof evaluateLicense>[0]> = {}) =>
  evaluateLicense({ key, now: NOW, machineId: PC, trialStartedAt: NOW, lastSeenAt: null, ...extra });

describe('formatMachineId', () => {
  it('is a stable XXXX-XXXX-XXXX-XXXX hash', () => {
    expect(PC).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(formatMachineId('pc-one')).toBe(PC);
    expect(formatMachineId('pc-two')).not.toBe(PC);
  });
});

describe('verifyLicenseKey', () => {
  it('accepts a key signed with the embedded (test) key', () => {
    const r = verifyLicenseKey(issue());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.client).toBe('Al Noor Pharmacy');
  });

  it('rejects a tampered payload', () => {
    const [p, , s] = issue().split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, id: 'x', client: 'X', maxUsers: 999, issuedAt: '', expiresAt: null, machineId: null })).toString('base64url');
    expect(verifyLicenseKey(`${p}.${forged}.${s}`)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a key signed with another private key', () => {
    const other = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(verifyLicenseKey(issue({}, other))).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects garbage', () => {
    expect(verifyLicenseKey('hello').ok).toBe(false);
    expect(verifyLicenseKey('GVS1.abc.def').ok).toBe(false);
    expect(verifyLicenseKey('').ok).toBe(false);
  });
});

describe('evaluateLicense: trial (no key)', () => {
  it('is a running trial with full days on day one', () => {
    const r = evalWith(null);
    expect(r).toMatchObject({ state: 'trial', canWrite: true, maxUsers: TRIAL_MAX_USERS, daysLeft: TRIAL_DAYS });
  });

  it('counts down from the setup date', () => {
    const r = evalWith(null, { trialStartedAt: new Date(NOW.getTime() - 10 * DAY) });
    expect(r).toMatchObject({ state: 'trial', canWrite: true, daysLeft: 4 });
  });

  it('becomes read-only after 14 days', () => {
    const r = evalWith(null, { trialStartedAt: new Date(NOW.getTime() - (TRIAL_DAYS * DAY + 1)) });
    expect(r).toMatchObject({ state: 'trial_expired', canWrite: false, daysLeft: 0 });
  });

  it('starts the trial now when the company is not set up yet', () => {
    expect(evalWith(null, { trialStartedAt: null }).state).toBe('trial');
  });
});

describe('evaluateLicense: with a key', () => {
  it('valid key: writes allowed, details exposed', () => {
    const r = evalWith(issue());
    expect(r).toMatchObject({ state: 'valid', canWrite: true, maxUsers: 5, client: 'Al Noor Pharmacy', daysLeft: 365 });
  });

  it('never-expiring key has no days left', () => {
    expect(evalWith(issue({ expiresAt: null }))).toMatchObject({ state: 'valid', daysLeft: null });
  });

  it('expired key is read-only', () => {
    const r = evalWith(issue({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }));
    expect(r).toMatchObject({ state: 'expired', canWrite: false });
  });

  it('PC-locked key works on that PC only', () => {
    expect(evalWith(issue({ machineId: PC })).state).toBe('valid');
    const other = evalWith(issue({ machineId: PC }), { machineId: formatMachineId('pc-two') });
    expect(other).toMatchObject({ state: 'wrong_machine', canWrite: false });
  });

  it('any-PC key works everywhere, even without a machine id', () => {
    expect(evalWith(issue({ machineId: null }), { machineId: null }).state).toBe('valid');
  });

  it('invalid stored key is read-only (does not fall back to a trial)', () => {
    expect(evalWith('GVS1.bad.key')).toMatchObject({ state: 'invalid', canWrite: false });
  });
});

describe('evaluateLicense: clock rollback', () => {
  it('tolerates small clock corrections', () => {
    expect(evalWith(issue(), { lastSeenAt: new Date(NOW.getTime() + 24 * 3600_000) }).state).toBe('valid');
  });

  it('flags a clock set back more than 48 hours', () => {
    const r = evalWith(issue(), { lastSeenAt: new Date(NOW.getTime() + 3 * DAY) });
    expect(r).toMatchObject({ state: 'clock_tampered', canWrite: false });
  });
});
