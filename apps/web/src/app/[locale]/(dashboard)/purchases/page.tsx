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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import type { InvoiceStatus, InvoiceQueryParams } from '@erp-saas/shared';

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

export default function PurchasesListPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('purchases');
  const prefetchInvoice = usePrefetchInvoice();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams: InvoiceQueryParams = useMemo(() => ({
    type: 'purchase',
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  }), [searchQuery, statusFilter, page]);

  // Fetch invoices
  const { data, isLoading, error } = useInvoices(queryParams);

  const invoices = data?.data || [];
  const meta = data?.meta;

  // Handle row click
  const handleRowClick = (invoiceId: string) => {
    router.push(`/${locale}/purchases/${invoiceId}`);
  };

  // Handle row hover (prefetch)
  const handleRowHover = (invoiceId: string) => {
    prefetchInvoice(invoiceId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/purchases/new`}>
            <Plus className="h-4 w-4 mr-2" />
            {t('newPurchase')}
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.totalPurchases')}</CardDescription>
            <CardTitle className="text-2xl">{meta?.total || 0}</CardTitle>
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
            <CardDescription>{t('stats.finalized')}</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {invoices.filter(i => i.status === 'final').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.thisMonth')}</CardDescription>
            <CardTitle className="text-2xl">
              {invoices
                .filter(i => i.status === 'final')
                .reduce((sum, i) => sum + i.total, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9 rtl:pl-3 rtl:pr-9"
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
            <Filter className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status.all')}</SelectItem>
            <SelectItem value="draft">{t('status.draft')}</SelectItem>
            <SelectItem value="final">{t('status.finalized')}</SelectItem>
            <SelectItem value="returned">{t('status.returned')}</SelectItem>
            <SelectItem value="canceled">{t('status.canceled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.invoiceNumber')}</TableHead>
                <TableHead>{t('table.supplier')}</TableHead>
                <TableHead>{t('table.date')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('table.total')}</TableHead>
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
                  <TableCell colSpan={6} className="h-32 text-center text-destructive">
                    {t('errorLoading')}
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>{t('noPurchases')}</p>
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
                      onClick={() => handleRowClick(invoice.id)}
                      onMouseEnter={() => handleRowHover(invoice.id)}
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
                        {new Date(invoice.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {t(`status.${invoice.status === 'final' ? 'finalized' : invoice.status}`)}
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('actions.title')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/purchases/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
                                {t('actions.viewDetails')}
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/purchases/${invoice.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
                                  {t('actions.edit')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'final' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/purchases/${invoice.id}?return=true`}>
                                  <Undo2 className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
                                  {t('actions.createReturn')}
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
            {t('pagination.showing', { from: ((page - 1) * 20) + 1, to: Math.min(page * 20, meta.total), total: meta.total })}
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
