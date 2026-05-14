'use client';

/**
 * Journal Entries Page
 *
 * Lists all journal entries with filtering and CRUD operations.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useJournalEntries, usePostJournalEntry, useDeleteJournalEntry } from '@/hooks/use-journal-entries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, MoreHorizontal, Edit2, Trash2, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Link from 'next/link';
import type { VoucherType } from '@erp/shared';

/**
 * Resolve a journal entry's (source_type, source_id) to a detail-page URL.
 * Returns null for 'manual' entries and for *-reversal entries (whose
 * source_id points at the original journal entry, not at a domain row).
 */
function resolveSourceHref(
  locale: string,
  sourceType: string | null | undefined,
  sourceId: string | null | undefined
): string | null {
  if (!sourceType || !sourceId) return null;
  switch (sourceType) {
    case 'sale':
      return `/${locale}/sales/${sourceId}`;
    case 'purchase':
      return `/${locale}/purchases/${sourceId}`;
    case 'payment':
      return `/${locale}/payments/${sourceId}`;
    case 'expense':
      return `/${locale}/expenses/${sourceId}/edit`;
    default:
      return null; // 'manual', reversals, future source types
  }
}

/**
 * Phase 2: short Tally-style label for each voucher type. Matches the
 * entry_number prefix so users see SAL / PUR / RCT / PAY / JNL / CON /
 * CN / DN / COGS / REV consistently across UI and entry numbers.
 */
function voucherLabel(type: VoucherType | string | null | undefined): string {
  switch (type) {
    case 'sales':       return 'SAL';
    case 'purchase':    return 'PUR';
    case 'receipt':     return 'RCT';
    case 'payment':     return 'PAY';
    case 'journal':     return 'JNL';
    case 'contra':      return 'CON';
    case 'credit_note': return 'CN';
    case 'debit_note':  return 'DN';
    case 'cogs':        return 'COGS';
    case 'reversal':    return 'REV';
    default:            return '—';
  }
}

export default function JournalEntriesPage() {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const t = useTranslations('accounting.journal');
  const tCommon = useTranslations('common');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
  });
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);

  const { data, isLoading } = useJournalEntries(filters);
  const postMutation = usePostJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  const handlePost = (id: string) => {
    setTargetEntryId(id);
    setPostDialogOpen(true);
  };

  const confirmPost = async () => {
    if (!targetEntryId) return;
    setPostDialogOpen(false);

    try {
      await postMutation.mutateAsync(targetEntryId);
      toast({
        title: tCommon('success'),
        description: t('list.toast.posted'),
      });
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('list.toast.postError'),
        variant: 'destructive',
      });
    }
    setTargetEntryId(null);
  };

  const handleDelete = (id: string) => {
    setTargetEntryId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!targetEntryId) return;
    setDeleteDialogOpen(false);

    try {
      await deleteMutation.mutateAsync(targetEntryId);
      toast({
        title: tCommon('success'),
        description: t('list.toast.deleted'),
      });
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('list.toast.deleteError'),
        variant: 'destructive',
      });
    }
    setTargetEntryId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
          <p className="text-muted-foreground">{t('list.description')}</p>
        </div>
        <Button onClick={() => router.push(`/${locale}/accounting/journal/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('list.newButton')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data && data.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('list.columns.voucher')}</TableHead>
                  <TableHead>{t('list.columns.entryNumber')}</TableHead>
                  <TableHead>{t('list.columns.date')}</TableHead>
                  <TableHead>{t('list.columns.description')}</TableHead>
                  <TableHead>{t('list.columns.source')}</TableHead>
                  <TableHead>{t('list.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('list.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.voucher_type ? (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {voucherLabel(entry.voucher_type)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), 'PPP')}</TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell className="capitalize">
                      {entry.source_type ? (
                        (() => {
                          const href = resolveSourceHref(
                            locale as string,
                            entry.source_type,
                            entry.source_id
                          );
                          const badge = (
                            <Badge variant="outline" className="font-normal">
                              {entry.source_type.replace('-', ' ')}
                            </Badge>
                          );
                          return href ? (
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 hover:underline"
                              aria-label={t('list.sourceAria', { sourceType: entry.source_type })}
                            >
                              {badge}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </Link>
                          ) : (
                            badge
                          );
                        })()
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.is_posted ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {t('list.status.posted')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('list.status.draft')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!entry.is_posted && (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(`/${locale}/accounting/journal/${entry.id}`)}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                {t('list.actions.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePost(entry.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {t('list.actions.post')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(entry.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('list.actions.delete')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {entry.is_posted && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/${locale}/accounting/journal/${entry.id}`)}
                            >
                              {t('list.actions.view')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t('list.empty', { action: t('list.newButton') })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Confirmation Dialog */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.dialogs.post.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('list.dialogs.post.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPost}>
              {t('list.dialogs.post.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('list.dialogs.delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
