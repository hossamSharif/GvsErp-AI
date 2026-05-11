'use client';

/**
 * Expenses List Page
 *
 * Manage business expenses with:
 * - Paginated data table
 * - Filter by category, payment method, date range, amount range
 * - Search across description, notes, reference, category
 * - Sort by date, amount, category
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { useExpenses, useDeleteExpense, useExpenseCategories } from '@/hooks/use-expenses';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { ExpenseQueryParams, ExpenseWithCreator } from '@erp/shared';
import { EXPENSE_CATEGORY_VALUES } from '@erp/shared';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  Filter,
} from 'lucide-react';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'other'];

export default function ExpensesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('expenses');

  // Query state
  const [queryParams, setQueryParams] = useState<ExpenseQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'expenseDate',
    sortDir: 'desc',
  });

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseWithCreator | null>(null);

  // Fetch expenses + categories
  const { data, isLoading } = useExpenses(queryParams);
  const { data: categoriesData } = useExpenseCategories();
  const tenantCategories = categoriesData?.data ?? [];

  // Combine default + tenant-defined categories (de-duped)
  const allCategories = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORY_VALUES, ...tenantCategories]);
    return Array.from(set).sort();
  }, [tenantCategories]);

  const deleteMutation = useDeleteExpense({
    onSuccess: () => {
      toast({ title: t('toast.deleted'), description: t('toast.deletedDesc') });
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    },
    onError: (error) => {
      toast({
        title: t('toast.error'),
        description: error.message || t('toast.deleteError'),
        variant: 'destructive',
      });
    },
  });

  const handlePageChange = useCallback((page: number, limit: number) => {
    setQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleSortChange = useCallback((sorting: SortingState) => {
    if (sorting.length > 0) {
      setQueryParams((prev) => ({
        ...prev,
        sortBy: sorting[0].id as ExpenseQueryParams['sortBy'],
        sortDir: sorting[0].desc ? 'desc' : 'asc',
      }));
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQueryParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleCategoryFilter = useCallback((category: string) => {
    setQueryParams((prev) => ({
      ...prev,
      category: category === 'all' ? undefined : category,
      page: 1,
    }));
  }, []);

  const handleMethodFilter = useCallback((method: string) => {
    setQueryParams((prev) => ({
      ...prev,
      paymentMethod: method === 'all' ? undefined : method,
      page: 1,
    }));
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setQueryParams((prev) => ({
      ...prev,
      dateFrom: value || undefined,
      page: 1,
    }));
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setQueryParams((prev) => ({
      ...prev,
      dateTo: value || undefined,
      page: 1,
    }));
  }, []);

  const handleAddExpense = useCallback(() => {
    router.push(`/${locale}/expenses/new`);
  }, [router, locale]);

  const handleEditExpense = useCallback(
    (expense: ExpenseWithCreator) => {
      router.push(`/${locale}/expenses/${expense.id}/edit`);
    },
    [router, locale]
  );

  const handleDeleteExpense = useCallback((expense: ExpenseWithCreator) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (expenseToDelete) {
      deleteMutation.mutate({ id: expenseToDelete.id });
    }
  }, [expenseToDelete, deleteMutation]);

  const handleExportReport = useCallback(() => {
    router.push(`/${locale}/expenses/report`);
  }, [router, locale]);

  // Translate category label (use translation if it's a known key, else show raw)
  const labelForCategory = useCallback(
    (category: string) => {
      const knownKeys = EXPENSE_CATEGORY_VALUES as readonly string[];
      if (knownKeys.includes(category)) {
        return t(`categories.${category}` as never);
      }
      return category;
    },
    [t]
  );

  const labelForMethod = useCallback(
    (method: string | null | undefined) => {
      if (!method) return '-';
      const knownKeys = PAYMENT_METHODS;
      if (knownKeys.includes(method)) {
        return t(`methods.${method}` as never);
      }
      return method;
    },
    [t]
  );

  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }, [locale]);

  const formatDate = useCallback(
    (date: string) => {
      return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
    [locale]
  );

  const columns = useMemo<ColumnDef<ExpenseWithCreator>[]>(
    () => [
      {
        accessorKey: 'expenseDate',
        id: 'expenseDate',
        header: t('fields.date'),
        cell: ({ row }) => formatDate(row.original.expenseDate),
      },
      {
        accessorKey: 'category',
        id: 'category',
        header: t('fields.category'),
        cell: ({ row }) => (
          <Badge variant="outline">{labelForCategory(row.original.category)}</Badge>
        ),
      },
      {
        accessorKey: 'amount',
        id: 'amount',
        header: t('fields.amount'),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        id: 'paymentMethod',
        header: t('fields.paymentMethod'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="capitalize">{labelForMethod(row.original.paymentMethod)}</span>
        ),
      },
      {
        accessorKey: 'description',
        id: 'description',
        header: t('fields.description'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-1">
            {row.original.description || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'reference',
        id: 'reference',
        header: t('fields.reference'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.reference || '-'}</span>
        ),
      },
      {
        id: 'actions',
        header: t('fields.actions'),
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('fields.actions')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('fields.actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditExpense(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteExpense(row.original)}
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
    [t, formatDate, formatCurrency, labelForCategory, labelForMethod, handleEditExpense, handleDeleteExpense]
  );

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            {t('exportReport')}
          </Button>
          <Button onClick={handleAddExpense}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addExpense')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t('filters')}:</span>
        </div>
        <Select
          value={queryParams.category || 'all'}
          onValueChange={handleCategoryFilter}
        >
          <SelectTrigger className="w-[180px]" data-testid="filter-category">
            <SelectValue placeholder={t('placeholders.anyCategory')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('placeholders.anyCategory')}</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {labelForCategory(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={queryParams.paymentMethod || 'all'}
          onValueChange={handleMethodFilter}
        >
          <SelectTrigger className="w-[180px]" data-testid="filter-method">
            <SelectValue placeholder={t('placeholders.anyMethod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('placeholders.anyMethod')}</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {labelForMethod(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={queryParams.dateFrom || ''}
          onChange={(e) => handleDateFromChange(e.target.value)}
          className="w-[160px]"
          placeholder={t('placeholders.fromDate')}
          aria-label={t('placeholders.fromDate')}
          data-testid="filter-date-from"
        />
        <Input
          type="date"
          value={queryParams.dateTo || ''}
          onChange={(e) => handleDateToChange(e.target.value)}
          className="w-[160px]"
          placeholder={t('placeholders.toDate')}
          aria-label={t('placeholders.toDate')}
          data-testid="filter-date-to"
        />
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
        searchPlaceholder={t('placeholders.search')}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
