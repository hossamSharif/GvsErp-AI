/**
 * Identifier helpers for offline-created records.
 *
 * Offline documents get a temporary, visibly-distinct number (`OFF-XXXXXXXX`)
 * that the server renumbers to its canonical sequence (e.g. `SAL-202512-0001`)
 * when the queued mutation replays. UUID primary keys are generated client-side
 * so creates are naturally idempotent on replay.
 */

/** Prefix marking a client-generated, not-yet-synced document number. */
export const TEMP_NUMBER_PREFIX = 'OFF-';

function randomUUID(): string {
  const c = globalThis.crypto;
  if (!c || typeof c.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is not available in this environment');
  }
  return c.randomUUID();
}

/**
 * Generate a temporary document number like `OFF-1A2B3C4D`. Pass an existing
 * UUID (e.g. the row's primary key) to keep the number stable for that row.
 */
export function tempInvoiceNumber(uuid?: string): string {
  const source = uuid ?? randomUUID();
  const suffix = source.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${TEMP_NUMBER_PREFIX}${suffix}`;
}

/** True when a document number is a client-generated temporary number. */
export function isTempNumber(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEMP_NUMBER_PREFIX);
}

/**
 * A UUID used to dedupe a queued mutation if it is replayed more than once
 * (e.g. retried after an ambiguous network failure).
 */
export function newIdempotencyKey(): string {
  return randomUUID();
}

/** Generate a client-side UUID primary key for a new record. */
export function newId(): string {
  return randomUUID();
}
