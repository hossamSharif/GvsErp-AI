'use client';

/**
 * Sync Status Badge
 *
 * Honest, actionable sync state — distinguishes:
 *  - actively syncing   → spinner "Syncing N…"
 *  - offline            → "Offline · N to sync"
 *  - online + blocked   → "N need attention" (server rejected them permanently)
 *  - online + failed    → "N failed"
 *  - online + queued    → "N pending"
 * Hidden when online with an empty outbox.
 *
 * Every state is a button that opens the pending-changes dialog. The badge no
 * longer triggers a sync itself: a fire-and-forget `runSync()` here could not
 * report whether anything happened, which is why it read as a dead button.
 * Syncing lives in the dialog, where the result can be shown.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { useSyncStore } from '@/stores/sync-store';
import { PendingChangesDialog } from './pending-changes-dialog';

export function SyncStatusBadge() {
  const t = useTranslations('offline');
  const online = useOnline();
  const { total, failed, blocked } = usePendingSync();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastError = useSyncStore((s) => s.lastError);
  const [open, setOpen] = useState(false);

  if (online && total === 0) return null;

  const base =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors';

  // Pick the tone + content for the current state; every variant is clickable
  // so the queue can be reviewed even while offline.
  let tone: string;
  let icon: React.ReactNode;
  let label: string;
  let title: string;

  if (isSyncing) {
    tone = 'bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300';
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = t('badge.syncing', { count: total });
    title = t('badge.syncingTitle');
  } else if (!online) {
    tone = 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300';
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = total > 0 ? t('badge.offlineWithCount', { count: total }) : t('badge.offline');
    title = t('badge.offlineTitle');
  } else if (blocked > 0) {
    tone = 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300';
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    label = t('badge.blocked', { count: blocked });
    title = lastError ? t('badge.lastError', { error: lastError }) : t('badge.blockedTitle');
  } else if (failed > 0) {
    tone =
      'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300';
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    label = t('badge.failed', { count: failed });
    title = lastError ? t('badge.lastError', { error: lastError }) : t('badge.failedTitle');
  } else {
    tone = 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300';
    icon = <RefreshCw className="h-3.5 w-3.5" />;
    label = t('badge.pending', { count: total });
    title = t('badge.pendingTitle');
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${base} ${tone}`} title={title}>
        {icon}
        {label}
      </button>
      <PendingChangesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
