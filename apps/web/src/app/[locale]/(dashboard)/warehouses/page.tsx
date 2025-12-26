'use client';

/**
 * Warehouses List Page
 *
 * Displays a list of warehouses with summary information and actions.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Package, AlertTriangle, Building2, Search, MoreHorizontal, Settings, TruckIcon, FileBarChart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useWarehouses,
  useDeactivateWarehouse,
  useLowStockSummary,
} from '@/hooks/use-warehouses';
import type { Warehouse, WarehouseQueryParams } from '@erp-saas/shared';
import { CreateWarehouseDialog } from '@/components/dialogs/create-warehouse-dialog';

export default function WarehousesPage() {
  const t = useTranslations('warehouses');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [queryParams, setQueryParams] = useState<WarehouseQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  const { data: warehousesData, isLoading, error } = useWarehouses({
    ...queryParams,
    search: searchQuery || undefined,
  });

  const { data: alertSummary } = useLowStockSummary();
  const deactivateMutation = useDeactivateWarehouse();

  const warehouses = warehousesData?.data || [];
  const meta = warehousesData?.meta;

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setQueryParams(prev => ({ ...prev, page: 1 }));
  };

  const handleDeactivate = async (id: string) => {
    if (confirm(t('confirmDeactivate'))) {
      await deactivateMutation.mutateAsync(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/${locale}/warehouses/report`)}>
            <FileBarChart className="mr-2 h-4 w-4" />
            {t('report')}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/${locale}/warehouses/settings`)}>
            <Settings className="mr-2 h-4 w-4" />
            {t('settings')}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/${locale}/warehouses/transfers`)}>
            <TruckIcon className="mr-2 h-4 w-4" />
            {t('transfers')}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addWarehouse')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalWarehouses')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta?.total || 0}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push(`/${locale}/warehouses/settings`)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('lowStockAlerts')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {alertSummary?.data?.totalAlerts || 0}
            </div>
            {alertSummary?.data?.criticalCount ? (
              <p className="text-xs text-red-500">
                {alertSummary.data.criticalCount} {t('critical')}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalItems')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalValue')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('warehousesList')}</CardTitle>
          <CardDescription>{t('warehousesListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              {t('errorLoading')}
            </div>
          ) : warehouses.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? t('noResultsFound') : t('noWarehouses')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('address')}</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((warehouse: Warehouse) => (
                  <TableRow
                    key={warehouse.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/${locale}/warehouses/${warehouse.id}`)}
                  >
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.address || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
                        {warehouse.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${locale}/warehouses/${warehouse.id}`);
                            }}
                          >
                            {t('view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${locale}/warehouses/${warehouse.id}/edit`);
                            }}
                          >
                            {t('edit')}
                          </DropdownMenuItem>
                          {warehouse.isActive && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeactivate(warehouse.id);
                              }}
                              className="text-red-600"
                            >
                              {t('deactivate')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t('showing', {
                  from: (meta.page - 1) * meta.limit + 1,
                  to: Math.min(meta.page * meta.limit, meta.total),
                  total: meta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setQueryParams(prev => ({ ...prev, page: prev.page! - 1 }))}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.total_pages}
                  onClick={() => setQueryParams(prev => ({ ...prev, page: prev.page! + 1 }))}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateWarehouseDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
