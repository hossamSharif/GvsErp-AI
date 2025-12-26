/**
 * useExpenses Hook
 * TanStack Query hooks for expense management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type {
  Expense,
  ExpenseWithDetails,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseFilters,
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
} from '@erp-saas/shared/types/expenses';

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface ExpenseListResponse {
  success: boolean;
  data: ExpenseWithDetails[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface ExpenseCategoryListResponse {
  success: boolean;
  data: ExpenseCategory[];
}

interface ExpenseSummaryResponse {
  success: boolean;
  data: {
    total_amount: number;
    by_category: Array<{
      category_id: string;
      category_name: string;
      total: number;
      count: number;
    }>;
    by_month: Array<{
      month: string;
      total: number;
      count: number;
    }>;
  };
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (filters: ExpenseFilters, page: number, limit: number) =>
    [...expenseKeys.lists(), filters, page, limit] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
  summary: (startDate: string, endDate: string, currency?: string) =>
    [...expenseKeys.all, 'summary', startDate, endDate, currency] as const,
  categories: ['expense-categories'] as const,
  categoryDetail: (id: string) => [...expenseKeys.categories, id] as const,
};

// ===== Expense Queries =====

/**
 * Get all expenses with filters
 */
export function useExpenses(filters: ExpenseFilters = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: expenseKeys.list(filters, page, limit),
    queryFn: async () => {
      const response = await api.get<ExpenseListResponse>('/expenses', {
        category_id: filters.category_id,
        start_date: filters.start_date,
        end_date: filters.end_date,
        min_amount: filters.min_amount,
        max_amount: filters.max_amount,
        currency: filters.currency,
        search: filters.search,
        page,
        limit,
      });
      return response;
    },
  });
}

/**
 * Get a single expense by ID
 */
export function useExpense(id: string) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpenseWithDetails>>(`/expenses/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Get expense summary for reporting
 */
export function useExpenseSummary(
  startDate: string,
  endDate: string,
  currency?: string
) {
  return useQuery({
    queryKey: expenseKeys.summary(startDate, endDate, currency),
    queryFn: async () => {
      const response = await api.get<ExpenseSummaryResponse>('/expenses/summary/report', {
        start_date: startDate,
        end_date: endDate,
        currency,
      });
      return response;
    },
    enabled: !!startDate && !!endDate,
  });
}

// ===== Expense Mutations =====

/**
 * Create a new expense
 */
export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseRequest) => {
      const response = await api.post<ApiResponse<Expense>>('/expenses', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

/**
 * Update an existing expense
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateExpenseRequest }) => {
      const response = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.id) });
    },
  });
}

/**
 * Delete an expense
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

// ===== Category Queries =====

/**
 * Get all expense categories
 */
export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseKeys.categories,
    queryFn: async () => {
      const response = await api.get<ExpenseCategoryListResponse>('/expense-categories');
      return response;
    },
  });
}

/**
 * Get root categories (categories without parent)
 */
export function useRootExpenseCategories() {
  return useQuery({
    queryKey: [...expenseKeys.categories, 'root'],
    queryFn: async () => {
      const response = await api.get<ExpenseCategoryListResponse>('/expense-categories', {
        root_only: true,
      });
      return response;
    },
  });
}

/**
 * Get a single expense category by ID
 */
export function useExpenseCategory(id: string) {
  return useQuery({
    queryKey: expenseKeys.categoryDetail(id),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpenseCategory>>(`/expense-categories/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Get child categories of a parent category
 */
export function useChildExpenseCategories(parentId: string) {
  return useQuery({
    queryKey: [...expenseKeys.categories, parentId, 'children'],
    queryFn: async () => {
      const response = await api.get<ExpenseCategoryListResponse>('/expense-categories', {
        parent_id: parentId,
      });
      return response;
    },
    enabled: !!parentId,
  });
}

// ===== Category Mutations =====

/**
 * Create a new expense category
 */
export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseCategoryRequest) => {
      const response = await api.post<ApiResponse<ExpenseCategory>>('/expense-categories', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories });
    },
  });
}

/**
 * Update an existing expense category
 */
export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateExpenseCategoryRequest;
    }) => {
      const response = await api.put<ApiResponse<ExpenseCategory>>(`/expense-categories/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories });
      queryClient.invalidateQueries({ queryKey: expenseKeys.categoryDetail(variables.id) });
    },
  });
}

/**
 * Delete an expense category
 */
export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/expense-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories });
    },
  });
}
