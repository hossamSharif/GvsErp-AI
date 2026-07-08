/**
 * useExpiry Hooks
 *
 * TanStack Query hooks for item expiry alerts and reporting.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ExpiringItemAlert, ExpirySummary, ExpiryReportParams } from '@erp/shared';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    generatedAt: string;
  };
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const expiryKeys = {
  all: ['expiry'] as const,
  alerts: (params: ExpiryReportParams) => [...expiryKeys.all, 'alerts', params] as const,
  summary: () => [...expiryKeys.all, 'summary'] as const,
  report: (params: ExpiryReportParams) => [...expiryKeys.all, 'report', params] as const,
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Fetch items expiring within a threshold, with severity
 */
export function useExpiringItems(
  params: ExpiryReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<ExpiringItemAlert[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expiryKeys.alerts(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpiringItemAlert[]>>('/items/alerts/expiring', {
        days: params.daysThreshold,
        severity: params.severity,
      });
      return response;
    },
    ...options,
  });
}

/**
 * Fetch expiry summary counts for the dashboard widget
 */
export function useExpirySummary(
  options?: Omit<UseQueryOptions<ApiResponse<ExpirySummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expiryKeys.summary(),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpirySummary>>('/items/alerts/expiry-summary');
      return response;
    },
    ...options,
  });
}

/**
 * Fetch the expiry report (same data as alerts, dedicated report endpoint)
 */
export function useExpiryReport(
  params: ExpiryReportParams = {},
  options?: Omit<UseQueryOptions<ApiResponse<ExpiringItemAlert[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: expiryKeys.report(params),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ExpiringItemAlert[]>>('/items/report/expiry', {
        days: params.daysThreshold,
        severity: params.severity,
      });
      return response;
    },
    ...options,
  });
}
