'use client';

/**
 * Sync Manager
 *
 * Drains the offline outbox and keeps retrying while items remain and the
 * device is online — with exponential backoff — instead of only firing on the
 * browser's `online` event. This makes a transient failure (e.g. a brief loss
 * of connectivity to Supabase during a replay) self-heal without the user
 * having to reload. After a successful push it invalidates the React Query
 * cache so the UI shows the server's canonical numbers/balances.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';

const BASE_DELAY = 15_000; // first retry after ~15s
const MAX_DELAY = 60_000; // cap backoff at 60s

export function SyncManager() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      let remaining = 0;
      try {
        const { pendingCount } = await import('@/lib/offline/outbox');
        remaining = await pendingCount();

        if (navigator.onLine && remaining > 0) {
          const { runSync } = await import('@/lib/offline/sync');
          const result = await runSync();
          if (cancelled) return;
          if (result.pushed > 0) queryClient.invalidateQueries();
          remaining = await pendingCount();
          attempt = remaining > 0 ? attempt + 1 : 0;
        } else {
          attempt = 0;
        }
      } catch (err) {
        console.warn('[sync] tick failed', err);
        attempt += 1;
      }

      // Only keep a timer alive while there's work AND we're online. When the
      // queue is empty or we're offline we stop; the `online` event (or a fresh
      // mount) restarts the loop — no pointless polling.
      if (!cancelled && navigator.onLine && remaining > 0) {
        const delay = Math.min(MAX_DELAY, BASE_DELAY * 2 ** Math.min(Math.max(attempt - 1, 0), 2));
        schedule(delay);
      }
    };

    const onOnline = () => {
      attempt = 0;
      tick();
    };
    window.addEventListener('online', onOnline);
    tick(); // run once on mount

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [session, queryClient]);

  return null;
}
