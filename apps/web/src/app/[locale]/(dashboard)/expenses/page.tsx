'use client';

/**
 * Expenses List Page
 * Display all expenses with filtering, search, and pagination
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Download, Filter, Search } from 'lucide-react';
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
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      await deleteExpenseMutation.mutateAsync(id);
      toast({
        title: 'Success',
        description: 'Expense deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense',
        variant: 'destructive',
      });
    }
  };

  const columns: ColumnDef<ExpenseWithDetails>[] = [
    {
      accessorKey: 'expense_date',
      header: 'Date',
      cell: ({ row }) => {
        const date = new Date(row.getValue('expense_date'));
        return date.toLocaleDateString();
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const description = row.getValue('description') as string | null;
        return description || '-';
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const expense = row.original;
        return expense.category?.name || 'Uncategorized';
      },
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const expense = row.original;
        const amount = Number(expense.amount);
        const currency = expense.currency || 'USD';
        return `${currency} ${amount.toFixed(2)}`;
      },
    },
    {
      accessorKey: 'created_by_name',
      header: 'Created By',
      cell: ({ row }) => {
        const createdBy = row.getValue('created_by_name') as string | null;
        return createdBy || 'Unknown';
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
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(expense.id)}
              disabled={deleteExpenseMutation.isPending}
            >
              Delete
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
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">Failed to load expenses. Please try again.</p>
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
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage business expenses</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/expenses/categories`)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Manage Categories
          </Button>
          <Button onClick={() => router.push(`/${locale}/expenses/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select
              value={filters.category_id || 'all'}
              onValueChange={handleCategoryFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
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
            pagination={{
              page,
              limit,
              total: data?.pagination.total || 0,
              total_pages: data?.pagination.total_pages || 0,
            }}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
