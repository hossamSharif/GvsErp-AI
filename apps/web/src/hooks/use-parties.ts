/**
 * useParties Hook
 *
 * TanStack Query hooks for party (customer/supplier) management with caching and optimistic updates.
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
  Party,
  PartyWithSummary,
  PartyType,
  PartyQueryParams,
  CreatePartyInput,
  UpdatePartyInput,
  PartyBalanceSummary,
  PartyStatement,
  PartyStatementParams,
  CustomerBalanceReportParams,
  CustomerBalanceReportResponse,
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
    hasMore: boolean;
  };
}

interface PartyListResponse {
  success: boolean;
  data: Party[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const partyKeys = {
  all: ['parties'] as const,
  lists: () => [...partyKeys.all, 'list'] as const,
  list: (params: PartyQueryParams) => [...partyKeys.lists(), params] as const,
  details: () => [...partyKeys.all, 'detail'] as const,
  detail: (id: string) => [...partyKeys.details(), id] as const,
  balance: (id: string) => [...partyKeys.detail(id), 'balance'] as const,
  statement: (params: PartyStatementParams) => [...partyKeys.all, 'statement', params] as const,
  balanceSummary: (type?: PartyType) => [...partyKeys.all, 'balance-summary', type] as const,
  customerReport: (params: CustomerBalanceReportParams) =>
    [...partyKeys.all, 'customer-report', params] as const,
};

// =============================================================================
// PARTY QUERIES
// =============================================================================

/**
 * Fetch paginated list of parties
 */
export function useParties(
  params: PartyQueryParams = {},
  options?: Omit<UseQueryOptions<PartyListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.list(params),
    queryFn: async () => {
      const response = await api.get<PartyListResponse>('/parties', {
        type: params.type,
        search: params.search,
        isActive: params.isActive,
        hasBalance: params.hasBalance,
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
 * Fetch a single party by ID with summary
 */
export function useParty(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<PartyWithSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PartyWithSummary>>(`/parties/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch party balance
 */
export function usePartyBalance(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<{ balance: number }>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.balance(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ balance: number }>>(`/parties/${id}/balance`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch party statement
 */
export function usePartyStatement(
  params: PartyStatementParams,
  options?: Omit<UseQueryOptions<ApiResponse<PartyStatement>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.statement(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PartyStatement>>(
        `/parties/${params.partyId}/statement`,
        {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }
      );
      return response;
    },
    enabled: !!params.partyId,
    ...options,
  });
}

/**
 * Fetch balance summary for all parties
 */
export function useBalanceSummary(
  type?: PartyType,
  options?: Omit<UseQueryOptions<ApiResponse<PartyBalanceSummary[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.balanceSummary(type),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PartyBalanceSummary[]>>(
        '/parties/summary/balances',
        type ? { type } : {}
      );
      return response;
    },
    ...options,
  });
}

/**
 * Fetch customer balance report
 */
export function useCustomerBalanceReport(
  params: CustomerBalanceReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<CustomerBalanceReportResponse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: partyKeys.customerReport(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<CustomerBalanceReportResponse>>(
        '/parties/reports/customer-balances',
        {
          hasBalance: params.hasBalance,
          minBalance: params.minBalance,
          maxBalance: params.maxBalance,
          includeInactive: params.includeInactive,
        }
      );
      return response;
    },
    ...options,
  });
}

// =============================================================================
// PARTY MUTATIONS
// =============================================================================

/**
 * Create a new party
 */
export function useCreateParty(
  options?: UseMutationOptions<ApiResponse<Party>, Error, CreatePartyInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePartyInput) => {
      const response = await api.post<ApiResponse<Party>>('/parties', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate party lists
      queryClient.invalidateQueries({ queryKey: partyKeys.lists() });

      // Invalidate balance summary
      queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });

      // Set the detail cache
      queryClient.setQueryData(partyKeys.detail(data.data.id), data);
    },
    ...options,
  });
}

/**
 * Update an existing party
 */
export function useUpdateParty(
  options?: UseMutationOptions<ApiResponse<Party>, Error, { id: string; input: UpdatePartyInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePartyInput }) => {
      const response = await api.put<ApiResponse<Party>>(`/parties/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate party lists
      queryClient.invalidateQueries({ queryKey: partyKeys.lists() });

      // Invalidate party detail
      queryClient.invalidateQueries({ queryKey: partyKeys.detail(variables.id) });

      // Invalidate balance summary
      queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });
    },
    ...options,
  });
}

/**
 * Delete a party
 */
export function useDeleteParty(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/parties/${id}`);
    },
    onSuccess: (_, id) => {
      // Invalidate party lists
      queryClient.invalidateQueries({ queryKey: partyKeys.lists() });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: partyKeys.detail(id) });

      // Invalidate balance summary
      queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });
    },
    ...options,
  });
}

/**
 * Recalculate party balance
 */
export function useRecalculateBalance(
  options?: UseMutationOptions<ApiResponse<{ balance: number }>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<{ balance: number }>>(
        `/parties/${id}/recalculate-balance`
      );
      return response;
    },
    onSuccess: (_, id) => {
      // Invalidate party detail
      queryClient.invalidateQueries({ queryKey: partyKeys.detail(id) });

      // Invalidate balance
      queryClient.invalidateQueries({ queryKey: partyKeys.balance(id) });

      // Invalidate party lists (balance may have changed)
      queryClient.invalidateQueries({ queryKey: partyKeys.lists() });

      // Invalidate balance summary
      queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });
    },
    ...options,
  });
}
