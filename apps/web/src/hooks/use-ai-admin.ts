'use client';

/**
 * TanStack Query hooks for AI admin operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as apiClient } from '@/lib/api-client';

/**
 * Aggregate usage statistics type
 */
export interface AggregateUsageStats {
  totalQuestions: number;
  totalDocuments: number;
  totalTasks: number;
  totalConversations: number;
  uniqueUsers: number;
  uniqueTenants: number;
  averageQuestionsPerUser: number;
  averageDocumentsPerUser: number;
  topUsers: Array<{
    userId: string;
    userName: string;
    tenantId: string;
    questionCount: number;
    documentCount: number;
    taskCount: number;
  }>;
  topTenants: Array<{
    tenantId: string;
    tenantName: string;
    userCount: number;
    questionCount: number;
    documentCount: number;
    taskCount: number;
  }>;
  usageByDate: Array<{
    date: string;
    questionCount: number;
    documentCount: number;
    taskCount: number;
  }>;
}

/**
 * Tenant usage statistics type
 */
export interface TenantUsageStats {
  tenantId: string;
  tenantName?: string;
  totalQuestions: number;
  totalDocuments: number;
  totalTasks: number;
  totalConversations: number;
  uniqueUsers: number;
  users: Array<{
    userId: string;
    userName: string;
    questionCount: number;
    documentCount: number;
    taskCount: number;
    lastActivity: string;
  }>;
  isAIEnabled: boolean;
}

/**
 * AI configuration type
 */
export interface AIConfiguration {
  id: string;
  tenant_id: string | null;
  config_key: string;
  config_value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch aggregate AI usage statistics
 */
export function useAdminUsage(startDate: string, endDate: string) {
  return useQuery<AggregateUsageStats>({
    queryKey: ['ai-admin-usage', startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get(
        `/ai/admin/usage?startDate=${startDate}&endDate=${endDate}`
      );
      return response.data;
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch tenant-specific AI usage statistics
 */
export function useTenantUsage(
  tenantId: string,
  startDate: string,
  endDate: string
) {
  return useQuery<TenantUsageStats>({
    queryKey: ['ai-admin-tenant-usage', tenantId, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get(
        `/ai/admin/tenants/${tenantId}/usage?startDate=${startDate}&endDate=${endDate}`
      );
      return response.data;
    },
    enabled: !!tenantId && !!startDate && !!endDate,
  });
}

/**
 * Hook to fetch AI configurations
 */
export function useAdminConfigs(tenantId?: string) {
  return useQuery<AIConfiguration[]>({
    queryKey: ['ai-admin-configs', tenantId],
    queryFn: async () => {
      const url = tenantId
        ? `/ai/admin/configurations?tenantId=${tenantId}`
        : '/ai/admin/configurations';
      const response = await apiClient.get(url);
      return response.data;
    },
  });
}

/**
 * Hook to disable AI for a tenant
 */
export function useDisableTenantAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiClient.post(`/ai/admin/tenants/${tenantId}/disable`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate tenant usage queries
      queryClient.invalidateQueries({ queryKey: ['ai-admin-tenant-usage'] });
      queryClient.invalidateQueries({ queryKey: ['ai-admin-usage'] });
    },
  });
}

/**
 * Hook to enable AI for a tenant
 */
export function useEnableTenantAI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiClient.post(`/ai/admin/tenants/${tenantId}/enable`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate tenant usage queries
      queryClient.invalidateQueries({ queryKey: ['ai-admin-tenant-usage'] });
      queryClient.invalidateQueries({ queryKey: ['ai-admin-usage'] });
    },
  });
}

/**
 * Hook to upsert a configuration
 */
export function useUpsertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      tenantId?: string;
      configKey: string;
      configValue: any;
      description?: string;
    }) => {
      const response = await apiClient.post('/ai/admin/configurations', {
        tenantId: data.tenantId || null,
        configKey: data.configKey,
        configValue: data.configValue,
        description: data.description,
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate configurations
      queryClient.invalidateQueries({ queryKey: ['ai-admin-configs'] });
    },
  });
}

/**
 * Hook to delete a configuration
 */
export function useDeleteConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { tenantId?: string; configKey: string }) => {
      const params = new URLSearchParams({
        configKey: data.configKey,
      });

      if (data.tenantId) {
        params.append('tenantId', data.tenantId);
      }

      const response = await apiClient.delete(
        `/ai/admin/configurations?${params.toString()}`
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate configurations
      queryClient.invalidateQueries({ queryKey: ['ai-admin-configs'] });
    },
  });
}
