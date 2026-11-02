/**
 * useItems Hook
 *
 * TanStack Query hooks for item management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { itemGridKeys } from './use-item-grid';
import type {
  Item,
  ItemWithCategory,
  ItemWithRelations,
  ItemQueryParams,
  CreateItemInput,
  UpdateItemInput,
  BulkPriceUpdateInput,
  BulkPriceUpdateResult,
  BulkPriceUpdateAllInput,
  BulkPriceUpdateAllResult,
  ItemPrice,
  ItemPackaging,
  CreateItemPriceInput,
  UpdateItemPriceInput,
  CreateItemPackagingInput,
  UpdateItemPackagingInput,
  ItemReportEntry,
  ItemReportParams,
  ItemMovementParams,
  ItemMovementReport,
} from '@erp/shared';

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

interface ItemListResponse {
  success: boolean;
  data: ItemWithCategory[];
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

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (params: ItemQueryParams) => [...itemKeys.lists(), params] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
  prices: (id: string) => [...itemKeys.detail(id), 'prices'] as const,
  packagings: (id: string) => [...itemKeys.detail(id), 'packagings'] as const,
  report: (params: ItemReportParams) => [...itemKeys.all, 'report', params] as const,
  movement: (id: string, params: ItemMovementParams) =>
    [...itemKeys.detail(id), 'movement', params] as const,
  bySku: (sku: string) => [...itemKeys.all, 'by-sku', sku] as const,
  byBarcode: (barcode: string) => [...itemKeys.all, 'by-barcode', barcode] as const,
};

// =============================================================================
// ITEM QUERIES
// =============================================================================

/**
 * Fetch paginated list of items
 */
export function useItems(
  params: ItemQueryParams = {},
  options?: Omit<UseQueryOptions<ItemListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: async () => {
      const response = await api.get<ItemListResponse>('/items', {
        search: params.search,
        categoryId: params.categoryId,
        isActive: params.isActive,
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
        expiringWithinDays: params.expiringWithinDays,
      });
      return response;
    },
    ...options,
  });
}

/**
 * Fetch a single item by ID
 */
export function useItem(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<ItemWithRelations>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ItemWithRelations>>(`/items/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch item by SKU
 */
export function useItemBySku(
  sku: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Item>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.bySku(sku!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Item>>(`/items/by-sku/${sku}`);
      return response;
    },
    enabled: !!sku,
    ...options,
  });
}

/**
 * Fetch item by barcode
 */
export function useItemByBarcode(
  barcode: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Item>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.byBarcode(barcode!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Item>>(`/items/by-barcode/${barcode}`);
      return response;
    },
    enabled: !!barcode,
    ...options,
  });
}

/**
 * Fetch item prices
 */
export function useItemPrices(
  itemId: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<ItemPrice[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.prices(itemId!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ItemPrice[]>>(`/items/${itemId}/prices`);
      return response;
    },
    enabled: !!itemId,
    ...options,
  });
}

/**
 * Fetch item packagings
 */
export function useItemPackagings(
  itemId: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<ItemPackaging[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.packagings(itemId!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ItemPackaging[]>>(`/items/${itemId}/packagings`);
      return response;
    },
    enabled: !!itemId,
    ...options,
  });
}

/**
 * Fetch items for report
 */
export function useItemsReport(
  params: ItemReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<ItemReportEntry[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.report(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ItemReportEntry[]>>('/items/report', params);
      return response;
    },
    ...options,
  });
}

/**
 * Fetch the movement ledger + KPIs for a single item.
 *
 * Online-only by design — the report is derived/aggregated server-side and
 * would go stale against the offline outbox, so the page wraps this in
 * OnlineOnlyGuard and the endpoint is deliberately absent from
 * lib/offline/routes.ts.
 */
export function useItemMovement(
  id: string,
  params: ItemMovementParams,
  options?: Omit<UseQueryOptions<ApiResponse<ItemMovementReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: itemKeys.movement(id, params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ItemMovementReport>>(
        `/items/${id}/movement`,
        {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          warehouseId: params.warehouseId,
        }
      );
      return response;
    },
    enabled: !!id && !!params.dateFrom && !!params.dateTo,
    ...options,
  });
}

// =============================================================================
// ITEM MUTATIONS
// =============================================================================

/**
 * Create a new item
 */
export function useCreateItem(
  options?: UseMutationOptions<ApiResponse<ItemWithRelations>, Error, CreateItemInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput) => {
      const response = await api.post<ApiResponse<ItemWithRelations>>('/items', input);
      return response;
    },
    onSuccess: () => {
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
    ...options,
  });
}

/**
 * Update an item
 */
export function useUpdateItem(
  options?: UseMutationOptions<
    ApiResponse<ItemWithRelations>,
    Error,
    { id: string; data: UpdateItemInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateItemInput }) => {
      const response = await api.put<ApiResponse<ItemWithRelations>>(`/items/${id}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      // Update the item in cache
      queryClient.setQueryData(itemKeys.detail(variables.id), response);
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
    ...options,
  });
}

/**
 * Delete an item
 */
export function useDeleteItem(
  options?: UseMutationOptions<ApiResponse<{ message: string }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(`/items/${id}`);
      return response;
    },
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: itemKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

/**
 * Bulk update prices
 */
export function useBulkUpdatePrices(
  options?: UseMutationOptions<ApiResponse<BulkPriceUpdateResult>, Error, BulkPriceUpdateInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkPriceUpdateInput) => {
      const response = await api.post<ApiResponse<BulkPriceUpdateResult>>(
        '/items/bulk-price-update',
        input
      );
      return response;
    },
    onSuccess: (response) => {
      // Invalidate affected items
      response.data.updatedIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: itemKeys.prices(id) });
      });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
    ...options,
  });
}

/**
 * Bulk update prices for all items (optionally one category)
 */
export function useBulkUpdateAllPrices(
  options?: UseMutationOptions<ApiResponse<BulkPriceUpdateAllResult>, Error, BulkPriceUpdateAllInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input: BulkPriceUpdateAllInput) => {
      const response = await api.post<ApiResponse<BulkPriceUpdateAllResult>>(
        '/items/bulk-price-update-all',
        input
      );
      return response;
    },
    onSuccess: (data, input, onMutateResult, context) => {
      // Any item's price may have changed — drop every cached item query
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: itemGridKeys.all });
      options?.onSuccess?.(data, input, onMutateResult, context);
    },
  });
}

// =============================================================================
// PRICE MUTATIONS
// =============================================================================

/**
 * Add a price to an item
 */
export function useAddItemPrice(
  options?: UseMutationOptions<
    ApiResponse<ItemPrice>,
    Error,
    { itemId: string; data: CreateItemPriceInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: CreateItemPriceInput }) => {
      const response = await api.post<ApiResponse<ItemPrice>>(`/items/${itemId}/prices`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.prices(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}

/**
 * Update an item price
 */
export function useUpdateItemPrice(
  options?: UseMutationOptions<
    ApiResponse<ItemPrice>,
    Error,
    { itemId: string; priceId: string; data: UpdateItemPriceInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      priceId,
      data,
    }: {
      itemId: string;
      priceId: string;
      data: UpdateItemPriceInput;
    }) => {
      const response = await api.put<ApiResponse<ItemPrice>>(
        `/items/${itemId}/prices/${priceId}`,
        data
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.prices(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}

/**
 * Delete an item price
 */
export function useDeleteItemPrice(
  options?: UseMutationOptions<
    ApiResponse<{ message: string }>,
    Error,
    { itemId: string; priceId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, priceId }: { itemId: string; priceId: string }) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(
        `/items/${itemId}/prices/${priceId}`
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.prices(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}

// =============================================================================
// PACKAGING MUTATIONS
// =============================================================================

/**
 * Add a packaging to an item
 */
export function useAddItemPackaging(
  options?: UseMutationOptions<
    ApiResponse<ItemPackaging>,
    Error,
    { itemId: string; data: CreateItemPackagingInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: CreateItemPackagingInput }) => {
      const response = await api.post<ApiResponse<ItemPackaging>>(
        `/items/${itemId}/packagings`,
        data
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.packagings(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}

/**
 * Update an item packaging
 */
export function useUpdateItemPackaging(
  options?: UseMutationOptions<
    ApiResponse<ItemPackaging>,
    Error,
    { itemId: string; packagingId: string; data: UpdateItemPackagingInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      packagingId,
      data,
    }: {
      itemId: string;
      packagingId: string;
      data: UpdateItemPackagingInput;
    }) => {
      const response = await api.put<ApiResponse<ItemPackaging>>(
        `/items/${itemId}/packagings/${packagingId}`,
        data
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.packagings(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}

/**
 * Delete an item packaging
 */
export function useDeleteItemPackaging(
  options?: UseMutationOptions<
    ApiResponse<{ message: string }>,
    Error,
    { itemId: string; packagingId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, packagingId }: { itemId: string; packagingId: string }) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(
        `/items/${itemId}/packagings/${packagingId}`
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.packagings(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) });
    },
    ...options,
  });
}
