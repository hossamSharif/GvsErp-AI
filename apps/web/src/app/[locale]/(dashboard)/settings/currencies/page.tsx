'use client';

/**
 * Currencies Management Page
 *
 * Manage currencies with:
 * - Currency list
 * - Create/edit currencies
 * - Set default currency
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useCurrencies, useDeleteCurrency, useCreateCurrency, useUpdateCurrency } from '@/hooks/use-currencies';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Currency, CreateCurrencyInput, UpdateCurrencyInput } from '@erp-saas/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

// Form schema
const currencyFormSchema = z.object({
  code: z.string().min(3, 'Code must be 3 characters').max(3, 'Code must be 3 characters').toUpperCase(),
  name: z.string().min(1, 'Name is required').max(255),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().default(false),
});

type CurrencyFormData = z.infer<typeof currencyFormSchema>;

interface CurrencyQueryParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'code' | 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

export default function CurrenciesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('settings.currencies');
  const tc = useTranslations('common');

  // Query state
  const [queryParams, setQueryParams] = useState<CurrencyQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'code',
    sortDir: 'asc',
  });

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [currencyToDelete, setCurrencyToDelete] = useState<Currency | null>(null);

  // Fetch currencies
  const { data, isLoading, error } = useCurrencies(queryParams);

  // Mutations
  const createMutation = useCreateCurrency({
    onSuccess: () => {
      toast({
        title: t('messages.currencyCreated'),
        description: t('messages.currencyCreatedDescription'),
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.createError'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateCurrency({
    onSuccess: () => {
      toast({
        title: t('messages.currencyUpdated'),
        description: t('messages.currencyUpdatedDescription'),
      });
      setDialogOpen(false);
      setEditingCurrency(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.updateError'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useDeleteCurrency({
    onSuccess: () => {
      toast({
        title: t('messages.currencyDeleted'),
        description: t('messages.currencyDeletedDescription'),
      });
      setDeleteDialogOpen(false);
      setCurrencyToDelete(null);
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('messages.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Form
  const form = useForm<CurrencyFormData>({
    resolver: zodResolver(currencyFormSchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
      is_default: false,
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
        sortBy: sorting[0].id as CurrencyQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleAddCurrency = useCallback(() => {
    setEditingCurrency(null);
    form.reset({
      code: '',
      name: '',
      symbol: '',
      is_default: false,
    });
    setDialogOpen(true);
  }, [form]);

  const handleEditCurrency = useCallback(
    (currency: Currency) => {
      setEditingCurrency(currency);
      form.reset({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol || '',
        is_default: currency.is_default,
      });
      setDialogOpen(true);
    },
    [form]
  );

  const handleDeleteCurrency = useCallback((currency: Currency) => {
    setCurrencyToDelete(currency);
    setDeleteDialogOpen(true);
  }, []);

  const handleSetDefault = useCallback(
    (currency: Currency) => {
      updateMutation.mutate({
        id: currency.id,
        input: { is_default: true },
      });
    },
    [updateMutation]
  );

  const confirmDelete = useCallback(() => {
    if (currencyToDelete) {
      deleteMutation.mutate(currencyToDelete.id);
    }
  }, [currencyToDelete, deleteMutation]);

  const onSubmit = useCallback(
    (data: CurrencyFormData) => {
      if (editingCurrency) {
        // Update existing currency
        const updateData: UpdateCurrencyInput = {
          code: data.code,
          name: data.name,
          symbol: data.symbol || undefined,
          is_default: data.is_default,
        };
        updateMutation.mutate({ id: editingCurrency.id, input: updateData });
      } else {
        // Create new currency
        const createData: CreateCurrencyInput = {
          code: data.code,
          name: data.name,
          symbol: data.symbol || undefined,
          is_default: data.is_default,
        };
        createMutation.mutate(createData);
      }
    },
    [editingCurrency, createMutation, updateMutation]
  );

  // Table columns
  const columns = useMemo<ColumnDef<Currency>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('fields.code'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{row.original.code}</span>
            {row.original.is_default && (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            )}
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: t('fields.name'),
        cell: ({ row }) => <span>{row.original.name}</span>,
      },
      {
        accessorKey: 'symbol',
        header: t('fields.symbol'),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.symbol || '-'}</span>
        ),
      },
      {
        accessorKey: 'is_default',
        header: t('fields.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.is_default ? 'default' : 'secondary'}>
            {row.original.is_default ? t('status.default') : t('status.active')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('fields.actions'),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('fields.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditCurrency(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              {!row.original.is_default && (
                <DropdownMenuItem onClick={() => handleSetDefault(row.original)}>
                  <Star className="mr-2 h-4 w-4" />
                  {t('actions.setDefault')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteCurrency(row.original)}
                className="text-red-600"
                disabled={row.original.is_default}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [t, handleEditCurrency, handleSetDefault, handleDeleteCurrency]
  );

  return (
    <div className="flex h-full flex-col space-y-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/settings`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('pageDescription')}
            </p>
          </div>
        </div>
        <Button onClick={handleAddCurrency}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addCurrency')}
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
        searchPlaceholder={t('searchPlaceholder')}
        isLoading={isLoading}
      />

      {/* Currency Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCurrency ? t('dialogs.edit') : t('dialogs.add')}</DialogTitle>
            <DialogDescription>
              {editingCurrency
                ? t('dialogs.editDescription')
                : t('dialogs.addDescription')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.code')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="USD"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        maxLength={3}
                        disabled={!!editingCurrency}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('fields.codeDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.currencyName')}</FormLabel>
                    <FormControl>
                      <Input placeholder="US Dollar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.symbol')}</FormLabel>
                    <FormControl>
                      <Input placeholder="$" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('fields.symbolDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('fields.setAsDefault')}</FormLabel>
                      <FormDescription>
                        {t('fields.setAsDefaultDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCurrency ? t('actions.update') : t('actions.create')}
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
            <AlertDialogTitle>{t('dialogs.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
