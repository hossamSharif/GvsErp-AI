/**
 * Sync engine
 *
 * On reconnect, drains the outbox serially in dependency order and replays each
 * mutation against the EXISTING API endpoints with an `Idempotency-Key` header.
 * Because records were created with client-generated UUID primary keys, the
 * server upserts by id and the finalize/payment endpoints address the same id —
 * so the only thing that changes is the canonical document number, which we
 * reconcile back into the local store.
 *
 * Single-device-per-tenant: a strict serial drain is correct; no merge logic.
 */

import { networkRequest, ApiClientError } from '@/lib/api-client';
import { classifyReplayFailure } from '@erp/offline-engine';
import { getDB, type OutboxEntry, type CachedRecord } from './db';
import {
  pendingEntries,
  markStatus,
  pruneSynced,
  mapId,
  getMappedServerId,
  reclaimInflight,
} from './outbox';
import { useSyncStore } from '@/stores/sync-store';

export interface SyncResult {
  pushed: number;
  failed: number;
  skipped: number;
  /** Entries the server rejected permanently — they need a human decision. */
  blocked: number;
}

export interface SyncOptions {
  /**
   * When a drain is already running, wait for it and return its result instead
   * of returning zeros. Manual "Sync now" must set this: the background loop
   * ticks every 15–60s, so a click frequently lands mid-tick and would
   * otherwise appear to do nothing at all.
   */
  force?: boolean;
}

const EMPTY: SyncResult = { pushed: 0, failed: 0, skipped: 0, blocked: 0 };

/** The in-flight drain, so a forced call can await it rather than no-op. */
let current: Promise<SyncResult> | null = null;

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? false : navigator.onLine;
}

/**
 * Rewrite an entry's endpoint/payload so any LOCAL id that the server has since
 * mapped to a canonical id is replaced before replay. The server assigns its
 * own id on create; dependent mutations (finalize, payment) must address that
 * server id, not the local UUID.
 */
async function remap(entry: OutboxEntry): Promise<{ endpoint: string; payload: unknown }> {
  let endpoint = entry.endpoint;

  // /invoices/:id/finalize  and  /invoices/:id (PUT)
  const m = /^\/(invoices)\/([^/]+)(\/finalize)?$/.exec(endpoint);
  if (m) {
    const serverId = await getMappedServerId(m[2]);
    if (serverId) endpoint = `/${m[1]}/${serverId}${m[3] ?? ''}`;
  }

  let payload = entry.payload;
  if (payload && typeof payload === 'object') {
    const p = { ...(payload as Record<string, unknown>) };
    for (const key of ['invoiceId', 'invoice_id'] as const) {
      const local = p[key];
      if (typeof local === 'string') {
        const serverId = await getMappedServerId(local);
        if (serverId) p[key] = serverId;
      }
    }
    // Bill-wise payment allocations carry the invoice id nested in an array —
    // remap each one so a payment created offline stays linked to its invoice.
    if (Array.isArray(p.allocations)) {
      p.allocations = await Promise.all(
        (p.allocations as Array<Record<string, unknown>>).map(async (alloc) => {
          const local = alloc?.invoice_id;
          if (typeof local === 'string') {
            const serverId = await getMappedServerId(local);
            if (serverId) return { ...alloc, invoice_id: serverId };
          }
          return alloc;
        })
      );
    }
    payload = p;
  }

  return { endpoint, payload };
}

/** Replay one outbox entry against its endpoint, carrying the idempotency key. */
async function replay(entry: OutboxEntry): Promise<unknown> {
  const { endpoint, payload } = await remap(entry);
  return networkRequest(entry.method, endpoint, {
    body: payload,
    headers: { 'Idempotency-Key': entry.idempotencyKey },
  });
}

/** Fold the server's canonical record (real number, posted state) back in. */
async function reconcile(entry: OutboxEntry, resp: unknown): Promise<void> {
  const db = getDB();
  const data = (resp as { data?: Record<string, unknown> } | undefined)?.data;
  if (!data || typeof data !== 'object' || typeof data.id !== 'string') return;
  const now = new Date().toISOString();
  const row = { ...data, _syncedAt: now } as CachedRecord;

  if (entry.type === 'invoice.create' || entry.type === 'invoice.finalize') {
    // If the server assigned a different id, drop the local temp row + items so
    // the list doesn't show a duplicate; the canonical row is written below.
    if (String(data.id) !== entry.entityLocalId) {
      await db.invoices.delete(entry.entityLocalId);
      await db.invoiceItems.where('invoiceId').equals(entry.entityLocalId).delete();
    }
    await db.invoices.put(row);
    await mapId({
      localKey: entry.entityLocalId,
      serverId: String(data.id),
      serverNumber: typeof data.invoiceNumber === 'string' ? data.invoiceNumber : undefined,
      entity: 'invoice',
    });
  } else if (entry.type === 'payment.create') {
    await db.payments.put(row);
    await mapId({ localKey: entry.entityLocalId, serverId: String(data.id), entity: 'payment' });
  } else if (entry.type === 'transfer.create' || entry.type === 'transfer.execute') {
    await db.transfers.put(row);
    await mapId({ localKey: entry.entityLocalId, serverId: String(data.id), entity: 'transfer' });
  }
}

/**
 * Drain the outbox. Entries whose dependencies failed earlier this run are left
 * pending (skipped) so they retry on a later sync once the dependency clears.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  if (typeof window === 'undefined' || !isOnline()) return EMPTY;
  if (current) return options.force ? current : EMPTY;

  current = drain().finally(() => {
    current = null;
  });
  return current;
}

async function drain(): Promise<SyncResult> {
  useSyncStore.setState({ isSyncing: true });
  let pushed = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;
  let lastError: string | null = null;
  // Entries that did not clear this run — dependents must wait, whether the
  // dependency merely failed or was rejected outright.
  const unresolved = new Set<string>();

  try {
    // Recover anything stranded `inflight` by a reload mid-replay, otherwise it
    // is counted by the badge but never picked up by the drain.
    await reclaimInflight();

    const entries = await pendingEntries(); // ordered by seq

    // Blocked entries are not in `entries` at all, but their dependents must
    // still wait — replaying a finalize whose create was rejected just produces
    // a second, confusing rejection.
    const db = getDB();
    for (const e of await db.outbox.toArray()) {
      if (e.blocked) unresolved.add(e.id);
    }

    for (const entry of entries) {
      // If any dependency is still unresolved, defer this entry and record why
      // so the pending-changes dialog can say what it is waiting for.
      const waitingOn = entry.dependsOn.find((d) => unresolved.has(d));
      if (waitingOn) {
        await markStatus(entry.id, 'pending', { waitingOn });
        unresolved.add(entry.id);
        skipped++;
        continue;
      }
      try {
        await markStatus(entry.id, 'inflight');
        const resp = await replay(entry);
        await reconcile(entry, resp);
        await markStatus(entry.id, 'synced');
        pushed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof ApiClientError ? err.status : undefined;
        const isBlocked = classifyReplayFailure(status) === 'blocked';
        lastError = message;
        await markStatus(entry.id, 'failed', {
          lastError: message,
          lastStatus: status,
          lastCode: err instanceof ApiClientError ? err.code : undefined,
          blocked: isBlocked || undefined,
        });
        unresolved.add(entry.id);
        if (isBlocked) blocked++;
        else failed++;
      }
    }
    await pruneSynced();
  } finally {
    useSyncStore.setState({
      isSyncing: false,
      lastPushed: pushed,
      // Keep the error only if something is still unresolved this run.
      lastError: failed + blocked > 0 ? lastError : null,
    });
  }

  return { pushed, failed, skipped, blocked };
}
