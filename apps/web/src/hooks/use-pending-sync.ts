'use client';

/**
 * usePendingSync
 *
 * Live counts of unsynced outbox entries: `total` (everything not yet synced),
 * `failed` (entries that errored and will retry) and `blocked` (entries the
 * server rejected permanently — they need a human decision). Drives the sync
 * status badge; `usePendingChanges` additionally resolves each entry into a
 * human-readable row for the pending-changes dialog.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/offline/db';
import { allOutboxEntries } from '@/lib/offline/outbox';
import { describePendingChanges, type PendingChangeView } from '@/lib/offline/describe';

export interface PendingSyncStats {
  total: number;
  failed: number;
  blocked: number;
}

export function usePendingSync(): PendingSyncStats {
  const stats = useLiveQuery(async () => {
    if (typeof window === 'undefined') return { total: 0, failed: 0, blocked: 0 };
    try {
      const all = await getDB().outbox.toArray();
      const unsynced = all.filter((e) => e.status !== 'synced');
      return {
        total: unsynced.length,
        failed: unsynced.filter((e) => e.status === 'failed' && !e.blocked).length,
        blocked: unsynced.filter((e) => e.blocked).length,
      };
    } catch (err) {
      // Never let an offline-store problem crash the app shell.
      console.warn('[offline] pending-sync count failed', err);
      return { total: 0, failed: 0, blocked: 0 };
    }
  });
  return stats ?? { total: 0, failed: 0, blocked: 0 };
}

/** Backwards-compatible total-only count. */
export function usePendingSyncCount(): number {
  return usePendingSync().total;
}

export interface PendingChanges extends PendingSyncStats {
  views: PendingChangeView[];
  /** False only until the first live query resolves. */
  loaded: boolean;
}

/**
 * The full queue, described in business terms and in drain order. Recomputed
 * live as the sync engine mutates the outbox, so the dialog updates itself
 * while a sync runs.
 */
export function usePendingChanges(enabled = true): PendingChanges {
  const result = useLiveQuery(async () => {
    if (typeof window === 'undefined' || !enabled) return undefined;
    try {
      const entries = await allOutboxEntries();
      const views = await describePendingChanges(entries);
      return {
        views,
        total: views.length,
        failed: views.filter((v) => v.state === 'failed').length,
        blocked: views.filter((v) => v.state === 'blocked').length,
      };
    } catch (err) {
      console.warn('[offline] pending-changes read failed', err);
      return { views: [], total: 0, failed: 0, blocked: 0 };
    }
  }, [enabled]);

  return result
    ? { ...result, loaded: true }
    : { views: [], total: 0, failed: 0, blocked: 0, loaded: false };
}
