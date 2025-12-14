/**
 * useExchangeRates Hook
 *
 * TanStack Query hooks for exchange rate management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ExchangeRate, CreateExchangeRateInput, UpdateExchangeRateInput, RateType } from '@erp/shared';

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

interface ExchangeRateListResponse {
  success: boolean;
  data: ExchangeRate[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface ExchangeRateQueryParams {
  page?: number;
  limit?: number;
  fromCurrency?: string;
  toCurrency?: string;
  rateType?: RateType;
  effectiveDate?: string;
  sortBy?: 'effective_date' | 'from_currency' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const exchangeRateKeys = {
  all: ['exchange-rates'] as const,
  lists: () => [...exchangeRateKeys.all, 'list'] as const,
  list: (params: ExchangeRateQueryParams) => [...exchangeRateKeys.lists(), params] as const,
  details: () => [...exchangeRateKeys.all, 'detail'] as const,
  detail: (id: string) => [...exchangeRateKeys.details(), id] as const,
  latest: (fromCurrency: string, toCurrency: string, rateType?: RateType) =>
    [...exchangeRateKeys.all, 'latest', fromCurrency, toCurrency, rateType] as const,
};

// =============================================================================
// EXCHANGE RATE QUERIES
// =============================================================================

/**
 * Fetch paginated list of exchange rates
 */
export function useExchangeRates(
  params: ExchangeRateQueryParams = {},
  options?: Omit<UseQueryOptions<ExchangeRateListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: exchangeRateKeys.list(params),
    queryFn: async () => {
      const response = await api.get<ExchangeRateListResponse>('/exchange-rates', {
        fromCurrency: params.fromCurrency,
        toCurrency: params.toCurrency,
        rateType: params.rateType,
        effectiveDate: params.effectiveDate,
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
 * Fetch a single exchange rate by ID
 */
export function useExchangeRate(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<ExchangeRate>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: exchangeRateKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExchangeRate>>(`/exchange-rates/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch latest exchange rate for a currency pair
 */
export function useLatestExchangeRate(
  fromCurrency: string | undefined,
  toCurrency: string | undefined,
  rateType?: RateType,
  options?: Omit<UseQueryOptions<ApiResponse<ExchangeRate>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: exchangeRateKeys.latest(fromCurrency!, toCurrency!, rateType),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExchangeRate>>('/exchange-rates/latest', {
        fromCurrency,
        toCurrency,
        rateType,
      });
      return response;
    },
    enabled: !!fromCurrency && !!toCurrency,
    ...options,
  });
}

// =============================================================================
// EXCHANGE RATE MUTATIONS
// =============================================================================

/**
 * Create a new exchange rate
 */
export function useCreateExchangeRate(
  options?: UseMutationOptions<ApiResponse<ExchangeRate>, Error, CreateExchangeRateInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExchangeRateInput) => {
      const response = await api.post<ApiResponse<ExchangeRate>>('/exchange-rates', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate exchange rate lists
      queryClient.invalidateQueries({ queryKey: exchangeRateKeys.lists() });

      // Invalidate latest rate queries
      queryClient.invalidateQueries({ queryKey: [...exchangeRateKeys.all, 'latest'] });

      // Set the detail cache
      queryClient.setQueryData(exchangeRateKeys.detail(data.data.id), data);
    },
    ...options,
  });
}

/**
 * Update an existing exchange rate
 */
export function useUpdateExchangeRate(
  options?: UseMutationOptions<ApiResponse<ExchangeRate>, Error, { id: string; input: UpdateExchangeRateInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateExchangeRateInput }) => {
      const response = await api.put<ApiResponse<ExchangeRate>>(`/exchange-rates/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate exchange rate lists
      queryClient.invalidateQueries({ queryKey: exchangeRateKeys.lists() });

      // Invalidate latest rate queries
      queryClient.invalidateQueries({ queryKey: [...exchangeRateKeys.all, 'latest'] });

      // Invalidate exchange rate detail
      queryClient.invalidateQueries({ queryKey: exchangeRateKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete an exchange rate
 */
export function useDeleteExchangeRate(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/exchange-rates/${id}`);
    },
    onSuccess: (_, id) => {
      // Invalidate exchange rate lists
      queryClient.invalidateQueries({ queryKey: exchangeRateKeys.lists() });

      // Invalidate latest rate queries
      queryClient.invalidateQueries({ queryKey: [...exchangeRateKeys.all, 'latest'] });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: exchangeRateKeys.detail(id) });
    },
    ...options,
  });
}
