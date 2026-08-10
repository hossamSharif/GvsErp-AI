/**
 * Outbox repository
 *
 * Durable queue of offline mutations, drained on reconnect in dependency order
 * (see lib/offline/sync.ts). Single-device-per-tenant, so a strict serial drain
 * is correct and no cross-device merge is needed.
 */

import { getDB, type OutboxEntry, type OutboxType, type IdMapEntry } from './db';
import { newId, newIdempotencyKey } from '@erp/offline-engine';

export interface EnqueueInput {
  type: OutboxType;
  entityLocalId: string;
  endpoint: string;
  method: OutboxEntry['method'];
  payload: unknown;
  /** Outbox entry ids that must sync first. */
  dependsOn?: string[];
}

/** Add a mutation to the outbox. Returns the created entry. */
export async function enqueue(input: EnqueueInput): Promise<OutboxEntry> {
  const db = getDB();
  // Assign a monotonic drain-order seq (max+1). Enqueues are awaited
  // sequentially by the engine, so there's no race here.
  const last = await db.outbox.orderBy('seq').last();
  const seq = (last?.seq ?? 0) + 1;
  const entry: OutboxEntry = {
    id: newId(),
    idempotencyKey: newIdempotencyKey(),
    seq,
    type: input.type,
    entityLocalId: input.entityLocalId,
    dependsOn: input.dependsOn ?? [],
    endpoint: input.endpoint,
    method: input.method,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await db.outbox.add(entry);
  return entry;
}

/**
 * Entries the background loop should attempt, in drain order (seq ascending).
 *
 * `blocked` entries are excluded: the server rejected them with a 4xx that
 * retrying cannot fix, so hammering them every 60s only burns requests. They
 * stay visible in the pending-changes dialog until the user retries or discards.
 */
export async function pendingEntries(): Promise<OutboxEntry[]> {
  const db = getDB();
  const all = await db.outbox.orderBy('seq').toArray();
  return all.filter((e) => !e.blocked && (e.status === 'pending' || e.status === 'failed'));
}

/** Count of unsynced entries — drives the "pending sync" badge. */
export async function pendingCount(): Promise<number> {
  const db = getDB();
  const all = await db.outbox.toArray();
  return all.filter((e) => e.status !== 'synced').length;
}

/** Every entry still in the queue, in drain order — powers the preview dialog. */
export async function allOutboxEntries(): Promise<OutboxEntry[]> {
  const db = getDB();
  const all = await db.outbox.orderBy('seq').toArray();
  return all.filter((e) => e.status !== 'synced');
}

/**
 * Recover entries stranded mid-replay.
 *
 * `runSync` flips an entry to `inflight` before calling the API. If the tab is
 * closed, reloaded or navigated away during that call, the entry is left
 * `inflight` forever: the badge counts it (status !== 'synced') but
 * `pendingEntries()` skips it, so it is never retried — the queue appears stuck
 * and the retry button does nothing. Flipping them back to `pending` on every
 * sync start is safe because each replay carries an `Idempotency-Key` and the
 * API replays the stored 2xx response instead of double-posting.
 *
 * Returns how many entries were reclaimed.
 */
export async function reclaimInflight(): Promise<number> {
  const db = getDB();
  const stranded = await db.outbox.where('status').equals('inflight').toArray();
  if (!stranded.length) return 0;
  const now = new Date().toISOString();
  await db.outbox.bulkPut(
    stranded.map((e) => ({ ...e, status: 'pending' as const, updatedAt: now }))
  );
  return stranded.length;
}

export interface StatusPatch {
  lastError?: string;
  lastStatus?: number;
  lastCode?: string;
  blocked?: boolean;
  waitingOn?: string;
}

export async function markStatus(
  id: string,
  status: OutboxEntry['status'],
  patch: StatusPatch = {}
): Promise<void> {
  const db = getDB();
  const entry = await db.outbox.get(id);
  if (!entry) return;
  await db.outbox.update(id, {
    status,
    attempts: status === 'inflight' ? entry.attempts + 1 : entry.attempts,
    updatedAt: new Date().toISOString(),
    // Always overwrite (with undefined when absent) so a successful attempt
    // clears the diagnostics left by the previous failure.
    lastError: patch.lastError,
    lastStatus: patch.lastStatus,
    lastCode: patch.lastCode,
    blocked: patch.blocked,
    waitingOn: patch.waitingOn,
  });
}

/**
 * Clear a blocked/failed entry's error state so the next drain attempts it
 * again. Backs the per-entry "Retry" action.
 */
export async function unblock(id: string): Promise<void> {
  await markStatus(id, 'pending');
}

/**
 * Permanently drop a queued mutation. The local record it produced stays in
 * IndexedDB — only the intent to send it to the server is discarded.
 *
 * Dependents are un-wired rather than orphaned: an entry that was waiting on
 * this one would otherwise never be released.
 */
export async function discardEntry(id: string): Promise<void> {
  const db = getDB();
  await db.outbox.delete(id);
  const dependents = await db.outbox.toArray();
  for (const dep of dependents) {
    if (!dep.dependsOn.includes(id)) continue;
    await db.outbox.update(dep.id, {
      dependsOn: dep.dependsOn.filter((d) => d !== id),
      waitingOn: dep.waitingOn === id ? undefined : dep.waitingOn,
    });
  }
}

/** Remove synced entries to keep the queue small. */
export async function pruneSynced(): Promise<void> {
  const db = getDB();
  const synced = await db.outbox.where('status').equals('synced').primaryKeys();
  if (synced.length) await db.outbox.bulkDelete(synced as string[]);
}

/** Record a local→server id/number mapping after a successful sync. */
export async function mapId(entry: Omit<IdMapEntry, 'mappedAt'>): Promise<void> {
  const db = getDB();
  await db.idMap.put({ ...entry, mappedAt: new Date().toISOString() });
}

export async function getMappedServerId(localKey: string): Promise<string | undefined> {
  const db = getDB();
  const m = await db.idMap.get(localKey);
  return m?.serverId;
}
