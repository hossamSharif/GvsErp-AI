/**
 * useSettings Hook
 *
 * TanStack Query hooks for tenant settings management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { TenantSettings, UpdateTenantSettingsInput } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const settingsKeys = {
  all: ['settings'] as const,
  tenant: () => [...settingsKeys.all, 'tenant'] as const,
};

// =============================================================================
// SETTINGS QUERIES
// =============================================================================

/**
 * Fetch tenant settings
 */
export function useTenantSettings(
  options?: Omit<UseQueryOptions<ApiResponse<TenantSettings>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: settingsKeys.tenant(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<TenantSettings>>('/settings');
      return response;
    },
    ...options,
  });
}

// =============================================================================
// SETTINGS MUTATIONS
// =============================================================================

/**
 * Update tenant settings
 */
export function useUpdateTenantSettings(
  options?: UseMutationOptions<ApiResponse<TenantSettings>, Error, UpdateTenantSettingsInput>
) {
  const queryClient = useQueryClient();
  // Preserve any caller-supplied onSuccess by running it AFTER the built-in
  // cache update. Spreading `...options` used to overwrite our onSuccess, which
  // left the /settings cache stale after a save (e.g. the payment-flow setting
  // read back its old value until a refetch).
  const { onSuccess: callerOnSuccess, ...rest } = options ?? {};

  return useMutation({
    mutationFn: async (input: UpdateTenantSettingsInput) => {
      const response = await api.put<ApiResponse<TenantSettings>>('/settings', input);
      return response;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      // Set the cache directly for an immediate, consistent read, then
      // invalidate so a background refetch reconciles with the server.
      queryClient.setQueryData(settingsKeys.tenant(), data);
      queryClient.invalidateQueries({ queryKey: settingsKeys.tenant() });
      callerOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...rest,
  });
}
