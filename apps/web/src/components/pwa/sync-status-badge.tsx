'use client';

/**
 * Sync Status Badge
 *
 * Honest, actionable sync state — distinguishes:
 *  - actively syncing   → spinner "Syncing N…"
 *  - offline            → "Offline · N to sync"
 *  - online + failed    → "N failed — Retry" (button; tooltip shows the error)
 *  - online + queued    → "N pending — Retry" (waiting for the backoff loop)
 * Hidden when online with an empty outbox.
 */

import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { useSyncStore } from '@/stores/sync-store';

export function SyncStatusBadge() {
  const online = useOnline();
  const { total, failed } = usePendingSync();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastError = useSyncStore((s) => s.lastError);

  if (online && total === 0) return null;

  const retry = () => {
    void import('@/lib/offline/sync').then(({ runSync }) => runSync());
  };

  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium';

  // Actively draining the outbox.
  if (isSyncing) {
    return (
      <span
        className={`${base} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300`}
        title="Syncing your locally-saved changes to the server."
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Syncing {total}…
      </span>
    );
  }

  // Offline: changes are held locally.
  if (!online) {
    return (
      <span
        className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`}
        title="You are offline. Changes are saved locally and will sync when you reconnect."
      >
        <CloudOff className="h-3.5 w-3.5" />
        Offline{total > 0 ? ` · ${total} to sync` : ''}
      </span>
    );
  }

  // Online, not currently syncing, something failed → surface + let them retry.
  if (failed > 0) {
    return (
      <button
        type="button"
        onClick={retry}
        className={`${base} bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300`}
        title={lastError ? `Last error: ${lastError}` : 'Some changes could not sync. Click to retry.'}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {failed} failed — Retry
      </button>
    );
  }

  // Online, queued but not yet drained (the backoff loop will pick it up).
  return (
    <button
      type="button"
      onClick={retry}
      className={`${base} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300`}
      title="Waiting to sync. Click to sync now."
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {total} pending — Retry
    </button>
  );
}
