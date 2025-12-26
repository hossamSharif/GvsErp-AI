/**
 * useCurrencies Hook
 *
 * TanStack Query hooks for currency management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Currency, CreateCurrencyInput, UpdateCurrencyInput } from '@erp-saas/shared';

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
    hasMore: boolean;
  };
}

interface CurrencyListResponse {
  success: boolean;
  data: Currency[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface CurrencyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isDefault?: boolean;
  sortBy?: 'code' | 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const currencyKeys = {
  all: ['currencies'] as const,
  lists: () => [...currencyKeys.all, 'list'] as const,
  list: (params: CurrencyQueryParams) => [...currencyKeys.lists(), params] as const,
  details: () => [...currencyKeys.all, 'detail'] as const,
  detail: (id: string) => [...currencyKeys.details(), id] as const,
};

// =============================================================================
// CURRENCY QUERIES
// =============================================================================

/**
 * Fetch paginated list of currencies
 */
export function useCurrencies(
  params: CurrencyQueryParams = {},
  options?: Omit<UseQueryOptions<CurrencyListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: currencyKeys.list(params),
    queryFn: async () => {
      const response = await api.get<CurrencyListResponse>('/currencies', {
        search: params.search,
        isDefault: params.isDefault,
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

/**
 * Fetch a single currency by ID
 */
export function useCurrency(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Currency>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: currencyKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Currency>>(`/currencies/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// CURRENCY MUTATIONS
// =============================================================================

/**
 * Create a new currency
 */
export function useCreateCurrency(
  options?: UseMutationOptions<ApiResponse<Currency>, Error, CreateCurrencyInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCurrencyInput) => {
      const response = await api.post<ApiResponse<Currency>>('/currencies', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate currency lists
      queryClient.invalidateQueries({ queryKey: currencyKeys.lists() });

      // Set the detail cache
      queryClient.setQueryData(currencyKeys.detail(data.data.id), data);
    },
    ...options,
  });
}

/**
 * Update an existing currency
 */
export function useUpdateCurrency(
  options?: UseMutationOptions<ApiResponse<Currency>, Error, { id: string; input: UpdateCurrencyInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCurrencyInput }) => {
      const response = await api.put<ApiResponse<Currency>>(`/currencies/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate currency lists
      queryClient.invalidateQueries({ queryKey: currencyKeys.lists() });

      // Invalidate currency detail
      queryClient.invalidateQueries({ queryKey: currencyKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a currency
 */
export function useDeleteCurrency(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/currencies/${id}`);
    },
    onSuccess: (_, id) => {
      // Invalidate currency lists
      queryClient.invalidateQueries({ queryKey: currencyKeys.lists() });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: currencyKeys.detail(id) });
    },
    ...options,
  });
}
