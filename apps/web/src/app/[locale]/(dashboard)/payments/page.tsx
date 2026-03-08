'use client';

/**
 * Payments List Page
 *
 * Main page for viewing and managing payments with:
 * - Paginated data table
 * - Filter by type, party, date range
 * - Quick actions (view, delete)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { usePayments, useDeletePayment } from '@/hooks/use-payments';
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
import type { PaymentWithParty, PaymentQueryParams } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Eye,
  Download,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

export default function PaymentsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Query state
  const [queryParams, setQueryParams] = useState<PaymentQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'paymentDate',
    sortDir: 'desc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentWithParty | null>(null);

  // Fetch payments
  const { data, isLoading, error } = usePayments(queryParams);

  // Delete mutation
  const deleteMutation = useDeletePayment({
    onSuccess: () => {
      toast({
        title: 'Payment deleted',
        description: 'The payment has been deleted and balances updated.',
      });
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete payment',
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
        sortBy: sorting[0].id as PaymentQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleTypeFilter = useCallback((type: string) => {
    setQueryParams((prev) => ({
      ...prev,
      type: type === 'all' ? undefined : (type as 'received' | 'made'),
      page: 1,
    }));
  }, []);

  const handleRecordPayment = useCallback(() => {
    router.push(`/${locale}/payments/new`);
  }, [router, locale]);

  const handleViewPayment = useCallback(
    (payment: PaymentWithParty) => {
      router.push(`/${locale}/payments/${payment.id}`);
    },
    [router, locale]
  );

  const handleDeletePayment = useCallback((payment: PaymentWithParty) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (paymentToDelete) {
      deleteMutation.mutate({
        id: paymentToDelete.id,
        partyId: paymentToDelete.partyId,
      });
    }
  }, [paymentToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    router.push(`/${locale}/payments/report`);
  }, [router, locale]);

  // Format currency
  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }, []);

  // Format date
  const formatDate = useCallback((date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Table columns
  const columns = useMemo<ColumnDef<PaymentWithParty>[]>(
    () => [
      {
        accessorKey: 'reference',
        header: 'Reference',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.reference || 'N/A'}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const isReceived = row.original.type === 'received';
          return (
            <Badge variant={isReceived ? 'default' : 'secondary'}>
              {isReceived ? (
                <>
                  <ArrowDownCircle className="mr-1 h-3 w-3" />
                  Received
                </>
              ) : (
                <>
                  <ArrowUpCircle className="mr-1 h-3 w-3" />
                  Made
                </>
              )}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'party',
        header: 'Party',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.party.name}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {row.original.party.type}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Method',
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.paymentMethod?.replace('_', ' ') || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'paymentDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.paymentDate),
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
              <DropdownMenuItem onClick={() => handleViewPayment(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeletePayment(row.original)}
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
    [handleViewPayment, handleDeletePayment, formatCurrency, formatDate]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track all payments received and made</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={handleRecordPayment}>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <Select
          value={queryParams.type || 'all'}
          onValueChange={handleTypeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="received">Received Only</SelectItem>
            <SelectItem value="made">Made Only</SelectItem>
          </SelectContent>
        </Select>
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
        searchPlaceholder="Search by reference or notes..."
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the payment with reference "{paymentToDelete?.reference}" and reverse
              the balance change. This action cannot be undone.
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
