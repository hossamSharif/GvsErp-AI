'use client';

/**
 * Invoices Page
 *
 * Combined view for managing sales and purchase invoices with tabs.
 * This page serves as the main entry point for invoice management.
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useInvoices } from '@/hooks/use-invoices';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import type { InvoiceStatus, InvoiceQueryParams, InvoiceType } from '@erp-saas/shared';
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
  ShoppingCart,
  Package,
  Download,
} from 'lucide-react';

export default function InvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const t = useTranslations('invoices');
  const tCommon = useTranslations('common');

  // Status configuration
  const STATUS_CONFIG: Record<
    InvoiceStatus,
    { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    draft: { label: t('status.draft'), icon: Clock, variant: 'secondary' },
    final: { label: t('status.final'), icon: CheckCircle, variant: 'default' },
    returned: { label: t('status.returned'), icon: RotateCcw, variant: 'outline' },
    canceled: { label: t('status.canceled'), icon: XCircle, variant: 'destructive' },
  };

  // Get initial tab from URL or default to 'sale'
  const initialTab = (searchParams.get('tab') as InvoiceType) || 'sale';
  const [activeTab, setActiveTab] = useState<InvoiceType>(initialTab);

  // Filter state for sales
  const [salesSearch, setSalesSearch] = useState('');
  const [salesStatus, setSalesStatus] = useState<InvoiceStatus | 'all'>('all');
  const [salesPage, setSalesPage] = useState(1);

  // Filter state for purchases
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const [purchasesStatus, setPurchasesStatus] = useState<InvoiceStatus | 'all'>('all');
  const [purchasesPage, setPurchasesPage] = useState(1);

  // Build query params for sales
  const salesQueryParams: InvoiceQueryParams = useMemo(
    () => ({
      type: 'sale',
      search: salesSearch || undefined,
      status: salesStatus !== 'all' ? salesStatus : undefined,
      page: salesPage,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    }),
    [salesSearch, salesStatus, salesPage]
  );

  // Build query params for purchases
  const purchasesQueryParams: InvoiceQueryParams = useMemo(
    () => ({
      type: 'purchase',
      search: purchasesSearch || undefined,
      status: purchasesStatus !== 'all' ? purchasesStatus : undefined,
      page: purchasesPage,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
    }),
    [purchasesSearch, purchasesStatus, purchasesPage]
  );

  // Fetch data
  const { data: salesData, isLoading: salesLoading } = useInvoices(salesQueryParams);
  const { data: purchasesData, isLoading: purchasesLoading } = useInvoices(purchasesQueryParams);

  const salesInvoices = salesData?.data || [];
  const salesMeta = salesData?.meta;
  const purchasesInvoices = purchasesData?.data || [];
  const purchasesMeta = purchasesData?.meta;

  // Tab change handler
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as InvoiceType);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Navigation handlers
  const handleRowClick = useCallback(
    (invoiceId: string, type: InvoiceType) => {
      const route = type === 'sale' ? 'sales' : 'purchases';
      router.push(`/${locale}/${route}/${invoiceId}`);
    },
    [router, locale]
  );

  const handleAddInvoice = useCallback(() => {
    const route = activeTab === 'sale' ? 'sales' : 'purchases';
    router.push(`/${locale}/${route}/new`);
  }, [router, locale, activeTab]);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  // Render invoice table
  const renderInvoiceTable = (
    invoices: typeof salesInvoices,
    type: InvoiceType,
    isLoading: boolean,
    meta: typeof salesMeta
  ) => {
    const route = type === 'sale' ? 'sales' : 'purchases';
    const partyLabel = type === 'sale' ? t('fields.customer') : t('fields.supplier');

    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.invoiceNumber')}</TableHead>
                <TableHead>{partyLabel}</TableHead>
                <TableHead>{t('fields.createdAt')}</TableHead>
                <TableHead>{t('fields.status')}</TableHead>
                <TableHead className="text-end">{t('fields.total')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    {tCommon('loading')}...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>
                        {type === 'sale'
                          ? t('noSalesFound')
                          : t('noPurchasesFound')}
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${locale}/${route}/new`}>
                          {type === 'sale' ? t('addSale') : t('addPurchase')}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const statusConfig = STATUS_CONFIG[invoice.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(invoice.id, type)}
                    >
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        {invoice.party?.name || (
                          <span className="text-muted-foreground">
                            {t('messages.walkInCustomer')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {t(`status.${invoice.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('actions.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/${locale}/${route}/${invoice.id}`}>
                                <Eye className="h-4 w-4 me-2" />
                                {t('viewInvoice')}
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/${route}/${invoice.id}/edit`}>
                                  <Edit className="h-4 w-4 me-2" />
                                  {t('editInvoice')}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'final' && type === 'sale' && (
                              <DropdownMenuItem asChild>
                                <Link href={`/${locale}/${route}/${invoice.id}?return=true`}>
                                  <Undo2 className="h-4 w-4 me-2" />
                                  {t('createReturn')}
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
    );
  };

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {activeTab === 'sale'
              ? t('salesDescription')
              : t('purchasesDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {tCommon('export')}
          </Button>
          <Button onClick={handleAddInvoice}>
            <Plus className="me-2 h-4 w-4" />
            {activeTab === 'sale' ? t('addSale') : t('addPurchase')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sale" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('sales')}
            {salesMeta?.total !== undefined && (
              <Badge variant="secondary" className="ms-1">
                {salesMeta.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="purchase" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('purchases')}
            {purchasesMeta?.total !== undefined && (
              <Badge variant="secondary" className="ms-1">
                {purchasesMeta.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sale" className="flex-1 mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Sales</CardDescription>
                <CardTitle className="text-2xl">{salesMeta?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Drafts</CardDescription>
                <CardTitle className="text-2xl text-amber-600">
                  {salesInvoices.filter((i) => i.status === 'draft').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Finalized</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {salesInvoices.filter((i) => i.status === 'final').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>This Page Total</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(
                    salesInvoices
                      .filter((i) => i.status === 'final')
                      .reduce((sum, i) => sum + i.total, 0)
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number..."
                value={salesSearch}
                onChange={(e) => {
                  setSalesSearch(e.target.value);
                  setSalesPage(1);
                }}
                className="ps-9"
              />
            </div>
            <Select
              value={salesStatus}
              onValueChange={(value) => {
                setSalesStatus(value as InvoiceStatus | 'all');
                setSalesPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 me-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">{t('status.draft')}</SelectItem>
                <SelectItem value="final">{t('status.final')}</SelectItem>
                <SelectItem value="returned">{t('status.returned')}</SelectItem>
                <SelectItem value="canceled">{t('status.canceled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {renderInvoiceTable(salesInvoices, 'sale', salesLoading, salesMeta)}

          {/* Pagination */}
          {salesMeta && salesMeta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(salesPage - 1) * 20 + 1} to{' '}
                {Math.min(salesPage * 20, salesMeta.total)} of {salesMeta.total} invoices
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={salesPage === 1}
                  onClick={() => setSalesPage((p) => p - 1)}
                >
                  {tCommon('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={salesPage >= salesMeta.total_pages}
                  onClick={() => setSalesPage((p) => p + 1)}
                >
                  {tCommon('next')}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchase" className="flex-1 mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Purchases</CardDescription>
                <CardTitle className="text-2xl">{purchasesMeta?.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Drafts</CardDescription>
                <CardTitle className="text-2xl text-amber-600">
                  {purchasesInvoices.filter((i) => i.status === 'draft').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Finalized</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {purchasesInvoices.filter((i) => i.status === 'final').length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>This Page Total</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(
                    purchasesInvoices
                      .filter((i) => i.status === 'final')
                      .reduce((sum, i) => sum + i.total, 0)
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number..."
                value={purchasesSearch}
                onChange={(e) => {
                  setPurchasesSearch(e.target.value);
                  setPurchasesPage(1);
                }}
                className="ps-9"
              />
            </div>
            <Select
              value={purchasesStatus}
              onValueChange={(value) => {
                setPurchasesStatus(value as InvoiceStatus | 'all');
                setPurchasesPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 me-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">{t('status.draft')}</SelectItem>
                <SelectItem value="final">{t('status.final')}</SelectItem>
                <SelectItem value="returned">{t('status.returned')}</SelectItem>
                <SelectItem value="canceled">{t('status.canceled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {renderInvoiceTable(purchasesInvoices, 'purchase', purchasesLoading, purchasesMeta)}

          {/* Pagination */}
          {purchasesMeta && purchasesMeta.total_pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(purchasesPage - 1) * 20 + 1} to{' '}
                {Math.min(purchasesPage * 20, purchasesMeta.total)} of {purchasesMeta.total}{' '}
                invoices
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={purchasesPage === 1}
                  onClick={() => setPurchasesPage((p) => p - 1)}
                >
                  {tCommon('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={purchasesPage >= purchasesMeta.total_pages}
                  onClick={() => setPurchasesPage((p) => p + 1)}
                >
                  {tCommon('next')}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
