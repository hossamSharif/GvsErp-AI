/**
 * useAuditLogs Hook
 * TanStack Query hooks for audit log management
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type {
  AuditLog,
  AuditLogQueryParams,
  AuditEntityType,
} from '@erp/shared';
import type { PaginatedResponse } from '@erp/shared';

// ===== Audit Log Queries =====

/**
 * Get all audit logs with filters
 */
export function useAuditLogs(params: AuditLogQueryParams = {}) {
  const { page = 1, limit = 50, ...filters } = params;

  return useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['audit-logs', filters, page, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (filters.userId) searchParams.append('userId', filters.userId);
      if (filters.entityType) searchParams.append('entityType', filters.entityType);
      if (filters.entityId) searchParams.append('entityId', filters.entityId);
      if (filters.action) searchParams.append('action', filters.action);
      if (filters.dateFrom) searchParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) searchParams.append('dateTo', filters.dateTo);
      searchParams.append('page', page.toString());
      searchParams.append('limit', limit.toString());

      const response = await api.get(`/audit-logs?${searchParams.toString()}`);
      return response.data;
    },
  });
}

/**
 * Get audit logs for a specific entity
 */
export function useEntityAuditLogs(
  entityType: AuditEntityType,
  entityId: string,
  limit: number = 50
) {
  return useQuery<AuditLog[]>({
    queryKey: ['audit-logs', 'entity', entityType, entityId, limit],
    queryFn: async () => {
      const response = await api.get(
        `/audit-logs/entity/${entityType}/${entityId}?limit=${limit}`
      );
      return response.data;
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Get recent audit logs for the current user
 */
export function useUserRecentAuditLogs(limit: number = 20) {
  return useQuery<AuditLog[]>({
    queryKey: ['audit-logs', 'user', 'recent', limit],
    queryFn: async () => {
      const response = await api.get(`/audit-logs/user/recent?limit=${limit}`);
      return response.data;
    },
  });
}

/**
 * Calculate diff between old and new values
 */
export function useAuditDiff(
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null
) {
  return useQuery<{ field: string; oldValue: any; newValue: any }[]>({
    queryKey: ['audit-logs', 'diff', oldValues, newValues],
    queryFn: async () => {
      const response = await api.post('/audit-logs/diff', {
        oldValues,
        newValues,
      });
      return response.data;
    },
    enabled: !!(oldValues || newValues),
  });
}
