/**
 * usePayments Hook
 *
 * TanStack Query hooks for payment management with caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { partyKeys } from './use-parties';
import type {
  Payment,
  PaymentWithParty,
  PaymentWithRelations,
  PaymentQueryParams,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentReportParams,
  PaymentReportResponse,
} from '@erp-saas/shared';

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

interface PaymentListResponse {
  success: boolean;
  data: PaymentWithParty[];
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

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (params: PaymentQueryParams) => [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
  report: (params: PaymentReportParams) => [...paymentKeys.all, 'report', params] as const,
};

// =============================================================================
// PAYMENT QUERIES
// =============================================================================

/**
 * Fetch paginated list of payments
 */
export function usePayments(
  params: PaymentQueryParams = {},
  options?: Omit<UseQueryOptions<PaymentListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: async () => {
      const response = await api.get<PaymentListResponse>('/payments', {
        type: params.type,
        partyId: params.partyId,
        invoiceId: params.invoiceId,
        paymentMethod: params.paymentMethod,
        search: params.search,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
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
 * Fetch a single payment by ID with all relations
 */
export function usePayment(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<PaymentWithRelations>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: paymentKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaymentWithRelations>>(`/payments/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch payment report
 */
export function usePaymentReport(
  params: PaymentReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<PaymentReportResponse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: paymentKeys.report(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaymentReportResponse>>(
        '/payments/reports/summary',
        {
          type: params.type,
          partyId: params.partyId,
          partyType: params.partyType,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          paymentMethod: params.paymentMethod,
          includeSummary: params.includeSummary,
        }
      );
      return response;
    },
    ...options,
  });
}

// =============================================================================
// PAYMENT MUTATIONS
// =============================================================================

/**
 * Create a new payment
 */
export function useCreatePayment(
  options?: UseMutationOptions<ApiResponse<PaymentWithRelations>, Error, CreatePaymentInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const response = await api.post<ApiResponse<PaymentWithRelations>>('/payments', input);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate payment lists
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });

      // Set the detail cache
      queryClient.setQueryData(paymentKeys.detail(data.data.id), data);

      // Invalidate party details and balance (payment affects balance)
      if (data.data.partyId) {
        queryClient.invalidateQueries({ queryKey: partyKeys.detail(data.data.partyId) });
        queryClient.invalidateQueries({ queryKey: partyKeys.balance(data.data.partyId) });
        queryClient.invalidateQueries({ queryKey: partyKeys.lists() });
        queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });
      }
    },
    ...options,
  });
}

/**
 * Update an existing payment
 */
export function useUpdatePayment(
  options?: UseMutationOptions<ApiResponse<Payment>, Error, { id: string; input: UpdatePaymentInput }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePaymentInput }) => {
      const response = await api.put<ApiResponse<Payment>>(`/payments/${id}`, input);
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate payment lists
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });

      // Invalidate payment detail
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.id) });
    },
    ...options,
  });
}

/**
 * Delete a payment
 */
export function useDeletePayment(
  options?: UseMutationOptions<void, Error, { id: string; partyId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; partyId: string }) => {
      await api.delete(`/payments/${id}`);
    },
    onSuccess: (_, { id, partyId }) => {
      // Invalidate payment lists
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: paymentKeys.detail(id) });

      // Invalidate party details and balance (payment deletion affects balance)
      if (partyId) {
        queryClient.invalidateQueries({ queryKey: partyKeys.detail(partyId) });
        queryClient.invalidateQueries({ queryKey: partyKeys.balance(partyId) });
        queryClient.invalidateQueries({ queryKey: partyKeys.lists() });
        queryClient.invalidateQueries({ queryKey: partyKeys.balanceSummary() });
      }
    },
    ...options,
  });
}
