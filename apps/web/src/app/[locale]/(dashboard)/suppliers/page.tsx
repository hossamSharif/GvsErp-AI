'use client';

/**
 * Suppliers List Page
 *
 * Main page for managing suppliers with:
 * - Paginated data table
 * - Search and filters
 * - Balance display
 * - Quick actions (add, edit, view, delete)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useParties, useDeleteParty } from '@/hooks/use-parties';
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
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { Party, PartyQueryParams } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  DollarSign,
} from 'lucide-react';

export default function SuppliersPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('parties');

  // Query state
  const [queryParams, setQueryParams] = useState<PartyQueryParams>({
    type: 'supplier',
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Party | null>(null);

  // Fetch suppliers
  const { data, isLoading, error } = useParties(queryParams);

  // Delete mutation
  const deleteMutation = useDeleteParty({
    onSuccess: () => {
      toast({
        title: t('toast.supplierDeleted'),
        description: t('toast.supplierDeletedDesc'),
      });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete supplier',
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
        sortBy: sorting[0].id as PartyQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleAddSupplier = useCallback(() => {
    router.push(`/${locale}/suppliers/new`);
  }, [router, locale]);

  const handleEditSupplier = useCallback(
    (supplier: Party) => {
      router.push(`/${locale}/suppliers/${supplier.id}`);
    },
    [router, locale]
  );

  const handleViewSupplier = useCallback(
    (supplier: Party) => {
      router.push(`/${locale}/suppliers/${supplier.id}`);
    },
    [router, locale]
  );

  const handleDeleteSupplier = useCallback((supplier: Party) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (supplierToDelete) {
      deleteMutation.mutate(supplierToDelete.id);
    }
  }, [supplierToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    router.push(`/${locale}/suppliers/report`);
  }, [router, locale]);

  const handleMakePayment = useCallback(
    (supplier: Party) => {
      router.push(`/${locale}/payments/new?partyId=${supplier.id}&type=made`);
    },
    [router, locale]
  );

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  // Table columns
  const columns = useMemo<ColumnDef<Party>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('columns.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.email && (
              <span className="text-sm text-muted-foreground">{row.original.email}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: t('columns.phone'),
        cell: ({ row }) => row.original.phone || '-',
      },
      {
        accessorKey: 'balance',
        header: t('columns.balance'),
        cell: ({ row }) => {
          const balance = row.original.balance;
          return (
            <div
              className={cn('font-medium', {
                'text-red-600': balance > 0,
                'text-green-600': balance < 0,
                'text-muted-foreground': balance === 0,
              })}
            >
              {formatCurrency(balance)}
            </div>
          );
        },
      },
      {
        accessorKey: 'taxNumber',
        header: t('columns.taxNumber'),
        cell: ({ row }) => row.original.taxNumber || '-',
      },
      {
        accessorKey: 'isActive',
        header: t('columns.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? t('status.active') : t('status.inactive')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('columns.actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions.actionsLabel')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewSupplier(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('actions.viewDetails')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditSupplier(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMakePayment(row.original)}>
                <DollarSign className="mr-2 h-4 w-4" />
                {t('actions.makePayment')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteSupplier(row.original)}
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
    [handleViewSupplier, handleEditSupplier, handleMakePayment, handleDeleteSupplier, formatCurrency, t]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('list.suppliersTitle')}</h1>
          <p className="text-muted-foreground">{t('list.suppliersDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            {t('list.exportReport')}
          </Button>
          <Button onClick={handleAddSupplier}>
            <Plus className="mr-2 h-4 w-4" />
            {t('list.addSupplier')}
          </Button>
        </div>
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
        searchPlaceholder={t('list.searchSuppliers')}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirmSupplierBody', { name: supplierToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
