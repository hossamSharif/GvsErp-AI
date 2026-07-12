/**
 * useInvoices Hook
 *
 * TanStack Query hooks for invoice management with caching and optimistic updates.
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
  Invoice,
  InvoiceWithParty,
  InvoiceWithRelations,
  InvoiceQueryParams,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  FinalizeInvoiceInput,
  ReturnInvoiceInput,
  FinalizeInvoiceResult,
  ReturnInvoiceResult,
  SalesReportResponse,
  SalesReportParams,
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
    total_pages: number;
  };
}

interface InvoiceListResponse {
  success: boolean;
  data: InvoiceWithParty[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface FinalizeResponse {
  success: boolean;
  data: InvoiceWithRelations;
  meta: {
    stockMovements?: FinalizeInvoiceResult['stockMovements'];
    partyBalanceUpdate?: FinalizeInvoiceResult['partyBalanceUpdate'];
  };
}

interface ReturnResponse {
  success: boolean;
  data: {
    returnInvoice: InvoiceWithRelations;
    originalInvoice: InvoiceWithRelations;
  };
  meta: {
    stockMovements: ReturnInvoiceResult['stockMovements'];
  };
}

interface StockAvailabilityResponse {
  success: boolean;
  data: Record<string, number>;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (params: InvoiceQueryParams) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byNumber: (number: string) => [...invoiceKeys.all, 'by-number', number] as const,
  stockAvailability: (warehouseId: string, itemIds: string[]) =>
    [...invoiceKeys.all, 'stock', warehouseId, itemIds] as const,
  reports: () => [...invoiceKeys.all, 'reports'] as const,
  salesReport: (params: SalesReportParams) => [...invoiceKeys.reports(), 'sales', params] as const,
};

// =============================================================================
// INVOICE QUERIES
// =============================================================================

/**
 * Fetch paginated list of invoices
 */
export function useInvoices(
  params: InvoiceQueryParams = {},
  options?: Omit<UseQueryOptions<InvoiceListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: async () => {
      const response = await api.get<InvoiceListResponse>('/invoices', {
        type: params.type,
        status: params.status,
        partyId: params.partyId,
        warehouseId: params.warehouseId,
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
 * Fetch a single invoice by ID
 */
export function useInvoice(
  id: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<InvoiceWithRelations>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<InvoiceWithRelations>>(`/invoices/${id}`);
      return response;
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * Fetch invoice by invoice number
 */
export function useInvoiceByNumber(
  invoiceNumber: string | undefined,
  options?: Omit<UseQueryOptions<ApiResponse<Invoice>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.byNumber(invoiceNumber!),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Invoice>>(
        `/invoices/by-number/${invoiceNumber}`
      );
      return response;
    },
    enabled: !!invoiceNumber,
    ...options,
  });
}

/**
 * Fetch stock availability for items in a warehouse
 */
export function useStockAvailability(
  warehouseId: string | undefined,
  itemIds: string[],
  options?: Omit<UseQueryOptions<StockAvailabilityResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.stockAvailability(warehouseId!, itemIds),
    queryFn: async () => {
      const response = await api.post<StockAvailabilityResponse>(
        '/invoices/stock-availability',
        { warehouseId, itemIds }
      );
      return response;
    },
    enabled: !!warehouseId && itemIds.length > 0,
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch sales report
 */
export function useSalesReport(
  params: SalesReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<SalesReportResponse>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: invoiceKeys.salesReport(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<SalesReportResponse>>('/reports/sales', params);
      return response;
    },
    ...options,
  });
}

// =============================================================================
// INVOICE MUTATIONS
// =============================================================================

/**
 * Create a new invoice (draft)
 */
export function useCreateInvoice(
  options?: UseMutationOptions<ApiResponse<InvoiceWithRelations>, Error, CreateInvoiceInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const response = await api.post<ApiResponse<InvoiceWithRelations>>('/invoices', input);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    ...options,
  });
}

/**
 * Update a draft invoice
 */
export function useUpdateInvoice(
  options?: UseMutationOptions<
    ApiResponse<InvoiceWithRelations>,
    Error,
    { id: string; data: UpdateInvoiceInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInvoiceInput }) => {
      const response = await api.put<ApiResponse<InvoiceWithRelations>>(`/invoices/${id}`, data);
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(invoiceKeys.detail(variables.id), response);
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      // Editing a final invoice re-applies stock server-side; refresh warehouse views.
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    ...options,
  });
}

/**
 * Variable accepted by {@link useDeleteInvoice}. A bare string keeps the
 * existing callers working; the object form opts into cascade-deleting the
 * payments linked solely to this invoice (`deletePayments: true`).
 */
export type DeleteInvoiceVars = string | { id: string; deletePayments?: boolean };

/**
 * Hard-delete an invoice (any status). Stock + party balance are reversed
 * on the server before the row is removed. Pass `{ id, deletePayments: true }`
 * to also delete payments linked solely to this invoice.
 */
export function useDeleteInvoice(
  options?: UseMutationOptions<ApiResponse<{ id: string }>, Error, DeleteInvoiceVars>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: DeleteInvoiceVars) => {
      const id = typeof vars === 'string' ? vars : vars.id;
      const deletePayments = typeof vars === 'string' ? false : vars.deletePayments;
      const query = deletePayments ? '?deletePayments=true' : '';
      const response = await api.delete<ApiResponse<{ id: string }>>(
        `/invoices/${id}${query}`
      );
      return response;
    },
    onSuccess: (_, vars) => {
      const id = typeof vars === 'string' ? vars : vars.id;
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...invoiceKeys.all, 'stock'] });
      // Delete reverses stock movements; refresh warehouse views.
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      // A cascade delete removes payments too — refresh payment views.
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    ...options,
  });
}

/**
 * @deprecated Use useDeleteInvoice. The DELETE endpoint now hard-deletes
 * (with stock + balance reversal) for any invoice status.
 */
export const useCancelInvoice = useDeleteInvoice;

/**
 * Finalize an invoice
 */
export function useFinalizeInvoice(
  options?: UseMutationOptions<
    FinalizeResponse,
    Error,
    { id: string; data?: FinalizeInvoiceInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: FinalizeInvoiceInput }) => {
      const response = await api.post<FinalizeResponse>(`/invoices/${id}/finalize`, data || {});
      return response;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(invoiceKeys.detail(variables.id), {
        success: true,
        data: response.data,
      });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      // Invalidate stock queries since stock levels changed
      queryClient.invalidateQueries({ queryKey: [...invoiceKeys.all, 'stock'] });
      // Finalizing applies stock movements; refresh warehouse detail + stats.
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    ...options,
  });
}

/**
 * Create a return invoice
 */
export function useCreateReturn(
  options?: UseMutationOptions<
    ReturnResponse,
    Error,
    { originalInvoiceId: string; data: ReturnInvoiceInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      originalInvoiceId,
      data,
    }: {
      originalInvoiceId: string;
      data: ReturnInvoiceInput;
    }) => {
      const response = await api.post<ReturnResponse>(
        `/invoices/${originalInvoiceId}/return`,
        data
      );
      return response;
    },
    onSuccess: (response, variables) => {
      // Invalidate original invoice
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(variables.originalInvoiceId),
      });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      // Invalidate stock queries
      queryClient.invalidateQueries({ queryKey: [...invoiceKeys.all, 'stock'] });
      // Returns move stock; refresh warehouse views.
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    ...options,
  });
}

// =============================================================================
// PREFETCH HELPERS
// =============================================================================

/**
 * Prefetch invoice details
 */
export function usePrefetchInvoice() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: invoiceKeys.detail(id),
      queryFn: async () => {
        const response = await api.get<ApiResponse<InvoiceWithRelations>>(`/invoices/${id}`);
        return response;
      },
    });
  };
}

/**
 * Prefetch stock availability
 */
export function usePrefetchStockAvailability() {
  const queryClient = useQueryClient();

  return (warehouseId: string, itemIds: string[]) => {
    if (!warehouseId || itemIds.length === 0) return;

    queryClient.prefetchQuery({
      queryKey: invoiceKeys.stockAvailability(warehouseId, itemIds),
      queryFn: async () => {
        const response = await api.post<StockAvailabilityResponse>(
          '/invoices/stock-availability',
          { warehouseId, itemIds }
        );
        return response;
      },
      staleTime: 30000,
    });
  };
}
