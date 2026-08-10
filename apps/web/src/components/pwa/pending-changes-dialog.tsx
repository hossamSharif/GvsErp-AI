'use client';

/**
 * Pending Changes Dialog
 *
 * Review screen for the offline outbox. Until now the only signal that work was
 * queued was a bare counter in the header, with no way to see what the queued
 * changes were or why they were not clearing. This lists every queued mutation
 * in drain order, in business terms, with the reason it is stuck and the two
 * actions that can unstick it: retry, or discard.
 *
 * All syncing lives here rather than on the badge, because only a dialog can
 * report the outcome — the old badge fired `runSync()` and discarded the result.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronRight,
  CloudOff,
  Clock,
  RefreshCw,
  Trash2,
  Check,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useOnline } from '@/hooks/use-online';
import { usePendingChanges } from '@/hooks/use-pending-sync';
import type { PendingChangeState, PendingChangeView } from '@/lib/offline/describe';

interface PendingChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATE_STYLES: Record<PendingChangeState, { icon: typeof Clock; className: string }> = {
  queued: { icon: Clock, className: 'text-slate-500 dark:text-slate-400' },
  waiting: { icon: Hourglass, className: 'text-slate-500 dark:text-slate-400' },
  syncing: { icon: RefreshCw, className: 'text-sky-600 dark:text-sky-400' },
  failed: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  blocked: { icon: AlertTriangle, className: 'text-red-600 dark:text-red-400' },
};

/** Coarse "2h ago" formatting — Intl.RelativeTimeFormat, no extra dependency. */
function useRelativeTime(locale: string) {
  return useCallback(
    (iso: string): string => {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const diffMs = new Date(iso).getTime() - Date.now();
      const minutes = Math.round(diffMs / 60_000);
      if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
      return rtf.format(Math.round(hours / 24), 'day');
    },
    [locale]
  );
}

export function PendingChangesDialog({ open, onOpenChange }: PendingChangesDialogProps) {
  const t = useTranslations('offline');
  const locale = useLocale();
  const online = useOnline();
  const queryClient = useQueryClient();
  // Only run the (relatively expensive) description join while the dialog is open.
  const { views, total, failed, blocked, loaded } = usePendingChanges(open);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<PendingChangeView | null>(null);
  const relative = useRelativeTime(locale);

  const formatAmount = useMemo(
    () => (amount: number, currency?: string) =>
      new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount),
    [locale]
  );

  /**
   * Force a drain and report the outcome. `force` matters: the background loop
   * ticks every 15–60s, so an un-forced call frequently collides with a run in
   * progress and returns zeros, which is what made the old retry button look
   * broken.
   */
  const sync = useCallback(async () => {
    if (!online) {
      toast({ variant: 'destructive', title: t('toast.offlineTitle'), description: t('toast.offlineBody') });
      return;
    }
    setSyncing(true);
    try {
      const { runSync } = await import('@/lib/offline/sync');
      const result = await runSync({ force: true });
      if (result.pushed > 0) queryClient.invalidateQueries();

      if (result.pushed === 0 && result.failed === 0 && result.blocked === 0) {
        toast({ title: t('toast.nothingTitle'), description: t('toast.nothingBody') });
      } else if (result.failed === 0 && result.blocked === 0) {
        toast({ title: t('toast.doneTitle'), description: t('toast.doneBody', { count: result.pushed }) });
      } else {
        toast({
          variant: 'destructive',
          title: t('toast.partialTitle'),
          description: t('toast.partialBody', {
            pushed: result.pushed,
            stuck: result.failed + result.blocked,
          }),
        });
      }
    } catch (err) {
      // The old badge swallowed this into an unhandled rejection.
      toast({
        variant: 'destructive',
        title: t('toast.errorTitle'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSyncing(false);
    }
  }, [online, queryClient, t]);

  const retryOne = useCallback(
    async (id: string) => {
      const { unblock } = await import('@/lib/offline/outbox');
      await unblock(id);
      await sync();
    },
    [sync]
  );

  const confirmDiscard = useCallback(async () => {
    if (!discarding) return;
    const { discardEntry } = await import('@/lib/offline/outbox');
    await discardEntry(discarding.id);
    setDiscarding(null);
    toast({ title: t('toast.discardedTitle'), description: t('toast.discardedBody') });
  }, [discarding, t]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {online ? <RefreshCw className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
              {t('title', { count: total })}
            </DialogTitle>
            <DialogDescription className="text-start">
              {online ? t('subtitle') : t('subtitleOffline')}
            </DialogDescription>
          </DialogHeader>

          {total > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {blocked > 0 && <Badge variant="destructive">{t('summary.blocked', { count: blocked })}</Badge>}
              {failed > 0 && <Badge variant="secondary">{t('summary.failed', { count: failed })}</Badge>}
              <Badge variant="outline">
                {t('summary.queued', { count: total - failed - blocked })}
              </Badge>
            </div>
          )}

          <ScrollArea className="max-h-[55vh] pe-2">
            {total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                {loaded ? t('empty') : t('loading')}
              </div>
            ) : (
              <ul className="space-y-2">
                {views.map((view) => {
                  const { icon: Icon, className } = STATE_STYLES[view.state];
                  const isOpen = expanded === view.id;
                  return (
                    <li key={view.id} className="rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <Icon
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            className,
                            view.state === 'syncing' && 'animate-spin'
                          )}
                        />
                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-sm font-medium">{t(`kind.${view.kindKey}`)}</span>
                            {view.docNumber && (
                              <span className="font-mono text-xs text-muted-foreground">
                                {view.docNumber}
                              </span>
                            )}
                            {view.amount !== undefined && (
                              <span className="text-sm font-semibold">
                                {formatAmount(view.amount, view.currency)}
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[
                              view.partyName,
                              relative(view.createdAt),
                              view.attempts > 0 ? t('attempts', { count: view.attempts }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>

                          {view.state === 'waiting' && view.waitingOnLabel && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('waitingFor', { target: view.waitingOnLabel })}
                            </p>
                          )}

                          {view.errorText && (
                            <p
                              className={cn(
                                'mt-1 text-xs',
                                view.state === 'blocked'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {view.lastStatus ? `${view.lastStatus}: ` : ''}
                              {view.errorText}
                            </p>
                          )}

                          {view.state === 'blocked' && (
                            <p className="mt-1 text-xs text-muted-foreground">{t('blockedHint')}</p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!online || syncing}
                              onClick={() => void retryOne(view.id)}
                            >
                              <RefreshCw className={cn('me-1 h-3 w-3', syncing && 'animate-spin')} />
                              {t('actions.retry')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDiscarding(view)}
                            >
                              <Trash2 className="me-1 h-3 w-3" />
                              {t('actions.discard')}
                            </Button>
                            <button
                              type="button"
                              className="inline-flex items-center text-xs text-muted-foreground hover:underline"
                              onClick={() => setExpanded(isOpen ? null : view.id)}
                            >
                              <ChevronRight
                                className={cn(
                                  'h-3 w-3 transition-transform rtl:rotate-180',
                                  isOpen && 'rotate-90 rtl:rotate-90'
                                )}
                              />
                              {t('actions.details')}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="mt-2 overflow-x-auto rounded-md bg-muted p-2">
                              <pre className="text-[11px] leading-relaxed" dir="ltr">
                                {view.method} {view.endpoint}
                                {'\n'}Idempotency-Key: {view.idempotencyKey}
                                {'\n\n'}
                                {JSON.stringify(view.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('actions.close')}
            </Button>
            <Button type="button" disabled={!online || syncing || total === 0} onClick={() => void sync()}>
              <RefreshCw className={cn('me-2 h-4 w-4', syncing && 'animate-spin')} />
              {t('actions.syncNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discarding !== null} onOpenChange={(o) => !o && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discard.title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              {t('discard.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDiscard()}
            >
              {t('actions.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
