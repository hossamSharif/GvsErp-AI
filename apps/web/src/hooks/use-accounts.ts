/**
 * Accounts Hook
 *
 * React Query hooks for chart of accounts management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Account,
  AccountType,
  CreateAccountInput,
  UpdateAccountInput,
} from '@erp/shared';
import { api } from '@/lib/api-client';

// Query keys
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: (filters: { type?: AccountType; tree?: boolean }) =>
    [...accountKeys.lists(), filters] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (id: string) => [...accountKeys.details(), id] as const,
  children: (id: string) => [...accountKeys.all, 'children', id] as const,
};

/**
 * Fetch all accounts (flat or tree structure)
 */
export function useAccounts(params?: { type?: AccountType; tree?: boolean }) {
  return useQuery({
    queryKey: accountKeys.list(params || {}),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.type) queryParams.append('type', params.type);
      if (params?.tree !== undefined) queryParams.append('tree', String(params.tree));

      const response = await api.get<{ data: Account[] }>(
        `/accounts?${queryParams.toString()}`
      );
      return response.data;
    },
  });
}

/**
 * Fetch account by ID
 */
export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: Account }>(`/accounts/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch child accounts
 */
export function useAccountChildren(id: string) {
  return useQuery({
    queryKey: accountKeys.children(id),
    queryFn: async () => {
      const response = await api.get<{ data: Account[] }>(
        `/accounts/${id}/children`
      );
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Create account
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAccountInput) => {
      const response = await api.post<{ data: Account }>('/accounts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}

/**
 * Update account
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAccountInput }) => {
      const response = await api.put<{ data: Account }>(`/accounts/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(variables.id) });
    },
  });
}

/**
 * Delete account
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
  });
}
