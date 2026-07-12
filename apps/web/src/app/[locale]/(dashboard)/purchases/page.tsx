'use client';

/**
 * Purchases List Page
 *
 * Displays all purchase invoices with filtering, sorting, and pagination.
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Undo2,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useInvoices, usePrefetchInvoice, useDeleteInvoice } from '@/hooks/use-invoices';
import { useUsers } from '@/hooks/use-users';
import type { InvoiceStatus, InvoiceQueryParams, InvoiceWithParty } from '@erp/shared';

const STATUS_ICONS: Record<InvoiceStatus, { icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { icon: Clock, variant: 'secondary' },
  final: { icon: CheckCircle, variant: 'default' },
  returned: { icon: RotateCcw, variant: 'outline' },
  canceled: { icon: XCircle, variant: 'destructive' },
};

export default function PurchasesListPage() {
  const router = useRouter();
  const { locale } = useParams();
  const prefetchInvoice = usePrefetchInvoice();
  const { toast } = useToast();
  const t = useTranslations('purchases.list');
  const tStatus = useTranslations('sales.status');
  const tActions = useTranslations('purchases.actions');
  const tDetail = useTranslations('purchases.detail');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Users for the "created by" filter + resolving creator names in the table.
  // Degrades gracefully offline (the /users list is network-only).
  const { data: usersData } = useUsers({ limit: 100, includeInactive: true });
  const users = usersData?.data ?? [];
  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name || u.email])),
    [users]
  );
  const hasActiveFilters =
    statusFilter !== 'all' || userFilter !== 'all' || dateFrom !== '' || dateTo !== '';
  const clearFilters = () => {
    setStatusFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceWithParty | null>(null);
  const deleteInvoice = useDeleteInvoice();

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteInvoice.mutateAsync(invoiceToDelete.id);
      toast({
        title: tDetail('toasts.deleted'),
        description: tDetail('toasts.deletedDescription'),
      });
      setInvoiceToDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : tDetail('toasts.deleteFailed');
      const lower = message.toLowerCase();
      const title =
        lower.includes('payment') ? tDetail('toasts.blockedByPayments')
        : lower.includes('return') ? tDetail('toasts.blockedByReturn')
        : tDetail('toasts.deleteFailed');
      toast({
        variant: 'destructive',
        title,
        description: message,
      });
    }
  };

  const queryParams: InvoiceQueryParams = useMemo(() => ({
    type: 'purchase',
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    createdBy: userFilter !== 'all' ? userFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  }), [searchQuery, statusFilter, userFilter, dateFrom, dateTo, page]);

  const { data, isLoading, error } = useInvoices(queryParams);

  const invoices = data?.data || [];
  const meta = data?.meta;

  const handleRowClick = (invoiceId: string) => {
    router.push(`/${locale}/purchases/${invoiceId}`);
  };

  const handleRowHover = (invoiceId: string) => {
    prefetchInvoice(invoiceId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/purchases/new`}>
            <Plus className="h-4 w-4 mr-2" />
            {t('newPurchase')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.totalPurchases')}</CardDescription>
            <CardTitle className="text-2xl">{meta?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.showing')}</CardDescription>
            <CardTitle className="text-2xl">
              {invoices.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {t('stats.showingOf', { count: meta?.total || 0 })}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.drafts')}</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {invoices.filter(i => i.status === 'draft').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.filteredTotal')}</CardDescription>
            <CardTitle className="text-2xl">
              {(meta?.totalAmount ?? invoices.reduce((sum, i) => sum + i.total, 0))
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchAriaLabel')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as InvoiceStatus | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('filterPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tStatus('all')}</SelectItem>
            <SelectItem value="draft">{tStatus('draft')}</SelectItem>
            <SelectItem value="final">{tStatus('final')}</SelectItem>
            <SelectItem value="returned">{tStatus('returned')}</SelectItem>
            <SelectItem value="canceled">{tStatus('canceled')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Filter by the user who created the invoice */}
        <Select
          value={userFilter}
          onValueChange={(value) => {
            setUserFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <User className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('filters.userPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allUsers')}</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter by date range (invoice creation date) */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label={t('filters.dateFrom')}
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-[150px]"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            aria-label={t('filters.dateTo')}
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-[150px]"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0">
            <X className="h-4 w-4 mr-2" />
            {t('filters.clear')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.invoiceNumber')}</TableHead>
                <TableHead>{t('columns.supplier')}</TableHead>
                <TableHead>{t('columns.user')}</TableHead>
                <TableHead>{t('columns.date')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead className="text-right">{t('columns.total')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-destructive">
                    {t('errorLoad')}
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>{t('empty')}</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${locale}/purchases/new`}>{t('createFirst')}</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const statusConfig = STATUS_ICONS[invoice.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="link"
                      aria-label={t('viewAriaLabel', { number: invoice.invoiceNumber })}
                      onClick={() => handleRowClick(invoice.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(invoice.id);
                        }
                      }}
                      onMouseEnter={() => handleRowHover(invoice.id)}
                      onFocus={() => handleRowHover(invoice.id)}
                    >
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {invoice.party?.name || (
                          <span className="text-muted-foreground">{t('noSupplier')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.createdBy && usersById.get(invoice.createdBy) ? (
                          usersById.get(invoice.createdBy)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {tStatus(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('actionsAriaLabel')}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuLabel>{tActions('label')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/purchases/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                {tActions('view')}
                              </Link>
                            </DropdownMenuItem>
                            {(invoice.status === 'draft' || invoice.status === 'final') && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/purchases/${invoice.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {tActions('edit')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'final' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/purchases/${invoice.id}?return=true`}>
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  {tActions('createReturn')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                setInvoiceToDelete(invoice);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tActions('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('pagination.summary', {
              from: ((page - 1) * 20) + 1,
              to: Math.min(page * 20, meta.total),
              total: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={invoiceToDelete !== null}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDetail('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {invoiceToDelete?.status === 'final'
                ? tDetail('deleteDialog.bodyFinal')
                : invoiceToDelete?.status === 'returned'
                ? tDetail('deleteDialog.bodyReturned')
                : invoiceToDelete?.status === 'canceled'
                ? tDetail('deleteDialog.bodyCanceled')
                : tDetail('deleteDialog.bodyDraft')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceToDelete(null)}>
              {tDetail('deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending
                ? tDetail('deleteDialog.pending')
                : tDetail('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
