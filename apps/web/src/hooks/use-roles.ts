/**
 * useRoles Hook
 *
 * TanStack Query hooks for role management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Role, CreateRoleInput, UpdateRoleInput } from '@erp-saas/shared';

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

interface RoleListResponse {
  success: boolean;
  data: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface RoleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isSystem?: boolean;
  sortBy?: 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (params: RoleQueryParams) => [...roleKeys.lists(), params] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
};

// =============================================================================
// ROLE QUERIES
// =============================================================================

/**
 * Fetch paginated list of roles
 */
export function useRoles(
  params: RoleQueryParams = {},
  options?: Omit<UseQueryOptions<RoleListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: async () => {
      const response = await api.get<RoleListResponse>('/roles', {
        search: params.search,
        isSystem: params.isSystem,
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
 * Fetch a single role by ID
 */
export function useRole(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Role>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: roleKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Role>>(`/roles/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// ROLE MUTATIONS
// =============================================================================

/**
 * Create a new role
 */
export function useCreateRole(
  options?: UseMutationOptions<ApiResponse<Role>, Error, CreateRoleInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRoleInput) => {
      const response = await api.post<ApiResponse<Role>>('/roles', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate role lists
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });

      // Set the detail cache
      queryClient.setQueryData(roleKeys.detail(data.data.id), data);
    },
    ...options,
  });
}

/**
 * Update an existing role
 */
export function useUpdateRole(
  options?: UseMutationOptions<ApiResponse<Role>, Error, { id: string; input: UpdateRoleInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateRoleInput }) => {
      const response = await api.put<ApiResponse<Role>>(`/roles/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate role lists
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });

      // Invalidate role detail
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a role
 */
export function useDeleteRole(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: (_, id) => {
      // Invalidate role lists
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: roleKeys.detail(id) });
    },
    ...options,
  });
}
