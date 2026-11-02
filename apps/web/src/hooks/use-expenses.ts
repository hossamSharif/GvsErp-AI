/**
 * useExpenses Hook
 *
 * TanStack Query hooks for expense management with caching.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  Expense,
  ExpenseWithCreator,
  ExpenseQueryParams,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseReportParams,
  ExpenseReportResponse,
  ExpenseCategoryRecord,
  ExpenseCategoryQueryParams,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '@erp/shared';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface ExpenseListResponse {
  success: boolean;
  data: ExpenseWithCreator[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (params: ExpenseQueryParams) => [...expenseKeys.lists(), params] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
  categories: () => [...expenseKeys.all, 'categories'] as const,
  report: (params: ExpenseReportParams) => [...expenseKeys.all, 'report', params] as const,
};

export function useExpenses(
  params: ExpenseQueryParams = {},
  options?: Omit<UseQueryOptions<ExpenseListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: async () => {
      const response = await api.get<ExpenseListResponse>('/expenses', {
        category: params.category,
        paymentMethod: params.paymentMethod,
        search: params.search,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return response;
    },
    ...options,
  });
}

export function useExpense(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseWithCreator>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpenseWithCreator>>(`/expenses/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

export function useExpenseCategories(
  params: ExpenseCategoryQueryParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseCategoryRecord[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...expenseKeys.categories(), params],
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpenseCategoryRecord[]>>(
        '/expenses/categories',
        { includeInactive: params.includeInactive }
      );
      return response;
    },
    ...options,
  });
}

export function useCreateExpenseCategory(
  options?: UseMutationOptions<ApiResponse<ExpenseCategoryRecord>, Error, CreateExpenseCategoryInput>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async (input: CreateExpenseCategoryInput) => {
      const response = await api.post<ApiResponse<ExpenseCategoryRecord>>(
        '/expenses/categories',
        input
      );
      return response;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}

export function useUpdateExpenseCategory(
  options?: UseMutationOptions<
    ApiResponse<ExpenseCategoryRecord>,
    Error,
    { id: string; input: UpdateExpenseCategoryInput }
  >
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async ({ id, input }) => {
      const response = await api.put<ApiResponse<ExpenseCategoryRecord>>(
        `/expenses/categories/${id}`,
        input
      );
      return response;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
      // A rename also renames the category on existing expenses.
      if (variables.input.name !== undefined) {
        queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
        queryClient.invalidateQueries({ queryKey: expenseKeys.details() });
      }
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}

export function useDeleteExpenseCategory(
  options?: UseMutationOptions<void, Error, { id: string }>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async ({ id }) => {
      await api.delete(`/expenses/categories/${id}`);
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}

export function useExpenseReport(
  params: ExpenseReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<ExpenseReportResponse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expenseKeys.report(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpenseReportResponse>>(
        '/expenses/reports/summary',
        {
          category: params.category,
          paymentMethod: params.paymentMethod,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          includeSummary: params.includeSummary,
        }
      );
      return response;
    },
    ...options,
  });
}

export function useCreateExpense(
  options?: UseMutationOptions<ApiResponse<ExpenseWithCreator>, Error, CreateExpenseInput>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const response = await api.post<ApiResponse<ExpenseWithCreator>>('/expenses', input);
      return response;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
      queryClient.setQueryData(expenseKeys.detail(data.data.id), data);
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}

export function useUpdateExpense(
  options?: UseMutationOptions<ApiResponse<Expense>, Error, { id: string; input: UpdateExpenseInput }>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async ({ id, input }) => {
      const response = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, input);
      return response;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories() });
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}

export function useDeleteExpense(
  options?: UseMutationOptions<void, Error, { id: string }>
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async ({ id }) => {
      await api.delete(`/expenses/${id}`);
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.lists() });
      queryClient.removeQueries({ queryKey: expenseKeys.detail(variables.id) });
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}
