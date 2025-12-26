/**
 * AI Admin Service
 * Handles admin operations for AI usage monitoring and configuration
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';

/**
 * Aggregate usage statistics for admin dashboard
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
 * Tenant usage statistics
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
 * AI configuration for admin
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
 * AI Admin Service
 * Provides admin-level operations for monitoring and managing AI usage
 */
export class AIAdminService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get aggregate usage statistics across all tenants
   * @param startDate - Start date for statistics
   * @param endDate - End date for statistics
   * @returns Aggregate usage stats
   */
  async getAggregateUsage(
    startDate: string,
    endDate: string
  ): Promise<AggregateUsageStats> {
    // Get total counts
    const { data: usageRecords, error } = await this.supabase
      .from('ai_usage_records')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const records = usageRecords || [];

    // Calculate aggregate stats
    const totalQuestions = records.filter((r) => r.action_type === 'question').length;
    const totalDocuments = records.filter((r) => r.action_type === 'document_upload').length;
    const totalTasks = records.filter((r) => r.action_type === 'task_generated').length;

    const uniqueUsers = new Set(records.map((r) => r.user_id)).size;
    const uniqueTenants = new Set(records.map((r) => r.tenant_id)).size;

    // Get conversation count
    const { count: conversationCount } = await this.supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Calculate averages
    const averageQuestionsPerUser = uniqueUsers > 0 ? totalQuestions / uniqueUsers : 0;
    const averageDocumentsPerUser = uniqueUsers > 0 ? totalDocuments / uniqueUsers : 0;

    // Get top users (simplified - would need joins for real names)
    const userUsage = new Map<string, any>();
    records.forEach((record) => {
      const key = `${record.user_id}:${record.tenant_id}`;
      if (!userUsage.has(key)) {
        userUsage.set(key, {
          userId: record.user_id,
          userName: record.user_id, // Would need user table join
          tenantId: record.tenant_id,
          questionCount: 0,
          documentCount: 0,
          taskCount: 0,
        });
      }
      const user = userUsage.get(key);
      if (record.action_type === 'question') user.questionCount++;
      if (record.action_type === 'document_upload') user.documentCount++;
      if (record.action_type === 'task_generated') user.taskCount++;
    });

    const topUsers = Array.from(userUsage.values())
      .sort((a, b) => b.questionCount - a.questionCount)
      .slice(0, 10);

    // Get top tenants
    const tenantUsage = new Map<string, any>();
    records.forEach((record) => {
      if (!tenantUsage.has(record.tenant_id)) {
        tenantUsage.set(record.tenant_id, {
          tenantId: record.tenant_id,
          tenantName: record.tenant_id, // Would need tenant table join
          userCount: new Set(),
          questionCount: 0,
          documentCount: 0,
          taskCount: 0,
        });
      }
      const tenant = tenantUsage.get(record.tenant_id);
      tenant.userCount.add(record.user_id);
      if (record.action_type === 'question') tenant.questionCount++;
      if (record.action_type === 'document_upload') tenant.documentCount++;
      if (record.action_type === 'task_generated') tenant.taskCount++;
    });

    const topTenants = Array.from(tenantUsage.values())
      .map((t) => ({ ...t, userCount: t.userCount.size }))
      .sort((a, b) => b.questionCount - a.questionCount)
      .slice(0, 10);

    // Get usage by date
    const usageByDate = new Map<string, any>();
    records.forEach((record) => {
      const date = record.created_at.split('T')[0];
      if (!usageByDate.has(date)) {
        usageByDate.set(date, {
          date,
          questionCount: 0,
          documentCount: 0,
          taskCount: 0,
        });
      }
      const day = usageByDate.get(date);
      if (record.action_type === 'question') day.questionCount++;
      if (record.action_type === 'document_upload') day.documentCount++;
      if (record.action_type === 'task_generated') day.taskCount++;
    });

    return {
      totalQuestions,
      totalDocuments,
      totalTasks,
      totalConversations: conversationCount || 0,
      uniqueUsers,
      uniqueTenants,
      averageQuestionsPerUser: Math.round(averageQuestionsPerUser * 100) / 100,
      averageDocumentsPerUser: Math.round(averageDocumentsPerUser * 100) / 100,
      topUsers,
      topTenants,
      usageByDate: Array.from(usageByDate.values()).sort(
        (a, b) => a.date.localeCompare(b.date)
      ),
    };
  }

  /**
   * Get usage statistics for a specific tenant
   * @param tenantId - Tenant ID
   * @param startDate - Start date for statistics
   * @param endDate - End date for statistics
   * @returns Tenant usage stats
   */
  async getTenantUsage(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<TenantUsageStats> {
    // Get usage records for tenant
    const { data: usageRecords, error } = await this.supabase
      .from('ai_usage_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const records = usageRecords || [];

    // Calculate stats
    const totalQuestions = records.filter((r) => r.action_type === 'question').length;
    const totalDocuments = records.filter((r) => r.action_type === 'document_upload').length;
    const totalTasks = records.filter((r) => r.action_type === 'task_generated').length;

    // Get conversation count
    const { count: conversationCount } = await this.supabase
      .from('ai_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get unique users
    const userUsage = new Map<string, any>();
    records.forEach((record) => {
      if (!userUsage.has(record.user_id)) {
        userUsage.set(record.user_id, {
          userId: record.user_id,
          userName: record.user_id, // Would need user table join
          questionCount: 0,
          documentCount: 0,
          taskCount: 0,
          lastActivity: record.created_at,
        });
      }
      const user = userUsage.get(record.user_id);
      if (record.action_type === 'question') user.questionCount++;
      if (record.action_type === 'document_upload') user.documentCount++;
      if (record.action_type === 'task_generated') user.taskCount++;
      if (record.created_at > user.lastActivity) {
        user.lastActivity = record.created_at;
      }
    });

    // Check if AI is enabled for tenant
    const { data: config } = await this.supabase
      .from('ai_configurations')
      .select('config_value')
      .eq('tenant_id', tenantId)
      .eq('config_key', 'ai_enabled')
      .single();

    const isAIEnabled = config?.config_value?.enabled !== false;

    return {
      tenantId,
      totalQuestions,
      totalDocuments,
      totalTasks,
      totalConversations: conversationCount || 0,
      uniqueUsers: userUsage.size,
      users: Array.from(userUsage.values()),
      isAIEnabled,
    };
  }

  /**
   * Disable AI for a specific tenant
   * @param tenantId - Tenant ID
   */
  async disableTenantAI(tenantId: string): Promise<void> {
    await this.upsertConfiguration(tenantId, 'ai_enabled', {
      enabled: false,
      disabled_at: new Date().toISOString(),
    }, 'AI feature disabled for tenant');
  }

  /**
   * Enable AI for a specific tenant
   * @param tenantId - Tenant ID
   */
  async enableTenantAI(tenantId: string): Promise<void> {
    await this.upsertConfiguration(tenantId, 'ai_enabled', {
      enabled: true,
      enabled_at: new Date().toISOString(),
    }, 'AI feature enabled for tenant');
  }

  /**
   * Get all configurations
   * @param tenantId - Optional tenant ID to filter by
   * @returns Array of configurations
   */
  async getConfigurations(tenantId?: string): Promise<AIConfiguration[]> {
    let query = this.supabase
      .from('ai_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as AIConfiguration[];
  }

  /**
   * Upsert a configuration
   * @param tenantId - Tenant ID (null for global config)
   * @param configKey - Configuration key
   * @param configValue - Configuration value
   * @param description - Configuration description
   * @returns Created/updated configuration
   */
  async upsertConfiguration(
    tenantId: string | null,
    configKey: string,
    configValue: any,
    description?: string
  ): Promise<AIConfiguration> {
    const { data, error } = await this.supabase
      .from('ai_configurations')
      .upsert(
        {
          tenant_id: tenantId,
          config_key: configKey,
          config_value: configValue,
          description: description || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,config_key',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return data as AIConfiguration;
  }

  /**
   * Delete a configuration
   * @param tenantId - Tenant ID (null for global config)
   * @param configKey - Configuration key
   */
  async deleteConfiguration(
    tenantId: string | null,
    configKey: string
  ): Promise<void> {
    let query = this.supabase
      .from('ai_configurations')
      .delete()
      .eq('config_key', configKey);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { error } = await query;

    if (error) throw error;
  }
}
