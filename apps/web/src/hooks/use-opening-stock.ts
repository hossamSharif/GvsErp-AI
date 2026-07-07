/**
 * useOpeningStock Hook
 *
 * TanStack Query hooks for the opening-stock feature.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  OpeningStockRow,
  OpeningStockResult,
  SetOpeningStockInput,
} from '@erp/shared';
import { warehouseKeys } from './use-warehouses';
import { accountingKeys } from './use-accounting';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const openingStockKeys = {
  all: ['opening-stock'] as const,
  rows: (warehouseId: string) => [...openingStockKeys.all, 'rows', warehouseId] as const,
};

// =============================================================================
// HOOKS
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Fetch all active items for a warehouse with current qty, suggested cost
 * and an indicator of whether an opening-stock entry already exists.
 */
export function useOpeningStockRows(warehouseId: string | undefined) {
  return useQuery({
    queryKey: openingStockKeys.rows(warehouseId ?? ''),
    queryFn: async () => {
      const res = await api.get<ApiResponse<OpeningStockRow[]>>(
        `/warehouses/${warehouseId}/opening-stock`
      );
      return res.data;
    },
    enabled: !!warehouseId,
  });
}

/**
 * Submit opening stock for a warehouse (additive).
 * Invalidates inventory, value, and accounting summary queries on success.
 */
export function useSetOpeningStock(warehouseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetOpeningStockInput) => {
      const res = await api.post<ApiResponse<OpeningStockResult>>(
        `/warehouses/${warehouseId}/opening-stock`,
        input
      );
      return res.data;
    },
    onSuccess: () => {
      if (warehouseId) {
        queryClient.invalidateQueries({
          queryKey: openingStockKeys.rows(warehouseId),
        });
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.inventory(warehouseId),
        });
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.value(),
        });
        queryClient.invalidateQueries({
          queryKey: warehouseKeys.detail(warehouseId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: accountingKeys.summary(),
      });
    },
  });
}
