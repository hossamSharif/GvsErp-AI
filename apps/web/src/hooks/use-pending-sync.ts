'use client';

/**
 * usePendingSync
 *
 * Live counts of unsynced outbox entries: `total` (everything not yet synced)
 * and `failed` (entries that errored on their last replay). Drives the sync
 * status badge.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/offline/db';

export interface PendingSyncStats {
  total: number;
  failed: number;
}

export function usePendingSync(): PendingSyncStats {
  const stats = useLiveQuery(async () => {
    if (typeof window === 'undefined') return { total: 0, failed: 0 };
    try {
      const all = await getDB().outbox.toArray();
      return {
        total: all.filter((e) => e.status !== 'synced').length,
        failed: all.filter((e) => e.status === 'failed').length,
      };
    } catch (err) {
      // Never let an offline-store problem crash the app shell.
      console.warn('[offline] pending-sync count failed', err);
      return { total: 0, failed: 0 };
    }
  });
  return stats ?? { total: 0, failed: 0 };
}

/** Backwards-compatible total-only count. */
export function usePendingSyncCount(): number {
  return usePendingSync().total;
}
