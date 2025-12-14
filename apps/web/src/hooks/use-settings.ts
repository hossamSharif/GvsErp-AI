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

  return useMutation({
    mutationFn: async (input: UpdateTenantSettingsInput) => {
      const response = await api.put<ApiResponse<TenantSettings>>('/settings', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate settings cache
      queryClient.invalidateQueries({ queryKey: settingsKeys.tenant() });

      // Optionally set the cache directly for immediate UI update
      queryClient.setQueryData(settingsKeys.tenant(), data);
    },
    ...options,
  });
}
