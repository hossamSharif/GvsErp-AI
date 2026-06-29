'use client';

/**
 * Sync Manager
 *
 * Drains the offline outbox whenever the app is online and authenticated, then
 * invalidates the React Query cache so the UI refetches the server's canonical
 * data (real document numbers, recomputed party balances, posted accounting).
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnline } from '@/hooks/use-online';
import { useAuth } from '@/providers/auth-provider';

export function SyncManager() {
  const online = useOnline();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!online || !session) return;

    let cancelled = false;
    (async () => {
      const { pendingCount } = await import('@/lib/offline/outbox');
      if ((await pendingCount()) === 0) return;
      const { runSync } = await import('@/lib/offline/sync');
      const result = await runSync();
      if (!cancelled && result.pushed > 0) {
        // Refetch everything so temp numbers/balances are replaced by canonical
        // server values.
        queryClient.invalidateQueries();
      }
    })().catch((err) => console.warn('[sync] run failed', err));

    return () => {
      cancelled = true;
    };
  }, [online, session, queryClient]);

  return null;
}
