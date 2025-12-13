/**
 * useCategories Hook
 *
 * TanStack Query hooks for category management.
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
  Category,
  CategoryWithChildren,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@erp/shared';

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

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (params?: { parentId?: string | null; includeTree?: boolean }) =>
    [...categoryKeys.lists(), params] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
  path: (id: string) => [...categoryKeys.detail(id), 'path'] as const,
};

// =============================================================================
// CATEGORY QUERIES
// =============================================================================

/**
 * Fetch all categories as a flat list
 */
export function useCategories(
  options?: Omit<UseQueryOptions<ApiResponse<Category[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category[]>>('/categories');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch categories as a tree structure
 */
export function useCategoryTree(
  options?: Omit<UseQueryOptions<ApiResponse<CategoryWithChildren[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<CategoryWithChildren[]>>('/categories', {
        includeTree: true,
      });
      return response;
    },
    ...options,
  });
}

/**
 * Fetch root categories
 */
export function useRootCategories(
  options?: Omit<UseQueryOptions<ApiResponse<Category[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.list({ parentId: null }),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category[]>>('/categories', {
        parentId: 'null',
      });
      return response;
    },
    ...options,
  });
}

/**
 * Fetch children of a category
 */
export function useCategoryChildren(
  parentId: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Category[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.list({ parentId }),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category[]>>('/categories', {
        parentId,
      });
      return response;
    },
    enabled: !!parentId,
    ...options,
  });
}

/**
 * Fetch a single category by ID
 */
export function useCategory(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Category>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category>>(`/categories/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch category path (breadcrumb)
 */
export function useCategoryPath(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Category[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: categoryKeys.path(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Category[]>>(`/categories/${id}/path`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// CATEGORY MUTATIONS
// =============================================================================

/**
 * Create a new category
 */
export function useCreateCategory(
  options?: UseMutationOptions<ApiResponse<Category>, Error, CreateCategoryInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const response = await api.post<ApiResponse<Category>>('/categories', input);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
    ...options,
  });
}

/**
 * Update a category
 */
export function useUpdateCategory(
  options?: UseMutationOptions<
    ApiResponse<Category>,
    Error,
    { id: string; data: UpdateCategoryInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCategoryInput }) => {
      const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree() });
    },
    ...options,
  });
}

/**
 * Delete a category
 */
export function useDeleteCategory(
  options?: UseMutationOptions<ApiResponse<{ message: string }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<ApiResponse<{ message: string }>>(`/categories/${id}`);
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree() });
    },
    ...options,
  });
}
