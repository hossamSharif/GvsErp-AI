'use client';

/**
 * usePendingSyncCount
 *
 * Live count of unsynced outbox entries, driving the "pending sync" indicator.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/offline/db';

export function usePendingSyncCount(): number {
  const count = useLiveQuery(async () => {
    if (typeof window === 'undefined') return 0;
    try {
      const all = await getDB().outbox.toArray();
      return all.filter((e) => e.status !== 'synced').length;
    } catch (err) {
      // Never let an offline-store problem crash the app shell.
      console.warn('[offline] pending-sync count failed', err);
      return 0;
    }
  });
  return count ?? 0;
}
