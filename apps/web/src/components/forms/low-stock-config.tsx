'use client';

/**
 * Low Stock Configuration Component
 *
 * Allows users to configure low stock thresholds for items across warehouses.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Save, Settings, Search, Check } from 'lucide-react';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

import {
  useActiveWarehouses,
  useWarehouseInventory,
  useUpdateLowStockThreshold,
} from '@/hooks/use-warehouses';
import type { Warehouse, WarehouseInventoryEntry } from '@erp/shared';

// Bulk update schema
const bulkUpdateSchema = z.object({
  threshold: z.coerce.number().min(0, 'Threshold must be 0 or greater'),
});

type BulkUpdateFormValues = z.infer<typeof bulkUpdateSchema>;

interface LowStockConfigProps {
  warehouseId?: string;
  onClose?: () => void;
}

export function LowStockConfig({ warehouseId: initialWarehouseId, onClose }: LowStockConfigProps) {
  const t = useTranslations('warehouses');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: warehousesData } = useActiveWarehouses();
  const { data: inventoryData, isLoading: isLoadingInventory } = useWarehouseInventory(
    selectedWarehouseId,
    {
      search: searchQuery || undefined,
      limit: 100,
      sortBy: 'itemName',
      sortDir: 'asc',
    },
    { enabled: !!selectedWarehouseId }
  );

  const updateThresholdMutation = useUpdateLowStockThreshold();

  const warehouses = warehousesData?.data || [];
  const inventory = inventoryData?.data || [];

  const form = useForm<BulkUpdateFormValues>({
    resolver: zodResolver(bulkUpdateSchema),
    defaultValues: {
      threshold: 10,
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(inventory.map((item) => item.itemId)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSet = new Set(selectedItems);
    if (checked) {
      newSet.add(itemId);
    } else {
      newSet.delete(itemId);
    }
    setSelectedItems(newSet);
  };

  const handleInlineEdit = async (item: WarehouseInventoryEntry) => {
    const threshold = editValue ? parseFloat(editValue) : null;
    await updateThresholdMutation.mutateAsync({
      warehouseId: selectedWarehouseId,
      itemId: item.itemId,
      lowStockThreshold: threshold,
    });
    setEditingItem(null);
    setEditValue('');
  };

  const handleBulkUpdate = async (values: BulkUpdateFormValues) => {
    if (selectedItems.size === 0) return;

    const updatePromises = Array.from(selectedItems).map((itemId) =>
      updateThresholdMutation.mutateAsync({
        warehouseId: selectedWarehouseId,
        itemId,
        lowStockThreshold: values.threshold,
      })
    );

    await Promise.all(updatePromises);
    setSelectedItems(new Set());
  };

  const startEditing = (item: WarehouseInventoryEntry) => {
    setEditingItem(item.itemId);
    setEditValue(item.lowStockThreshold?.toString() || '');
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 3,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('lowStockConfiguration')}
          </CardTitle>
          <CardDescription>{t('lowStockConfigDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warehouse Selection */}
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse: Warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedWarehouseId && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder={t('searchItems')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>

          {/* Bulk Update Form */}
          {selectedWarehouseId && selectedItems.size > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleBulkUpdate)}
                    className="flex items-end gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedItems.size} {t('itemsSelected')}</Badge>
                    </div>
                    <FormField
                      control={form.control}
                      name="threshold"
                      render={({ field }) => (
                        <FormItem className="flex-1 max-w-[200px]">
                          <FormLabel>{t('newThreshold')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="0"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={updateThresholdMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {t('applyToSelected')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedItems(new Set())}
                    >
                      {t('clearSelection')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Inventory Table */}
      {selectedWarehouseId && (
        <Card>
          <CardHeader>
            <CardTitle>{t('itemThresholds')}</CardTitle>
            <CardDescription>{t('itemThresholdsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInventory ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : inventory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? t('noResultsFound') : t('noInventory')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          inventory.length > 0 &&
                          selectedItems.size === inventory.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t('item')}</TableHead>
                    <TableHead>{t('sku')}</TableHead>
                    <TableHead className="text-right">{t('currentQty')}</TableHead>
                    <TableHead className="text-right">{t('threshold')}</TableHead>
                    <TableHead className="text-center">{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item: WarehouseInventoryEntry) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.itemId)}
                          onCheckedChange={(checked) =>
                            handleSelectItem(item.itemId, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>{item.itemSku || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.quantity)} {item.unitOfMeasure}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingItem === item.itemId ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 h-8"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleInlineEdit(item);
                                } else if (e.key === 'Escape') {
                                  setEditingItem(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleInlineEdit(item)}
                              disabled={updateThresholdMutation.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:underline rounded px-1 focus:outline-none focus:ring-2 focus:ring-ring"
                            role="button"
                            tabIndex={0}
                            aria-label={`Edit threshold for ${item.itemName}: ${item.lowStockThreshold ? formatNumber(item.lowStockThreshold) : t('notSet')}`}
                            onClick={() => startEditing(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                startEditing(item);
                              }
                            }}
                          >
                            {item.lowStockThreshold
                              ? formatNumber(item.lowStockThreshold)
                              : t('notSet')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.lowStockThreshold ? (
                          item.isLowStock ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {t('lowStock')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t('ok')}</Badge>
                          )
                        ) : (
                          <Badge variant="secondary">{t('noThreshold')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(item)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Presets */}
      {selectedWarehouseId && inventory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('quickPresets')}</CardTitle>
            <CardDescription>{t('quickPresetsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItems(new Set(inventory.map((i) => i.itemId)));
                  form.setValue('threshold', 5);
                }}
              >
                {t('setAll')} 5 {t('units')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItems(new Set(inventory.map((i) => i.itemId)));
                  form.setValue('threshold', 10);
                }}
              >
                {t('setAll')} 10 {t('units')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItems(new Set(inventory.map((i) => i.itemId)));
                  form.setValue('threshold', 25);
                }}
              >
                {t('setAll')} 25 {t('units')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedItems(new Set(inventory.map((i) => i.itemId)));
                  form.setValue('threshold', 50);
                }}
              >
                {t('setAll')} 50 {t('units')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Select only items without thresholds
                  const noThreshold = inventory.filter((i) => !i.lowStockThreshold);
                  setSelectedItems(new Set(noThreshold.map((i) => i.itemId)));
                }}
              >
                {t('selectUnset')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Select only low stock items
                  const lowStock = inventory.filter((i) => i.isLowStock);
                  setSelectedItems(new Set(lowStock.map((i) => i.itemId)));
                }}
              >
                {t('selectLowStock')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Actions */}
      {onClose && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      )}
    </div>
  );
}
