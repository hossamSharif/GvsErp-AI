'use client';

/**
 * Warehouse Detail Page
 *
 * Shows warehouse details and inventory with low stock indicators.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, AlertTriangle, Edit, Settings, TruckIcon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import {
  useWarehouse,
  useWarehouseInventory,
  useLowStockAlerts,
  useUpdateLowStockThreshold,
} from '@/hooks/use-warehouses';
import type { WarehouseInventoryEntry, InventoryQueryParams } from '@erp/shared';

export default function WarehouseDetailPage() {
  const t = useTranslations('warehouses');
  const params = useParams();
  const router = useRouter();
  const warehouseId = params.id as string;

  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [inventoryParams, setInventoryParams] = useState<InventoryQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'itemName',
    sortDir: 'asc',
  });

  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseInventoryEntry | null>(null);
  const [thresholdValue, setThresholdValue] = useState<string>('');

  const { data: warehouseData, isLoading: isLoadingWarehouse } = useWarehouse(warehouseId);
  const { data: inventoryData, isLoading: isLoadingInventory } = useWarehouseInventory(
    warehouseId,
    {
      ...inventoryParams,
      search: searchQuery || undefined,
      lowStockOnly,
    }
  );
  const { data: alertsData } = useLowStockAlerts(warehouseId);
  const updateThresholdMutation = useUpdateLowStockThreshold();

  const warehouse = warehouseData?.data;
  const inventory = inventoryData?.data || [];
  const inventoryMeta = inventoryData?.meta;
  const alerts = alertsData?.data || [];

  const handleOpenThresholdDialog = (item: WarehouseInventoryEntry) => {
    setSelectedItem(item);
    setThresholdValue(item.lowStockThreshold?.toString() || '');
    setIsThresholdDialogOpen(true);
  };

  const handleSaveThreshold = async () => {
    if (!selectedItem) return;

    const threshold = thresholdValue ? parseFloat(thresholdValue) : null;
    await updateThresholdMutation.mutateAsync({
      warehouseId,
      itemId: selectedItem.itemId,
      lowStockThreshold: threshold,
    });
    setIsThresholdDialogOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 3,
    }).format(value);
  };

  if (isLoadingWarehouse) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">{t('warehouseNotFound')}</h2>
        <Button variant="link" onClick={() => router.push('/warehouses')}>
          {t('backToWarehouses')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/warehouses')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{warehouse.name}</h1>
            <p className="text-muted-foreground">{warehouse.address || t('noAddress')}</p>
          </div>
          <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
            {warehouse.isActive ? t('active') : t('inactive')}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/warehouses/${warehouseId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            {t('edit')}
          </Button>
          <Button onClick={() => router.push(`/warehouses/transfers/new?from=${warehouseId}`)}>
            <TruckIcon className="mr-2 h-4 w-4" />
            {t('newTransfer')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalItems')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warehouse.totalItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalQuantity')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(warehouse.totalQuantity)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalValue')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(warehouse.totalValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('lowStockAlerts')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warehouse.lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">{t('inventory')}</TabsTrigger>
          <TabsTrigger value="alerts">
            {t('alerts')}
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder={t('searchItems')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setInventoryParams(prev => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <Button
              variant={lowStockOnly ? 'default' : 'outline'}
              onClick={() => {
                setLowStockOnly(!lowStockOnly);
                setInventoryParams(prev => ({ ...prev, page: 1 }));
              }}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {t('lowStockOnly')}
            </Button>
          </div>

          {/* Inventory Table */}
          <Card>
            <CardContent className="pt-6">
              {isLoadingInventory ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : inventory.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery || lowStockOnly ? t('noResultsFound') : t('noInventory')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('item')}</TableHead>
                      <TableHead>{t('sku')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('available')}</TableHead>
                      <TableHead className="text-right">{t('threshold')}</TableHead>
                      <TableHead className="text-right">{t('value')}</TableHead>
                      <TableHead className="text-center">{t('status')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((item: WarehouseInventoryEntry) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.itemSku || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.quantity)} {item.unitOfMeasure}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.availableQuantity)} {item.unitOfMeasure}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.lowStockThreshold ? formatNumber(item.lowStockThreshold) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.estimatedValue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.isLowStock ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {t('lowStock')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t('inStock')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenThresholdDialog(item)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {inventoryMeta && inventoryMeta.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('showing', {
                      from: (inventoryMeta.page - 1) * inventoryMeta.limit + 1,
                      to: Math.min(inventoryMeta.page * inventoryMeta.limit, inventoryMeta.total),
                      total: inventoryMeta.total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={inventoryMeta.page <= 1}
                      onClick={() =>
                        setInventoryParams(prev => ({ ...prev, page: prev.page! - 1 }))
                      }
                    >
                      {t('previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={inventoryMeta.page >= inventoryMeta.total_pages}
                      onClick={() =>
                        setInventoryParams(prev => ({ ...prev, page: prev.page! + 1 }))
                      }
                    >
                      {t('next')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>{t('lowStockAlerts')}</CardTitle>
              <CardDescription>{t('lowStockAlertsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t('noAlerts')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('item')}</TableHead>
                      <TableHead className="text-right">{t('currentQty')}</TableHead>
                      <TableHead className="text-right">{t('threshold')}</TableHead>
                      <TableHead className="text-right">{t('deficit')}</TableHead>
                      <TableHead className="text-center">{t('severity')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={`${alert.itemId}-${alert.warehouseId}`}>
                        <TableCell className="font-medium">{alert.itemName}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(alert.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(alert.lowStockThreshold)}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          -{formatNumber(alert.deficit)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              alert.percentOfThreshold < 25
                                ? 'destructive'
                                : alert.percentOfThreshold < 50
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {alert.percentOfThreshold < 25
                              ? t('critical')
                              : alert.percentOfThreshold < 50
                              ? t('warning')
                              : t('low')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Threshold Dialog */}
      <Dialog open={isThresholdDialogOpen} onOpenChange={setIsThresholdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('setLowStockThreshold')}</DialogTitle>
            <DialogDescription>
              {selectedItem && t('setThresholdDescription', { item: selectedItem.itemName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="threshold">{t('threshold')}</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                step="0.001"
                placeholder={t('enterThreshold')}
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                {t('thresholdHelp')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsThresholdDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSaveThreshold}
              disabled={updateThresholdMutation.isPending}
            >
              {updateThresholdMutation.isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
