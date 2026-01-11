'use client';

/**
 * Expenses List Page
 * Display all expenses with filtering, search, and pagination
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Download, Filter, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDirection } from '@/stores/language-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExpenses, useExpenseCategories, useDeleteExpense } from '@/hooks/use-expenses';
import { ExpenseFilters, ExpenseWithDetails } from '@erp-saas/shared/types/expenses';
import { DataTable } from '@/components/tables/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';

export default function ExpensesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'en';
  const { toast } = useToast();
  const t = useTranslations('expenses');
  const { isRtl } = useDirection();

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useExpenses(filters, page, limit);
  const { data: categoriesData } = useExpenseCategories();
  const deleteExpenseMutation = useDeleteExpense();

  const categories = categoriesData?.data || [];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters((prev) => ({ ...prev, search: value || undefined }));
    setPage(1);
  };

  const handleCategoryFilter = (categoryId: string) => {
    setFilters((prev) => ({
      ...prev,
      category_id: categoryId === 'all' ? undefined : categoryId,
    }));
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    try {
      await deleteExpenseMutation.mutateAsync(id);
      toast({
        title: t('success'),
        description: t('deleteSuccess'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('deleteError'),
        variant: 'destructive',
      });
    }
  };

  const columns: ColumnDef<ExpenseWithDetails>[] = [
    {
      accessorKey: 'expense_date',
      header: t('columns.date'),
      cell: ({ row }) => {
        const date = new Date(row.getValue('expense_date'));
        return date.toLocaleDateString();
      },
    },
    {
      accessorKey: 'description',
      header: t('columns.description'),
      cell: ({ row }) => {
        const description = row.getValue('description') as string | null;
        return description || '-';
      },
    },
    {
      accessorKey: 'category',
      header: t('columns.category'),
      cell: ({ row }) => {
        const expense = row.original;
        return expense.category?.name || t('uncategorized');
      },
    },
    {
      accessorKey: 'amount',
      header: t('columns.amount'),
      cell: ({ row }) => {
        const expense = row.original;
        const amount = Number(expense.amount);
        const currency = expense.currency || 'USD';
        return `${currency} ${amount.toFixed(2)}`;
      },
    },
    {
      accessorKey: 'created_by_name',
      header: t('columns.createdBy'),
      cell: ({ row }) => {
        const createdBy = row.getValue('created_by_name') as string | null;
        return createdBy || t('unknown');
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const expense = row.original;
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${locale}/expenses/${expense.id}`)}
            >
              {t('actions.edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(expense.id)}
              disabled={deleteExpenseMutation.isPending}
            >
              {t('actions.delete')}
            </Button>
          </div>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('error')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{t('loadError')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/expenses/categories`)}
          >
            <Filter className="me-2 h-4 w-4" />
            {t('manageCategories')}
          </Button>
          <Button onClick={() => router.push(`/${locale}/expenses/new`)}>
            <Plus className="me-2 h-4 w-4" />
            {t('newExpense')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className={cn(
                "absolute top-3 h-4 w-4 text-muted-foreground",
                isRtl ? "right-3" : "left-3"
              )} />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className={cn(isRtl ? "pr-9" : "pl-9")}
              />
            </div>

            {/* Category Filter */}
            <Select
              value={filters.category_id || 'all'}
              onValueChange={handleCategoryFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/expenses/report`)}
            >
              <Download className="me-2 h-4 w-4" />
              {t('exportReport')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.data || []}
            isLoading={isLoading}
            showSearch={false}
            emptyMessage={t('noResults')}
            labels={{
              columns: t('table.columns'),
              loading: t('table.loading'),
              rowsPerPage: t('table.rowsPerPage'),
              page: t('table.page'),
              of: t('table.of'),
              rowsSelected: t('table.rowsSelected'),
            }}
            pagination={{
              page,
              limit,
              total: data?.pagination.total || 0,
              totalPages: data?.pagination.total_pages || 0,
            }}
            onPaginationChange={(newPage, newLimit) => setPage(newPage)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
