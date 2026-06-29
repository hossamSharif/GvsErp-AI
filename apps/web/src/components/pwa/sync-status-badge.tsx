'use client';

/**
 * Sync Status Badge
 *
 * Shows offline state and the number of locally-saved changes waiting to sync.
 * Hidden entirely when online with an empty outbox.
 */

import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';
import { usePendingSyncCount } from '@/hooks/use-pending-sync';

export function SyncStatusBadge() {
  const online = useOnline();
  const pending = usePendingSyncCount();

  if (online && pending === 0) return null;

  if (!online) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        title="You are offline. Changes are saved locally and will sync when you reconnect."
      >
        <CloudOff className="h-3.5 w-3.5" />
        Offline{pending > 0 ? ` · ${pending} to sync` : ''}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
      title="Syncing locally-saved changes to the server."
    >
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      Syncing {pending}…
    </span>
  );
}
