/**
 * useItemGrid Hooks
 *
 * TanStack Query hooks for the items bulk-edit grid.
 *
 * Deliberately does NOT invalidate the grid query after a row save: the page
 * keeps per-row dirty/saved/failed state and the caret inside a cell, and a
 * refetch would discard both while the user is still typing in another row.
 * The save endpoint returns the refreshed row, which we patch straight into the
 * cache instead.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationOptions,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  ItemGridRow,
  ItemGridQueryParams,
  SaveItemGridRowInput,
  SaveItemGridRowResult,
} from '@erp/shared';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ItemGridListResponse {
  success: boolean;
  data: ItemGridRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export const itemGridKeys = {
  all: ['item-grid'] as const,
  lists: () => [...itemGridKeys.all, 'list'] as const,
  list: (params: ItemGridQueryParams) => [...itemGridKeys.lists(), params] as const,
};

/**
 * Fetch one page of grid rows. `keepPreviousData` keeps the previous page
 * on screen while the next one loads, so arrow-key paging doesn't flash an
 * empty table under the user's cursor.
 */
export function useItemGrid(params: ItemGridQueryParams, enabled = true) {
  return useQuery({
    queryKey: itemGridKeys.list(params),
    queryFn: async () => {
      return api.get<ItemGridListResponse>('/items/grid', params as Record<string, unknown>);
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export interface SaveItemGridRowVariables {
  itemId: string;
  input: SaveItemGridRowInput;
  /** Query key of the page the row belongs to, so we can patch it in place */
  queryKey: readonly unknown[];
}

/**
 * Save a single row. Callers fire this without awaiting so the user can move on
 * to the next row immediately; the response patches the one row it refreshed.
 */
export function useSaveItemGridRow(
  options?: UseMutationOptions<
    ApiResponse<SaveItemGridRowResult>,
    Error,
    SaveItemGridRowVariables
  >
) {
  const queryClient = useQueryClient();
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async ({ itemId, input }: SaveItemGridRowVariables) => {
      return api.post<ApiResponse<SaveItemGridRowResult>>(
        `/items/${itemId}/grid-row`,
        input
      );
    },
    onSuccess: (response, variables, onMutateResult, context) => {
      const row = response.data?.row;
      if (row) {
        queryClient.setQueryData<ItemGridListResponse>(variables.queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((r) => (r.itemId === row.itemId ? row : r)),
          };
        });
      }
      callerOnSuccess?.(response, variables, onMutateResult, context);
    },
    ...rest,
  });
}
