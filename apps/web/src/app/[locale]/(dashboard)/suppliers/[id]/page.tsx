'use client';

/**
 * Supplier Detail Page
 *
 * Page for viewing supplier details with:
 * - Supplier information
 * - Current balance
 * - Transaction history (invoices and payments)
 * - Quick actions (edit, make payment)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useParty, usePartyStatement, useRecalculateBalance } from '@/hooks/use-parties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/tables/data-table';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { PartyTransaction } from '@erp-saas/shared';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  RefreshCw,
  Pencil,
  Receipt,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const supplierId = params.id as string;
  const { toast } = useToast();
  const t = useTranslations('parties');
  const tCommon = useTranslations('common');

  // Date range for statement (last 3 months by default)
  const [dateRange] = useState({
    dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  // Fetch supplier data
  const {
    data: supplierData,
    isLoading: isSupplierLoading,
    error: supplierError,
  } = useParty(supplierId);

  // Fetch transaction statement
  const {
    data: statementData,
    isLoading: isStatementLoading,
  } = usePartyStatement({
    partyId: supplierId,
    ...dateRange,
  });

  // Recalculate balance mutation
  const recalculateMutation = useRecalculateBalance({
    onSuccess: (response) => {
      toast({
        title: t('detail.balanceRecalculated'),
        description: t('detail.newBalance', { balance: response.data.balance.toFixed(2) }),
      });
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('detail.recalculateError'),
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleEdit = useCallback(() => {
    router.push(`/${locale}/suppliers/${supplierId}/edit`);
  }, [router, locale, supplierId]);

  const handleMakePayment = useCallback(() => {
    router.push(`/${locale}/payments/new?partyId=${supplierId}&type=made`);
  }, [router, locale, supplierId]);

  const handleRecalculateBalance = useCallback(() => {
    recalculateMutation.mutate(supplierId);
  }, [recalculateMutation, supplierId]);

  const handleBack = useCallback(() => {
    router.push(`/${locale}/suppliers`);
  }, [router, locale]);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  // Format date
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Transaction table columns
  const columns = useMemo<ColumnDef<PartyTransaction>[]>(
    () => [
      {
        accessorKey: 'date',
        header: t('transactions.date'),
        cell: ({ row }) => formatDate(row.original.date),
      },
      {
        accessorKey: 'type',
        header: t('transactions.type'),
        cell: ({ row }) => (
          <Badge variant={row.original.type === 'invoice' ? 'default' : 'secondary'}>
            {row.original.type === 'invoice' ? tCommon('invoice') : tCommon('payment')}
          </Badge>
        ),
      },
      {
        accessorKey: 'reference',
        header: tCommon('reference'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.reference}</span>
        ),
      },
      {
        accessorKey: 'description',
        header: tCommon('description'),
        cell: ({ row }) => row.original.description || '-',
      },
      {
        accessorKey: 'debit',
        header: t('balance.debit'),
        cell: ({ row }) => (
          <span className={cn('font-medium', row.original.debit > 0 && 'text-red-600')}>
            {row.original.debit > 0 ? formatCurrency(row.original.debit) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'credit',
        header: t('balance.credit'),
        cell: ({ row }) => (
          <span className={cn('font-medium', row.original.credit > 0 && 'text-green-600')}>
            {row.original.credit > 0 ? formatCurrency(row.original.credit) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'balance',
        header: t('fields.balance'),
        cell: ({ row }) => (
          <span className={cn('font-medium', {
            'text-red-600': row.original.balance > 0,
            'text-green-600': row.original.balance < 0,
          })}>
            {formatCurrency(row.original.balance)}
          </span>
        ),
      },
    ],
    [formatCurrency, formatDate, t, tCommon]
  );

  // Loading state
  if (isSupplierLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Error state
  if (supplierError || !supplierData?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8">
        <p className="text-destructive">
          {supplierError?.message || t('detail.supplierNotFound')}
        </p>
        <Button onClick={handleBack}>{t('detail.backToSuppliers')}</Button>
      </div>
    );
  }

  const supplier = supplierData.data;
  const statement = statementData?.data;
  const balance = supplier.balance || 0;

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <p className="text-muted-foreground">{t('detail.pageDescription', { party: t('suppliers') })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Pencil className="me-2 h-4 w-4" />
            {t('detail.edit')}
          </Button>
          <Button onClick={handleMakePayment}>
            <DollarSign className="me-2 h-4 w-4" />
            {t('makePayment')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Supplier Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.contactInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.email}</span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{supplier.phone}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{supplier.address}</span>
              </div>
            )}
            {supplier.taxNumber && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t('fields.taxNumber')}: {supplier.taxNumber}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{tCommon('status')}</span>
              <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                {supplier.isActive ? tCommon('active') : tCommon('inactive')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.currentBalance')}</CardTitle>
            <CardDescription>{t('detail.outstandingPayable')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {balance > 0 ? (
                <TrendingUp className="h-8 w-8 text-red-600" />
              ) : balance < 0 ? (
                <TrendingDown className="h-8 w-8 text-green-600" />
              ) : (
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className={cn('text-3xl font-bold', {
                  'text-red-600': balance > 0,
                  'text-green-600': balance < 0,
                  'text-muted-foreground': balance === 0,
                })}>
                  {formatCurrency(Math.abs(balance))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {balance > 0 ? t('detail.weOwe') : balance < 0 ? t('detail.overpaid') : t('detail.settled')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateBalance}
              disabled={recalculateMutation.isPending}
              className="w-full"
            >
              <RefreshCw className={cn('me-2 h-4 w-4', recalculateMutation.isPending && 'animate-spin')} />
              {t('detail.recalculateBalance')}
            </Button>
          </CardContent>
        </Card>

        {/* Summary Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.summary')}</CardTitle>
            <CardDescription>{t('detail.transactionTotals')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statement && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.totalInvoiced')}</span>
                  <span className="font-medium">{formatCurrency(statement.totalDebits)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.totalPaid')}</span>
                  <span className="font-medium">{formatCurrency(statement.totalCredits)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.transactions')}</span>
                  <Badge variant="outline">{statement.transactions.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.period')}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(statement.dateFrom)} - {formatDate(statement.dateTo)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.transactionHistory')}</CardTitle>
          <CardDescription>
            {t('detail.transactionHistoryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isStatementLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : statement && statement.transactions.length > 0 ? (
            <DataTable
              columns={columns}
              data={statement.transactions}
              pageCount={1}
              pageIndex={0}
              pageSize={statement.transactions.length}
              onPageChange={() => {}}
              onSortingChange={() => {}}
              isLoading={false}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('detail.noTransactions')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('form.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {supplier.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
