/**
 * useSettlements Hook
 *
 * TanStack Query hooks for inventory settlements (stock adjustments).
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { warehouseKeys } from './use-warehouses';
import { itemKeys } from './use-items';
import type {
  SettlementWithDetails,
  SettlementQueryParams,
  CreateSettlementInput,
  UpdateSettlementInput,
  CountSheetRow,
  CountSheetParams,
  PostSettlementResult,
  ReverseSettlementResult,
} from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const settlementKeys = {
  all: ['settlements'] as const,
  lists: () => [...settlementKeys.all, 'list'] as const,
  list: (params: SettlementQueryParams) => [...settlementKeys.lists(), params] as const,
  details: () => [...settlementKeys.all, 'detail'] as const,
  detail: (id: string) => [...settlementKeys.details(), id] as const,
  countSheets: () => [...settlementKeys.all, 'count-sheet'] as const,
  countSheet: (params: CountSheetParams) =>
    [...settlementKeys.countSheets(), params] as const,
};

// =============================================================================
// QUERIES
// =============================================================================

export function useSettlements(
  params: SettlementQueryParams = {},
  options?: Omit<UseQueryOptions<ListResponse<SettlementWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: settlementKeys.list(params),
    queryFn: async () =>
      api.get<ListResponse<SettlementWithDetails>>('/settlements', params),
    ...options,
  });
}

export function useSettlement(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<SettlementWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: settlementKeys.detail(id),
    queryFn: async () =>
      api.get<ApiResponse<SettlementWithDetails>>(`/settlements/${id}`),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Physical-count worksheet for a warehouse. Disabled until a warehouse is
 * chosen — the endpoint requires one.
 */
export function useCountSheet(
  params: Partial<CountSheetParams>,
  options?: Omit<UseQueryOptions<ListResponse<CountSheetRow>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: settlementKeys.countSheet(params as CountSheetParams),
    queryFn: async () =>
      api.get<ListResponse<CountSheetRow>>('/settlements/count-sheet', params),
    enabled: Boolean(params.warehouseId),
    ...options,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Posting moves stock, valuation layers and the ledger, so it invalidates far
 * more than the settlement itself.
 */
function useStockInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: settlementKeys.all });
    queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    queryClient.invalidateQueries({ queryKey: itemKeys.all });
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };
}

export function useCreateSettlement(
  options?: UseMutationOptions<ApiResponse<SettlementWithDetails>, Error, CreateSettlementInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSettlementInput) =>
      api.post<ApiResponse<SettlementWithDetails>>('/settlements', input),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: settlementKeys.lists() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateSettlement(
  options?: UseMutationOptions<
    ApiResponse<SettlementWithDetails>,
    Error,
    { id: string; data: UpdateSettlementInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) =>
      api.put<ApiResponse<SettlementWithDetails>>(`/settlements/${id}`, data),
    onSuccess: (result, variables, ...rest) => {
      queryClient.invalidateQueries({ queryKey: settlementKeys.lists() });
      queryClient.invalidateQueries({ queryKey: settlementKeys.detail(variables.id) });
      options?.onSuccess?.(result, variables, ...rest);
    },
    ...options,
  });
}

export function useDeleteSettlement(
  options?: UseMutationOptions<ApiResponse<{ deleted: boolean }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      api.delete<ApiResponse<{ deleted: boolean }>>(`/settlements/${id}`),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: settlementKeys.lists() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function usePostSettlement(
  options?: UseMutationOptions<ApiResponse<PostSettlementResult>, Error, string>
) {
  const invalidateStock = useStockInvalidation();

  return useMutation({
    mutationFn: async (id: string) =>
      api.post<ApiResponse<PostSettlementResult>>(`/settlements/${id}/post`, {}),
    onSuccess: (...args) => {
      invalidateStock();
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useReverseSettlement(
  options?: UseMutationOptions<ApiResponse<ReverseSettlementResult>, Error, string>
) {
  const invalidateStock = useStockInvalidation();

  return useMutation({
    mutationFn: async (id: string) =>
      api.post<ApiResponse<ReverseSettlementResult>>(`/settlements/${id}/reverse`, {}),
    onSuccess: (...args) => {
      invalidateStock();
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
