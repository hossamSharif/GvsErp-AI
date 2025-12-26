'use client';

/**
 * Items List Page
 *
 * Main page for managing inventory items with:
 * - Paginated data table
 * - Search and filters
 * - Bulk actions
 * - Quick actions (add, edit, delete)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useItems, useDeleteItem, useBulkUpdatePrices, itemKeys } from '@/hooks/use-items';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { ItemWithCategory, ItemQueryParams, BulkPriceUpdateInput } from '@erp-saas/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  Filter,
  DollarSign,
  Loader2,
} from 'lucide-react';

// Price tiers available for update
const PRICE_TIERS = [
  { value: 'retail', label: 'Retail Price' },
  { value: 'wholesale', label: 'Wholesale Price' },
  { value: 'distributor', label: 'Distributor Price' },
];

// Currencies
const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'EGP', label: 'EGP' },
  { value: 'SAR', label: 'SAR' },
  { value: 'AED', label: 'AED' },
];

export default function ItemsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('items');
  const tc = useTranslations('common');
  const tt = useTranslations('table');

  // Query state
  const [queryParams, setQueryParams] = useState<ItemQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // UI state
  const [selectedItems, setSelectedItems] = useState<ItemWithCategory[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemWithCategory | null>(null);

  // Bulk price update state
  const [bulkPriceDialogOpen, setBulkPriceDialogOpen] = useState(false);
  const [bulkPriceForm, setBulkPriceForm] = useState({
    adjustmentType: 'percentage' as 'percentage' | 'fixed',
    adjustmentValue: '',
    priceTier: 'retail',
    currency: 'USD',
  });

  // Fetch items
  const { data, isLoading, error } = useItems(queryParams);

  // Delete mutation
  const deleteMutation = useDeleteItem({
    onSuccess: () => {
      toast({
        title: t('messages.itemDeleted'),
        description: t('messages.itemDeletedSuccess'),
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Bulk price update mutation
  const bulkPriceMutation = useBulkUpdatePrices({
    onSuccess: (response) => {
      toast({
        title: t('messages.pricesUpdated'),
        description: t('messages.pricesUpdatedSuccess', { count: response.data.updatedCount }),
      });
      setBulkPriceDialogOpen(false);
      setSelectedItems([]);
      setBulkPriceForm({
        adjustmentType: 'percentage',
        adjustmentValue: '',
        priceTier: 'retail',
        currency: 'USD',
      });
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.pricesUpdateError'),
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
        sortBy: sorting[0].id as ItemQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleAddItem = useCallback(() => {
    router.push(`/${locale}/items/new`);
  }, [router, locale]);

  const handleEditItem = useCallback(
    (item: ItemWithCategory) => {
      router.push(`/${locale}/items/${item.id}`);
    },
    [router, locale]
  );

  const handleViewItem = useCallback(
    (item: ItemWithCategory) => {
      router.push(`/${locale}/items/${item.id}`);
    },
    [router, locale]
  );

  const handleDeleteItem = useCallback((item: ItemWithCategory) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id);
    }
  }, [itemToDelete, deleteMutation]);

  const handleBulkPriceUpdate = useCallback(() => {
    setBulkPriceDialogOpen(true);
  }, []);

  const submitBulkPriceUpdate = useCallback(() => {
    const value = parseFloat(bulkPriceForm.adjustmentValue);
    if (isNaN(value)) {
      toast({
        title: t('messages.invalidValue'),
        description: t('messages.invalidValueDesc'),
        variant: 'destructive',
      });
      return;
    }

    const input: BulkPriceUpdateInput = {
      itemIds: selectedItems.map((item) => item.id),
      adjustmentType: bulkPriceForm.adjustmentType,
      adjustmentValue: value,
      priceTier: bulkPriceForm.priceTier,
      currency: bulkPriceForm.currency,
    };

    bulkPriceMutation.mutate(input);
  }, [selectedItems, bulkPriceForm, bulkPriceMutation, toast]);

  const handleExportPdf = useCallback(() => {
    router.push(`/${locale}/items/report`);
  }, [router, locale]);

  // Table columns
  const columns: ColumnDef<ItemWithCategory>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('fields.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.nameAlias && (
              <span className="text-xs text-muted-foreground">
                {row.original.nameAlias}
              </span>
            )}
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: 'sku',
        header: t('fields.sku'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.sku || '-'}</span>
        ),
        size: 120,
      },
      {
        accessorKey: 'barcode',
        header: t('fields.barcode'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.barcode || '-'}</span>
        ),
        size: 140,
      },
      {
        accessorKey: 'brand',
        header: t('fields.brand'),
        cell: ({ row }) => row.original.brand || '-',
        size: 120,
      },
      {
        accessorKey: 'category',
        header: t('fields.category'),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.category?.name || t('uncategorized')}</Badge>
        ),
        size: 150,
      },
      {
        accessorKey: 'unitOfMeasure',
        header: t('fields.unitOfMeasure'),
        cell: ({ row }) => row.original.unitOfMeasure,
        size: 80,
      },
      {
        accessorKey: 'taxRate',
        header: t('fields.taxRate'),
        cell: ({ row }) => `${row.original.taxRate}%`,
        size: 80,
      },
      {
        accessorKey: 'isActive',
        header: t('fields.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? t('status.active') : t('status.inactive')}
          </Badge>
        ),
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">{tc('actions')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tc('actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewItem(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('viewItem')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditItem(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {tc('edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteItem(row.original)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tc('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 60,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [handleViewItem, handleEditItem, handleDeleteItem, t, tc]
  );

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-destructive">Failed to load items</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <Button variant="outline" onClick={handleBulkPriceUpdate}>
              <DollarSign className="mr-2 h-4 w-4" />
              {t('bulkPriceUpdate')} ({selectedItems.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            {tc('export')}
          </Button>
          <Button onClick={handleAddItem}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addItem')}
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        selectable
        resizable
        showSearch
        showColumnToggle
        showPagination
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noItemsFound')}
        labels={{
          columns: tt('columns'),
          loading: tt('loading'),
          rowsPerPage: tt('rowsPerPage'),
          page: tt('page'),
          of: tt('of'),
          rowsSelected: tt('rowsSelected'),
        }}
        onSelectionChange={setSelectedItems}
        pagination={
          data?.meta
            ? {
                page: data.meta.page,
                limit: data.meta.limit,
                total: data.meta.total,
                totalPages: data.meta.total_pages,
              }
            : undefined
        }
        onPaginationChange={handlePageChange}
        sorting={
          queryParams.sortBy
            ? [{ id: queryParams.sortBy, desc: queryParams.sortDir === 'desc' }]
            : []
        }
        onSortingChange={handleSortChange}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{itemToDelete?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Price Update Dialog */}
      <Dialog open={bulkPriceDialogOpen} onOpenChange={setBulkPriceDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Price Update</DialogTitle>
            <DialogDescription>
              Update prices for {selectedItems.length} selected item(s). The adjustment
              will be applied to all selected items.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Adjustment Type */}
            <div className="grid gap-2">
              <Label htmlFor="adjustmentType">Adjustment Type</Label>
              <Select
                value={bulkPriceForm.adjustmentType}
                onValueChange={(value: 'percentage' | 'fixed') =>
                  setBulkPriceForm((prev) => ({ ...prev, adjustmentType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Adjustment Value */}
            <div className="grid gap-2">
              <Label htmlFor="adjustmentValue">
                {bulkPriceForm.adjustmentType === 'percentage'
                  ? 'Percentage (e.g., 10 for +10%, -5 for -5%)'
                  : 'Amount (e.g., 5 for +$5, -3 for -$3)'}
              </Label>
              <Input
                id="adjustmentValue"
                type="number"
                step="0.01"
                placeholder={bulkPriceForm.adjustmentType === 'percentage' ? '10' : '5.00'}
                value={bulkPriceForm.adjustmentValue}
                onChange={(e) =>
                  setBulkPriceForm((prev) => ({ ...prev, adjustmentValue: e.target.value }))
                }
              />
            </div>

            {/* Price Tier */}
            <div className="grid gap-2">
              <Label htmlFor="priceTier">Price Tier</Label>
              <Select
                value={bulkPriceForm.priceTier}
                onValueChange={(value) =>
                  setBulkPriceForm((prev) => ({ ...prev, priceTier: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_TIERS.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={bulkPriceForm.currency}
                onValueChange={(value) =>
                  setBulkPriceForm((prev) => ({ ...prev, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkPriceDialogOpen(false)}
              disabled={bulkPriceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitBulkPriceUpdate}
              disabled={bulkPriceMutation.isPending || !bulkPriceForm.adjustmentValue}
            >
              {bulkPriceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Prices'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
