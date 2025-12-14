'use client';

/**
 * Customers List Page
 *
 * Main page for managing customers with:
 * - Paginated data table
 * - Search and filters
 * - Balance display
 * - Quick actions (add, edit, view, delete)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Receipt,
} from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Query state
  const [queryParams, setQueryParams] = useState<PartyQueryParams>({
    type: 'customer',
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortDir: 'asc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Party | null>(null);

  // Fetch customers
  const { data, isLoading, error } = useParties(queryParams);

  // Delete mutation
  const deleteMutation = useDeleteParty({
    onSuccess: () => {
      toast({
        title: 'Customer deleted',
        description: 'The customer has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete customer',
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

  const handleAddCustomer = useCallback(() => {
    router.push(`/${locale}/customers/new`);
  }, [router, locale]);

  const handleEditCustomer = useCallback(
    (customer: Party) => {
      router.push(`/${locale}/customers/${customer.id}`);
    },
    [router, locale]
  );

  const handleViewCustomer = useCallback(
    (customer: Party) => {
      router.push(`/${locale}/customers/${customer.id}`);
    },
    [router, locale]
  );

  const handleDeleteCustomer = useCallback((customer: Party) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete.id);
    }
  }, [customerToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    router.push(`/${locale}/customers/report`);
  }, [router, locale]);

  const handleRecordPayment = useCallback(
    (customer: Party) => {
      router.push(`/${locale}/payments/new?partyId=${customer.id}&type=received`);
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
        header: 'Name',
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
        header: 'Phone',
        cell: ({ row }) => row.original.phone || '-',
      },
      {
        accessorKey: 'balance',
        header: 'Balance',
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
        header: 'Tax Number',
        cell: ({ row }) => row.original.taxNumber || '-',
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewCustomer(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditCustomer(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRecordPayment(row.original)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteCustomer(row.original)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleViewCustomer, handleEditCustomer, handleRecordPayment, handleDeleteCustomer, formatCurrency]
  );

  return (
    <div className="flex h-full flex-col space-y-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships and balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={handleAddCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
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
        searchPlaceholder="Search customers..."
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the customer "{customerToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
