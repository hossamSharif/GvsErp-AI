'use client';

/**
 * Sales List Page
 *
 * Displays all sales invoices with filtering, sorting, and pagination.
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInvoices, usePrefetchInvoice } from '@/hooks/use-invoices';
import type { InvoiceStatus, InvoiceQueryParams } from '@erp/shared';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_ICONS: Record<InvoiceStatus, { icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { icon: Clock, variant: 'secondary' },
  final: { icon: CheckCircle, variant: 'default' },
  returned: { icon: RotateCcw, variant: 'outline' },
  canceled: { icon: XCircle, variant: 'destructive' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function SalesListPage() {
  const router = useRouter();
  const { locale } = useParams();
  const prefetchInvoice = usePrefetchInvoice();
  const t = useTranslations('sales.list');
  const tStatus = useTranslations('sales.status');
  const tActions = useTranslations('sales.actions');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams: InvoiceQueryParams = useMemo(() => ({
    type: 'sale',
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  }), [searchQuery, statusFilter, page]);

  // Fetch invoices
  const { data, isLoading, error, refetch } = useInvoices(queryParams);

  const invoices = data?.data || [];
  const meta = data?.meta;

  // Handle row click
  const handleRowClick = (invoiceId: string) => {
    router.push(`/${locale}/sales/${invoiceId}`);
  };

  // Handle row hover (prefetch)
  const handleRowHover = (invoiceId: string) => {
    prefetchInvoice(invoiceId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/sales/new`}>
            <Plus className="h-4 w-4 mr-2" />
            {t('newSale')}
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.totalSales')}</CardDescription>
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
            <CardDescription>{t('stats.pageTotal')}</CardDescription>
            <CardTitle className="text-2xl">
              {invoices
                .reduce((sum, i) => sum + i.total, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
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
          <SelectTrigger className="w-[180px]">
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
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.invoiceNumber')}</TableHead>
                <TableHead>{t('columns.customer')}</TableHead>
                <TableHead>{t('columns.date')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead className="text-right">{t('columns.total')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-destructive">
                      <p>{t('errorLoad')}</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()}>
                        {t('tryAgain')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>{t('empty')}</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${locale}/sales/new`}>{t('createFirst')}</Link>
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
                          <span className="text-muted-foreground">{t('walkIn')}</span>
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
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{tActions('label')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/sales/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                {tActions('view')}
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/sales/${invoice.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  {tActions('edit')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'final' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/sales/${invoice.id}?return=true`}>
                                  <Undo2 className="h-4 w-4 mr-2" />
                                  {tActions('createReturn')}
                                </Link>
                              </DropdownMenuItem>
                            )}
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

      {/* Pagination */}
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
    </div>
  );
}
