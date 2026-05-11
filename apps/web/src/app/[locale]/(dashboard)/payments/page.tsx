'use client';

/**
 * Payments List Page
 *
 * Main page for viewing and managing payments with:
 * - Paginated data table
 * - Filter by type, party, date range
 * - Quick actions (view, delete)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { usePayments, useDeletePayment } from '@/hooks/use-payments';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { PaymentWithParty, PaymentQueryParams } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

export default function PaymentsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const intlLocale = useLocale();
  const t = useTranslations('payments.list');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  // Query state
  const [queryParams, setQueryParams] = useState<PaymentQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'paymentDate',
    sortDir: 'desc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentWithParty | null>(null);

  // Fetch payments
  const { data, isLoading, error } = usePayments(queryParams);

  // Delete mutation
  const deleteMutation = useDeletePayment({
    onSuccess: () => {
      toast({
        title: t('toast.deleted'),
        description: t('toast.deletedDesc'),
      });
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toast.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handlePageChange = useCallback((page: number, limit: number) => {
    setQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleSortChange = useCallback((sorting: { id: string; desc: boolean }[]) => {
    if (sorting.length > 0) {
      setQueryParams((prev) => ({
        ...prev,
        sortBy: sorting[0].id as PaymentQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleTypeFilter = useCallback((type: string) => {
    setQueryParams((prev) => ({
      ...prev,
      type: type === 'all' ? undefined : (type as 'received' | 'made'),
      page: 1,
    }));
  }, []);

  const handleRecordPayment = useCallback(() => {
    router.push(`/${locale}/payments/new`);
  }, [router, locale]);

  const handleViewPayment = useCallback(
    (payment: PaymentWithParty) => {
      router.push(`/${locale}/payments/${payment.id}`);
    },
    [router, locale]
  );

  const handleEditPayment = useCallback(
    (payment: PaymentWithParty) => {
      router.push(`/${locale}/payments/${payment.id}/edit`);
    },
    [router, locale]
  );

  const handleDeletePayment = useCallback((payment: PaymentWithParty) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (paymentToDelete) {
      deleteMutation.mutate({
        id: paymentToDelete.id,
        partyId: paymentToDelete.partyId,
      });
    }
  }, [paymentToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    router.push(`/${locale}/payments/report`);
  }, [router, locale]);

  // Format currency
  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }, []);

  // Format date
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString(intlLocale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [intlLocale]);

  // Table columns
  const columns = useMemo<ColumnDef<PaymentWithParty>[]>(
    () => [
      {
        accessorKey: 'reference',
        header: t('columns.reference'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.reference || '—'}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('columns.type'),
        cell: ({ row }) => {
          const isReceived = row.original.type === 'received';
          return (
            <Badge variant={isReceived ? 'default' : 'secondary'}>
              {isReceived ? (
                <>
                  <ArrowDownCircle className="mr-1 h-3 w-3" />
                  {t('type.received')}
                </>
              ) : (
                <>
                  <ArrowUpCircle className="mr-1 h-3 w-3" />
                  {t('type.made')}
                </>
              )}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'party',
        header: t('columns.party'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.party.name}</span>
            <span className="text-xs text-muted-foreground">
              {t(`type.${row.original.party.type}` as any)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('columns.amount'),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        header: t('columns.method'),
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.paymentMethod?.replace('_', ' ') || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'paymentDate',
        header: t('columns.date'),
        cell: ({ row }) => formatDate(row.original.paymentDate),
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('menuOpen')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewPayment(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('actions.view')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditPayment(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeletePayment(row.original)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleViewPayment, handleEditPayment, handleDeletePayment, formatCurrency, formatDate, t, tCommon]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            {t('exportButton')}
          </Button>
          <Button onClick={handleRecordPayment}>
            <Plus className="mr-2 h-4 w-4" />
            {t('recordButton')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('filterLabel')}</span>
        </div>
        <Select
          value={queryParams.type || 'all'}
          onValueChange={handleTypeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filterAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="received">{t('filterReceived')}</SelectItem>
            <SelectItem value="made">{t('filterMade')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        pageCount={data?.meta.total ? Math.ceil(data.meta.total / queryParams.limit!) : 0}
        pageIndex={queryParams.page! - 1}
        pageSize={queryParams.limit!}
        onPageChange={handlePageChange}
        onSortingChange={handleSortChange}
        onSearchChange={handleSearch}
        searchPlaceholder={t('searchPlaceholder')}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', {
                reference: paymentToDelete?.reference || paymentToDelete?.id?.slice(0, 8) || '',
              })}
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
