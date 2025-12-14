/**
 * useUsers Hook
 *
 * TanStack Query hooks for user management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { User, CreateUserInput, UpdateUserInput } from '@erp/shared';

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

interface UserListResponse {
  success: boolean;
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  roleId?: string;
  sortBy?: 'full_name' | 'email' | 'created_at';
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserQueryParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

// =============================================================================
// USER QUERIES
// =============================================================================

/**
 * Fetch paginated list of users
 */
export function useUsers(
  params: UserQueryParams = {},
  options?: Omit<UseQueryOptions<UserListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const response = await api.get<UserListResponse>('/users', {
        search: params.search,
        isActive: params.isActive,
        roleId: params.roleId,
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
 * Fetch a single user by ID
 */
export function useUser(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<User>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<User>>(`/users/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// USER MUTATIONS
// =============================================================================

/**
 * Create a new user
 */
export function useCreateUser(
  options?: UseMutationOptions<ApiResponse<User>, Error, CreateUserInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await api.post<ApiResponse<User>>('/users', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate user lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      // Set the detail cache
      queryClient.setQueryData(userKeys.detail(data.data.id), data);
    },
    ...options,
  });
}

/**
 * Update an existing user
 */
export function useUpdateUser(
  options?: UseMutationOptions<ApiResponse<User>, Error, { id: string; input: UpdateUserInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) => {
      const response = await api.put<ApiResponse<User>>(`/users/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate user lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      // Invalidate user detail
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a user
 */
export function useDeleteUser(options?: UseMutationOptions<void, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: (_, id) => {
      // Invalidate user lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: userKeys.detail(id) });
    },
    ...options,
  });
}
