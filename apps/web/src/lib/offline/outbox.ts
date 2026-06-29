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

/** All entries not yet synced, in drain order (seq ascending). */
export async function pendingEntries(): Promise<OutboxEntry[]> {
  const db = getDB();
  const all = await db.outbox.orderBy('seq').toArray();
  return all.filter((e) => e.status === 'pending' || e.status === 'failed');
}

/** Count of unsynced entries — drives the "pending sync" badge. */
export async function pendingCount(): Promise<number> {
  const db = getDB();
  const all = await db.outbox.toArray();
  return all.filter((e) => e.status !== 'synced').length;
}

export async function markStatus(
  id: string,
  status: OutboxEntry['status'],
  lastError?: string
): Promise<void> {
  const db = getDB();
  const entry = await db.outbox.get(id);
  if (!entry) return;
  await db.outbox.update(id, {
    status,
    lastError,
    attempts: status === 'inflight' ? entry.attempts + 1 : entry.attempts,
  });
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
