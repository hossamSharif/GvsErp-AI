'use client';

/**
 * Exchange Rates Management Page
 *
 * Manage exchange rates with:
 * - Exchange rate list
 * - Create/edit rates
 * - Rate types (formal/black market)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useExchangeRates, useDeleteExchangeRate, useCreateExchangeRate, useUpdateExchangeRate } from '@/hooks/use-exchange-rates';
import { useCurrencies } from '@/hooks/use-currencies';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ExchangeRate, CreateExchangeRateInput, UpdateExchangeRateInput, RateType } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';

// Form schema
const exchangeRateFormSchema = z.object({
  from_currency: z.string().min(1, 'From currency is required'),
  to_currency: z.string().min(1, 'To currency is required'),
  rate_type: z.enum(['formal', 'black_market']).default('formal'),
  rate: z.coerce.number().positive('Rate must be positive'),
  effective_date: z.string().min(1, 'Effective date is required'),
});

type ExchangeRateFormData = z.infer<typeof exchangeRateFormSchema>;

interface ExchangeRateQueryParams {
  page: number;
  limit: number;
  fromCurrency?: string;
  toCurrency?: string;
  rateType?: RateType;
  sortBy?: 'effective_date' | 'from_currency' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

export default function ExchangeRatesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Query state
  const [queryParams, setQueryParams] = useState<ExchangeRateQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'effective_date',
    sortDir: 'desc',
  });

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [rateToDelete, setRateToDelete] = useState<ExchangeRate | null>(null);

  // Fetch exchange rates
  const { data, isLoading, error } = useExchangeRates(queryParams);

  // Fetch currencies for dropdowns
  const { data: currenciesData } = useCurrencies({ limit: 100 });

  // Mutations
  const createMutation = useCreateExchangeRate({
    onSuccess: () => {
      toast({
        title: 'Exchange rate created',
        description: 'The exchange rate has been created successfully.',
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create exchange rate',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateExchangeRate({
    onSuccess: () => {
      toast({
        title: 'Exchange rate updated',
        description: 'The exchange rate has been updated successfully.',
      });
      setDialogOpen(false);
      setEditingRate(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update exchange rate',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useDeleteExchangeRate({
    onSuccess: () => {
      toast({
        title: 'Exchange rate deleted',
        description: 'The exchange rate has been deleted successfully.',
      });
      setDeleteDialogOpen(false);
      setRateToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete exchange rate',
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<ExchangeRateFormData>({
    resolver: zodResolver(exchangeRateFormSchema),
    defaultValues: {
      from_currency: '',
      to_currency: '',
      rate_type: 'formal',
      rate: 1,
      effective_date: new Date().toISOString().split('T')[0],
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
        sortBy: sorting[0].id as ExchangeRateQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, fromCurrency: value, page: 1 }));
  }, []);

  const handleAddRate = useCallback(() => {
    setEditingRate(null);
    form.reset({
      from_currency: '',
      to_currency: '',
      rate_type: 'formal',
      rate: 1,
      effective_date: new Date().toISOString().split('T')[0],
    });
    setDialogOpen(true);
  }, [form]);

  const handleEditRate = useCallback(
    (rate: ExchangeRate) => {
      setEditingRate(rate);
      form.reset({
        from_currency: rate.from_currency,
        to_currency: rate.to_currency,
        rate_type: rate.rate_type,
        rate: rate.rate,
        effective_date: rate.effective_date.split('T')[0],
      });
      setDialogOpen(true);
    },
    [form]
  );

  const handleDeleteRate = useCallback((rate: ExchangeRate) => {
    setRateToDelete(rate);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (rateToDelete) {
      deleteMutation.mutate(rateToDelete.id);
    }
  }, [rateToDelete, deleteMutation]);

  const onSubmit = useCallback(
    (data: ExchangeRateFormData) => {
      if (editingRate) {
        // Update existing rate
        const updateData: UpdateExchangeRateInput = {
          from_currency: data.from_currency,
          to_currency: data.to_currency,
          rate_type: data.rate_type,
          rate: data.rate,
          effective_date: data.effective_date,
        };
        updateMutation.mutate({ id: editingRate.id, input: updateData });
      } else {
        // Create new rate
        const createData: CreateExchangeRateInput = {
          from_currency: data.from_currency,
          to_currency: data.to_currency,
          rate_type: data.rate_type,
          rate: data.rate,
          effective_date: data.effective_date,
        };
        createMutation.mutate(createData);
      }
    },
    [editingRate, createMutation, updateMutation]
  );

  // Table columns
  const columns = useMemo<ColumnDef<ExchangeRate>[]>(
    () => [
      {
        accessorKey: 'from_currency',
        header: 'From',
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.from_currency}</span>
        ),
      },
      {
        accessorKey: 'to_currency',
        header: 'To',
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.to_currency}</span>
        ),
      },
      {
        accessorKey: 'rate',
        header: 'Rate',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{row.original.rate.toFixed(4)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'rate_type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.rate_type === 'formal' ? 'default' : 'secondary'}>
            {row.original.rate_type === 'formal' ? 'Formal' : 'Black Market'}
          </Badge>
        ),
      },
      {
        accessorKey: 'effective_date',
        header: 'Effective Date',
        cell: ({ row }) => (
          <span>{format(new Date(row.original.effective_date), 'MMM dd, yyyy')}</span>
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
              <DropdownMenuItem onClick={() => handleEditRate(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteRate(row.original)}
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
    [handleEditRate, handleDeleteRate]
  );

  return (
    <div className="flex h-full flex-col space-y-4 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/settings`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Exchange Rates</h1>
            <p className="text-muted-foreground">
              Manage currency exchange rates for multi-currency transactions
            </p>
          </div>
        </div>
        <Button onClick={handleAddRate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        pageCount={data?.meta.total ? Math.ceil(data.meta.total / queryParams.limit) : 0}
        pageIndex={queryParams.page - 1}
        pageSize={queryParams.limit}
        onPageChange={handlePageChange}
        onSortingChange={handleSortChange}
        onSearchChange={handleSearch}
        searchPlaceholder="Search by currency..."
        isLoading={isLoading}
      />

      {/* Exchange Rate Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Edit Exchange Rate' : 'Add Exchange Rate'}</DialogTitle>
            <DialogDescription>
              {editingRate
                ? 'Update the exchange rate details below.'
                : 'Fill in the exchange rate details below.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="from_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currenciesData?.data.map((currency) => (
                          <SelectItem key={currency.id} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="to_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currenciesData?.data.map((currency) => (
                          <SelectItem key={currency.id} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exchange Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="1.0000"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      How many units of "To Currency" equal 1 unit of "From Currency"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rate_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="black_market">Black Market</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effective_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Date when this rate becomes effective
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingRate ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the exchange rate from {rateToDelete?.from_currency} to{' '}
              {rateToDelete?.to_currency}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
