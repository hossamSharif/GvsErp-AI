/**
 * usePOS Hook
 * TanStack Query hooks for POS location management
 * Phase 7: User Story 5 - Manage Point of Sale Locations
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
  POSLocation,
  POSLocationWithWarehouse,
  CreatePOSLocationRequest,
  UpdatePOSLocationRequest,
  QuickSaleRequest,
  QuickSaleResponse,
} from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  count: number;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const posKeys = {
  all: ['pos'] as const,
  lists: () => [...posKeys.all, 'list'] as const,
  list: (activeOnly?: boolean) => [...posKeys.lists(), { activeOnly }] as const,
  details: () => [...posKeys.all, 'detail'] as const,
  detail: (id: string) => [...posKeys.details(), id] as const,
  byWarehouse: (warehouseId: string) => [...posKeys.all, 'warehouse', warehouseId] as const,
};

// =============================================================================
// POS LOCATION QUERIES
// =============================================================================

/**
 * Fetch all POS locations
 */
export function usePOSLocations(
  activeOnly = false,
  options?: Omit<UseQueryOptions<ListResponse<POSLocationWithWarehouse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: posKeys.list(activeOnly),
    queryFn: async () => {
      const params = activeOnly ? { active: 'true' } : {};
      const response = await api.get<ListResponse<POSLocationWithWarehouse>>('/pos', params);
      return response;
    },
    ...options,
  });
}

/**
 * Fetch a single POS location by ID
 */
export function usePOSLocation(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<POSLocationWithWarehouse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: posKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<POSLocationWithWarehouse>>(`/pos/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch POS locations by warehouse ID
 */
export function usePOSLocationsByWarehouse(
  warehouseId: string | undefined,
  options?: Omit<UseQueryOptions<ListResponse<POSLocation>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: posKeys.byWarehouse(warehouseId!),
    queryFn: async () => {
      const response = await api.get<ListResponse<POSLocation>>(`/pos/warehouse/${warehouseId}`);
      return response;
    },
    enabled: !!warehouseId,
    ...options,
  });
}

// =============================================================================
// POS LOCATION MUTATIONS
// =============================================================================

/**
 * Create a new POS location
 */
export function useCreatePOSLocation(
  options?: UseMutationOptions<ApiResponse<POSLocation>, Error, CreatePOSLocationRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePOSLocationRequest) => {
      const response = await api.post<ApiResponse<POSLocation>>('/pos', input);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: posKeys.lists() });
    },
    ...options,
  });
}

/**
 * Update an existing POS location
 */
export function useUpdatePOSLocation(
  options?: UseMutationOptions<
    ApiResponse<POSLocation>,
    Error,
    { id: string; data: UpdatePOSLocationRequest }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePOSLocationRequest }) => {
      const response = await api.put<ApiResponse<POSLocation>>(`/pos/${id}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(posKeys.detail(variables.id), response);
      queryClient.invalidateQueries({ queryKey: posKeys.lists() });
    },
    ...options,
  });
}

/**
 * Delete a POS location (soft delete)
 */
export function useDeletePOSLocation(
  options?: UseMutationOptions<ApiResponse<{ message: string }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(`/pos/${id}`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: posKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: posKeys.lists() });
    },
    ...options,
  });
}

/**
 * Process a quick sale from POS terminal
 */
export function useProcessQuickSale(
  posLocationId: string,
  options?: UseMutationOptions<ApiResponse<QuickSaleResponse>, Error, QuickSaleRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleData: QuickSaleRequest) => {
      const response = await api.post<ApiResponse<QuickSaleResponse>>(
        `/pos/${posLocationId}/sale`,
        saleData
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate invoices and inventory queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    ...options,
  });
}
