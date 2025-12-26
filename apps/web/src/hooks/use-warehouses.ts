/**
 * useWarehouses Hook
 *
 * TanStack Query hooks for warehouse, inventory, and transfer management.
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
  Warehouse,
  WarehouseWithSummary,
  WarehouseQueryParams,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseInventoryEntry,
  InventoryQueryParams,
  Transfer,
  TransferWithDetails,
  TransferQueryParams,
  CreateTransferInput,
  UpdateTransferInput,
  LowStockAlert,
  LowStockSummary,
} from '@erp-saas/shared';

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

export const warehouseKeys = {
  all: ['warehouses'] as const,
  lists: () => [...warehouseKeys.all, 'list'] as const,
  list: (params: WarehouseQueryParams) => [...warehouseKeys.lists(), params] as const,
  active: () => [...warehouseKeys.all, 'active'] as const,
  details: () => [...warehouseKeys.all, 'detail'] as const,
  detail: (id: string) => [...warehouseKeys.details(), id] as const,
  inventory: (warehouseId: string, params?: InventoryQueryParams) =>
    [...warehouseKeys.detail(warehouseId), 'inventory', params] as const,
  alerts: (warehouseId?: string) => [...warehouseKeys.all, 'alerts', warehouseId] as const,
  alertSummary: () => [...warehouseKeys.all, 'alert-summary'] as const,
  value: () => [...warehouseKeys.all, 'value'] as const,
  valueByWarehouse: () => [...warehouseKeys.all, 'value-by-warehouse'] as const,
};

export const transferKeys = {
  all: ['transfers'] as const,
  lists: () => [...transferKeys.all, 'list'] as const,
  list: (params: TransferQueryParams) => [...transferKeys.lists(), params] as const,
  details: () => [...transferKeys.all, 'detail'] as const,
  detail: (id: string) => [...transferKeys.details(), id] as const,
  byWarehouse: (warehouseId: string) => [...transferKeys.all, 'warehouse', warehouseId] as const,
  pending: () => [...transferKeys.all, 'pending'] as const,
  inTransit: () => [...transferKeys.all, 'in-transit'] as const,
};

// =============================================================================
// WAREHOUSE QUERIES
// =============================================================================

/**
 * Fetch paginated list of warehouses
 */
export function useWarehouses(
  params: WarehouseQueryParams = {},
  options?: Omit<UseQueryOptions<ListResponse<Warehouse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.list(params),
    queryFn: async () => {
      const response = await api.get<ListResponse<Warehouse>>('/warehouses', params);
      return response;
    },
    ...options,
  });
}

/**
 * Fetch all active warehouses (for dropdowns)
 */
export function useActiveWarehouses(
  options?: Omit<UseQueryOptions<ApiResponse<Warehouse[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.active(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Warehouse[]>>('/warehouses/active');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch a single warehouse by ID with summary
 */
export function useWarehouse(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<WarehouseWithSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<WarehouseWithSummary>>(`/warehouses/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch warehouse inventory
 */
export function useWarehouseInventory(
  warehouseId: string | undefined,
  params: InventoryQueryParams = {},
  options?: Omit<UseQueryOptions<ListResponse<WarehouseInventoryEntry>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.inventory(warehouseId!, params),
    queryFn: async () => {
      const response = await api.get<ListResponse<WarehouseInventoryEntry>>(
        `/warehouses/${warehouseId}/inventory`,
        params
      );
      return response;
    },
    enabled: !!warehouseId,
    ...options,
  });
}

// =============================================================================
// WAREHOUSE MUTATIONS
// =============================================================================

/**
 * Create a new warehouse
 */
export function useCreateWarehouse(
  options?: UseMutationOptions<ApiResponse<Warehouse>, Error, CreateWarehouseInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWarehouseInput) => {
      const response = await api.post<ApiResponse<Warehouse>>('/warehouses', input);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.active() });
    },
    ...options,
  });
}

/**
 * Update a warehouse
 */
export function useUpdateWarehouse(
  options?: UseMutationOptions<
    ApiResponse<Warehouse>,
    Error,
    { id: string; data: UpdateWarehouseInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWarehouseInput }) => {
      const response = await api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(warehouseKeys.detail(variables.id), response);
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.active() });
    },
    ...options,
  });
}

/**
 * Deactivate a warehouse
 */
export function useDeactivateWarehouse(
  options?: UseMutationOptions<ApiResponse<{ message: string }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(`/warehouses/${id}`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: warehouseKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.active() });
    },
    ...options,
  });
}

/**
 * Update low stock threshold
 */
export function useUpdateLowStockThreshold(
  options?: UseMutationOptions<
    ApiResponse<any>,
    Error,
    { warehouseId: string; itemId: string; lowStockThreshold: number | null }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      warehouseId,
      itemId,
      lowStockThreshold,
    }: {
      warehouseId: string;
      itemId: string;
      lowStockThreshold: number | null;
    }) => {
      const response = await api.put<ApiResponse<any>>(
        `/warehouses/${warehouseId}/inventory/thresholds`,
        { itemId, warehouseId, lowStockThreshold }
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.inventory(variables.warehouseId) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.alerts() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.alertSummary() });
    },
    ...options,
  });
}

// =============================================================================
// LOW STOCK ALERT QUERIES
// =============================================================================

/**
 * Fetch low stock alerts
 */
export function useLowStockAlerts(
  warehouseId?: string,
  options?: Omit<UseQueryOptions<ApiResponse<LowStockAlert[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.alerts(warehouseId),
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : {};
      const response = await api.get<ApiResponse<LowStockAlert[]>>('/warehouses/alerts/low-stock', params);
      return response;
    },
    ...options,
  });
}

/**
 * Fetch low stock summary for dashboard
 */
export function useLowStockSummary(
  options?: Omit<UseQueryOptions<ApiResponse<LowStockSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.alertSummary(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<LowStockSummary>>('/warehouses/alerts/summary');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch critical alerts only
 */
export function useCriticalAlerts(
  warehouseId?: string,
  options?: Omit<UseQueryOptions<ApiResponse<LowStockAlert[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...warehouseKeys.alerts(warehouseId), 'critical'] as const,
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : {};
      const response = await api.get<ApiResponse<LowStockAlert[]>>('/warehouses/alerts/critical', params);
      return response;
    },
    ...options,
  });
}

// =============================================================================
// TRANSFER QUERIES
// =============================================================================

/**
 * Fetch paginated list of transfers
 */
export function useTransfers(
  params: TransferQueryParams = {},
  options?: Omit<UseQueryOptions<ListResponse<TransferWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn: async () => {
      const response = await api.get<ListResponse<TransferWithDetails>>('/transfers', params);
      return response;
    },
    ...options,
  });
}

/**
 * Fetch a single transfer by ID
 */
export function useTransfer(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<TransferWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transferKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<TransferWithDetails>>(`/transfers/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch pending transfers
 */
export function usePendingTransfers(
  options?: Omit<UseQueryOptions<ListResponse<TransferWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transferKeys.pending(),
    queryFn: async () => {
      const response = await api.get<ListResponse<TransferWithDetails>>('/transfers/status/pending');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch in-transit transfers
 */
export function useInTransitTransfers(
  options?: Omit<UseQueryOptions<ListResponse<TransferWithDetails>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transferKeys.inTransit(),
    queryFn: async () => {
      const response = await api.get<ListResponse<TransferWithDetails>>('/transfers/status/in-transit');
      return response;
    },
    ...options,
  });
}

// =============================================================================
// TRANSFER MUTATIONS
// =============================================================================

/**
 * Create a new transfer
 */
export function useCreateTransfer(
  options?: UseMutationOptions<ApiResponse<TransferWithDetails>, Error, CreateTransferInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      const response = await api.post<ApiResponse<TransferWithDetails>>('/transfers', input);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transferKeys.pending() });
    },
    ...options,
  });
}

/**
 * Update a transfer
 */
export function useUpdateTransfer(
  options?: UseMutationOptions<
    ApiResponse<TransferWithDetails>,
    Error,
    { id: string; data: UpdateTransferInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTransferInput }) => {
      const response = await api.put<ApiResponse<TransferWithDetails>>(`/transfers/${id}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(transferKeys.detail(variables.id), response);
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
    },
    ...options,
  });
}

/**
 * Start a transfer (reserve stock)
 */
export function useStartTransfer(
  options?: UseMutationOptions<ApiResponse<TransferWithDetails>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<TransferWithDetails>>(`/transfers/${id}/start`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transferKeys.pending() });
      queryClient.invalidateQueries({ queryKey: transferKeys.inTransit() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
    ...options,
  });
}

/**
 * Complete a transfer (move stock)
 */
export function useCompleteTransfer(
  options?: UseMutationOptions<ApiResponse<TransferWithDetails>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<TransferWithDetails>>(`/transfers/${id}/complete`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transferKeys.inTransit() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
    ...options,
  });
}

/**
 * Quick complete a transfer (immediate)
 */
export function useQuickCompleteTransfer(
  options?: UseMutationOptions<ApiResponse<TransferWithDetails>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<TransferWithDetails>>(`/transfers/${id}/quick-complete`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transferKeys.pending() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
    ...options,
  });
}

/**
 * Cancel a transfer
 */
export function useCancelTransfer(
  options?: UseMutationOptions<ApiResponse<TransferWithDetails>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<TransferWithDetails>>(`/transfers/${id}/cancel`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transferKeys.pending() });
      queryClient.invalidateQueries({ queryKey: transferKeys.inTransit() });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
    ...options,
  });
}

// =============================================================================
// VALUE QUERIES
// =============================================================================

/**
 * Fetch total inventory value
 */
export function useTotalInventoryValue(
  options?: Omit<UseQueryOptions<ApiResponse<{ totalValue: number }>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: warehouseKeys.value(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ totalValue: number }>>('/warehouses/value/total');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch inventory value by warehouse
 */
export function useInventoryValueByWarehouse(
  options?: Omit<
    UseQueryOptions<
      ApiResponse<Array<{ warehouseId: string; warehouseName: string; value: number }>>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: warehouseKeys.valueByWarehouse(),
    queryFn: async () => {
      const response = await api.get<
        ApiResponse<Array<{ warehouseId: string; warehouseName: string; value: number }>>
      >('/warehouses/value/by-warehouse');
      return response;
    },
    ...options,
  });
}
