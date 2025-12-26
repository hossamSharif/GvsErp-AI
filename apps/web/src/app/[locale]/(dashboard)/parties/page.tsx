'use client';

/**
 * Parties Page
 *
 * Combined view for managing customers and suppliers with tabs.
 * This page serves as the main entry point for party management.
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useParties, useDeleteParty } from '@/hooks/use-parties';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import type { Party, PartyQueryParams, PartyType } from '@erp-saas/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  DollarSign,
  Users,
  Building2,
} from 'lucide-react';

export default function PartiesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('parties');
  const tCommon = useTranslations('common');

  // Get initial tab from URL or default to 'customers'
  const initialTab = (searchParams.get('tab') as PartyType) || 'customer';
  const [activeTab, setActiveTab] = useState<PartyType>(initialTab);

  // Query state for customers
  const [customerQueryParams, setCustomerQueryParams] = useState<PartyQueryParams>({
    type: 'customer',
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // Query state for suppliers
  const [supplierQueryParams, setSupplierQueryParams] = useState<PartyQueryParams>({
    type: 'supplier',
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  // Fetch data based on active tab
  const {
    data: customersData,
    isLoading: customersLoading,
  } = useParties(customerQueryParams);

  const {
    data: suppliersData,
    isLoading: suppliersLoading,
  } = useParties(supplierQueryParams);

  // Delete mutation
  const deleteMutation = useDeleteParty({
    onSuccess: () => {
      toast({
        title: activeTab === 'customer' ? 'Customer deleted' : 'Supplier deleted',
        description: `The ${activeTab === 'customer' ? 'customer' : 'supplier'} has been deleted successfully.`,
      });
      setDeleteDialogOpen(false);
      setPartyToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to delete ${activeTab === 'customer' ? 'customer' : 'supplier'}`,
        variant: 'destructive',
      });
    },
  });

  // Tab change handler
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value as PartyType);
      // Update URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.set('tab', value);
      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  // Handlers for customers
  const handleCustomerPageChange = useCallback((page: number, limit: number) => {
    setCustomerQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleCustomerSortChange = useCallback((sorting: { id: string; desc: boolean }[]) => {
    if (sorting.length > 0) {
      setCustomerQueryParams((prev) => ({
        ...prev,
        sortBy: sorting[0].id as PartyQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleCustomerSearch = useCallback((value: string) => {
    setCustomerQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  // Handlers for suppliers
  const handleSupplierPageChange = useCallback((page: number, limit: number) => {
    setSupplierQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleSupplierSortChange = useCallback((sorting: { id: string; desc: boolean }[]) => {
    if (sorting.length > 0) {
      setSupplierQueryParams((prev) => ({
        ...prev,
        sortBy: sorting[0].id as PartyQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSupplierSearch = useCallback((value: string) => {
    setSupplierQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  // Common handlers
  const handleAddParty = useCallback(() => {
    const route = activeTab === 'customer' ? 'customers' : 'suppliers';
    router.push(`/${locale}/${route}/new`);
  }, [router, locale, activeTab]);

  const handleViewParty = useCallback(
    (party: Party) => {
      const route = party.type === 'customer' ? 'customers' : 'suppliers';
      router.push(`/${locale}/${route}/${party.id}`);
    },
    [router, locale]
  );

  const handleEditParty = useCallback(
    (party: Party) => {
      const route = party.type === 'customer' ? 'customers' : 'suppliers';
      router.push(`/${locale}/${route}/${party.id}`);
    },
    [router, locale]
  );

  const handleDeleteParty = useCallback((party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (partyToDelete) {
      deleteMutation.mutate(partyToDelete.id);
    }
  }, [partyToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    const route = activeTab === 'customer' ? 'customers' : 'suppliers';
    router.push(`/${locale}/${route}/report`);
  }, [router, locale, activeTab]);

  const handlePayment = useCallback(
    (party: Party) => {
      const paymentType = party.type === 'customer' ? 'received' : 'made';
      router.push(`/${locale}/payments/new?partyId=${party.id}&type=${paymentType}`);
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

  // Table columns (shared between customers and suppliers)
  const columns = useMemo<ColumnDef<Party>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('fields.name'),
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
        header: t('fields.phone'),
        cell: ({ row }) => row.original.phone || '-',
      },
      {
        accessorKey: 'balance',
        header: t('fields.balance'),
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
        header: t('fields.taxNumber'),
        cell: ({ row }) => row.original.taxNumber || '-',
      },
      {
        accessorKey: 'isActive',
        header: tCommon('status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? tCommon('active') : tCommon('inactive')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: tCommon('actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewParty(row.original)}>
                <Eye className="me-2 h-4 w-4" />
                {t('viewParty')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditParty(row.original)}>
                <Pencil className="me-2 h-4 w-4" />
                {t('editParty')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePayment(row.original)}>
                <DollarSign className="me-2 h-4 w-4" />
                {row.original.type === 'customer' ? 'Record Payment' : 'Make Payment'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteParty(row.original)}
                className="text-red-600"
              >
                <Trash2 className="me-2 h-4 w-4" />
                {t('deleteParty')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, tCommon, handleViewParty, handleEditParty, handlePayment, handleDeleteParty, formatCurrency]
  );

  return (
    <div className="flex h-full flex-col space-y-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {activeTab === 'customer' ? t('customers') : t('suppliers')}
          </h1>
          <p className="text-muted-foreground">
            {activeTab === 'customer'
              ? 'Manage your customer relationships and receivables'
              : 'Manage your supplier relationships and payables'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="me-2 h-4 w-4" />
            {tCommon('export')}
          </Button>
          <Button onClick={handleAddParty}>
            <Plus className="me-2 h-4 w-4" />
            {activeTab === 'customer' ? t('addCustomer') : t('addSupplier')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="customer" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('customers')}
            {customersData?.meta.total !== undefined && (
              <Badge variant="secondary" className="ms-1">
                {customersData.meta.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="supplier" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t('suppliers')}
            {suppliersData?.meta.total !== undefined && (
              <Badge variant="secondary" className="ms-1">
                {suppliersData.meta.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customer" className="flex-1 mt-4">
          <DataTable
            columns={columns}
            data={customersData?.data || []}
            pageCount={
              customersData?.meta.total
                ? Math.ceil(customersData.meta.total / customerQueryParams.limit!)
                : 0
            }
            pageIndex={customerQueryParams.page! - 1}
            pageSize={customerQueryParams.limit!}
            onPageChange={handleCustomerPageChange}
            onSortingChange={handleCustomerSortChange}
            onSearchChange={handleCustomerSearch}
            searchPlaceholder={`${tCommon('search')} ${t('customers').toLowerCase()}...`}
            isLoading={customersLoading}
          />
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="supplier" className="flex-1 mt-4">
          <DataTable
            columns={columns}
            data={suppliersData?.data || []}
            pageCount={
              suppliersData?.meta.total
                ? Math.ceil(suppliersData.meta.total / supplierQueryParams.limit!)
                : 0
            }
            pageIndex={supplierQueryParams.page! - 1}
            pageSize={supplierQueryParams.limit!}
            onPageChange={handleSupplierPageChange}
            onSortingChange={handleSupplierSortChange}
            onSearchChange={handleSupplierSearch}
            searchPlaceholder={`${tCommon('search')} ${t('suppliers').toLowerCase()}...`}
            isLoading={suppliersLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{partyToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
