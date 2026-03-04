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
import { ColumnDef } from '@tanstack/react-table';
import { useItems, useDeleteItem } from '@/hooks/use-items';
import { BulkPriceDialog } from '@/components/dialogs/bulk-price-dialog';
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
import { useCategories } from '@/hooks/use-categories';
import type { ItemWithCategory, ItemQueryParams } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  Filter,
  DollarSign,
} from 'lucide-react';

export default function ItemsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

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
  const [bulkPriceDialogOpen, setBulkPriceDialogOpen] = useState(false);

  // Fetch items and categories
  const { data, isLoading, error } = useItems(queryParams);
  const { data: categoriesData } = useCategories();

  // Delete mutation
  const deleteMutation = useDeleteItem({
    onSuccess: () => {
      toast({
        title: 'Item deleted',
        description: 'The item has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete item',
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

  const handleExportPdf = useCallback(() => {
    router.push(`/${locale}/items/report`);
  }, [router, locale]);

  // Table columns
  const columns: ColumnDef<ItemWithCategory>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
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
        header: 'SKU',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.sku || '-'}</span>
        ),
        size: 120,
      },
      {
        accessorKey: 'barcode',
        header: 'Barcode',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.barcode || '-'}</span>
        ),
        size: 140,
      },
      {
        accessorKey: 'brand',
        header: 'Brand',
        cell: ({ row }) => row.original.brand || '-',
        size: 120,
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.category?.name || 'Uncategorized'}</Badge>
        ),
        size: 150,
      },
      {
        accessorKey: 'unitOfMeasure',
        header: 'Unit',
        cell: ({ row }) => row.original.unitOfMeasure,
        size: 80,
      },
      {
        accessorKey: 'taxRate',
        header: 'Tax %',
        cell: ({ row }) => `${row.original.taxRate}%`,
        size: 80,
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
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
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewItem(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditItem(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteItem(row.original)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 60,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [handleViewItem, handleEditItem, handleDeleteItem]
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
          <h1 className="text-2xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">
            Manage your inventory items, categories, and pricing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <Button variant="outline" onClick={handleBulkPriceUpdate}>
              <DollarSign className="mr-2 h-4 w-4" />
              Update Prices ({selectedItems.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleAddItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      {categoriesData?.data && categoriesData.data.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={queryParams.categoryId || 'all'}
            onValueChange={(value) =>
              setQueryParams((prev) => ({
                ...prev,
                categoryId: value === 'all' ? undefined : value,
                page: 1,
              }))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoriesData.data.map((cat: { id: string; name: string }) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
        searchPlaceholder="Search items..."
        emptyMessage="No items found. Create your first item to get started."
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
      <BulkPriceDialog
        open={bulkPriceDialogOpen}
        onOpenChange={setBulkPriceDialogOpen}
        items={selectedItems}
      />
    </div>
  );
}
