/**
 * AI Usage Repository
 * Handles data access for AI usage tracking and tier limits
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository } from './base.repository';
import type { UsageRecord, UsageActionType, UsageStats } from '@erp-saas/shared';

type UsageRecordRow = Database['public']['Tables']['ai_usage_records']['Row'];
type UsageRecordInsert = Database['public']['Tables']['ai_usage_records']['Insert'];
type UsageRecordUpdate = Database['public']['Tables']['ai_usage_records']['Update'];

/**
 * Repository for AI Usage Record entity
 */
export class AIUsageRepository extends BaseRepository<
  'ai_usage_records',
  UsageRecordRow,
  UsageRecordInsert,
  UsageRecordUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'ai_usage_records');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Usage records don't have is_active
  }

  /**
   * Track AI usage
   * @param record - Usage record to insert
   * @returns Created usage record
   */
  async trackUsage(record: UsageRecordInsert): Promise<UsageRecord> {
    const { data, error } = await this.supabase
      .from('ai_usage_records')
      .insert(record)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as UsageRecord;
  }

  /**
   * Get usage statistics for a user
   * @param userId - User ID
   * @param period - Time period ('today' or 'month')
   * @returns Usage statistics
   */
  async getUserUsageStats(
    userId: string,
    period: 'today' | 'month' = 'today'
  ): Promise<UsageStats> {
    // Use database function for accurate counts
    const { data, error } = await this.supabase.rpc('get_user_ai_usage', {
      p_user_id: userId,
      p_period: period,
    });

    if (error) {
      throw error;
    }

    // Calculate total tokens and estimated cost
    const startDate =
      period === 'today'
        ? new Date().toISOString().split('T')[0]
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .split('T')[0];

    const { data: usageData } = await this.supabase
      .from('ai_usage_records')
      .select('tokens_used, cost_estimate')
      .eq('user_id', userId)
      .gte('created_at', startDate);

    const totalTokens = (usageData || []).reduce(
      (sum, record) => sum + (record.tokens_used || 0),
      0
    );

    const estimatedCost = (usageData || []).reduce(
      (sum, record) => sum + (Number(record.cost_estimate) || 0),
      0
    );

    return {
      questions: data?.questions || 0,
      documents: data?.documents || 0,
      tasks: data?.tasks || 0,
      totalTokens,
      estimatedCost,
    };
  }

  /**
   * Get usage count by action type for a user
   * @param userId - User ID
   * @param actionType - Type of action
   * @param period - Time period ('today' or 'month')
   * @returns Usage count
   */
  async getUsageCount(
    userId: string,
    actionType: UsageActionType,
    period: 'today' | 'month' = 'today'
  ): Promise<number> {
    const startDate =
      period === 'today'
        ? new Date().toISOString().split('T')[0]
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .split('T')[0];

    const { count, error } = await this.supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .gte('created_at', startDate);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Get usage records for a tenant
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @param limit - Maximum records to return
   * @returns Array of usage records
   */
  async getTenantUsage(
    tenantId: string,
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<UsageRecord[]> {
    const { data, error } = await this.supabase
      .from('ai_usage_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as UsageRecord[];
  }

  /**
   * Get usage records for a conversation
   * @param conversationId - Conversation ID
   * @returns Array of usage records
   */
  async getConversationUsage(
    conversationId: string
  ): Promise<UsageRecord[]> {
    const { data, error } = await this.supabase
      .from('ai_usage_records')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as UsageRecord[];
  }

  /**
   * Get aggregated usage by model
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Map of model name to usage count
   */
  async getUsageByModel(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('ai_usage_records')
      .select('model_used')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw error;
    }

    // Aggregate by model
    const modelCounts: Record<string, number> = {};
    (data || []).forEach((record) => {
      const model = record.model_used || 'unknown';
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });

    return modelCounts;
  }

  /**
   * Get total cost for a tenant in a period
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Total estimated cost
   */
  async getTotalCost(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('ai_usage_records')
      .select('cost_estimate')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw error;
    }

    return (data || []).reduce(
      (sum, record) => sum + (Number(record.cost_estimate) || 0),
      0
    );
  }

  /**
   * Delete usage records older than specified date
   * @param beforeDate - Date before which to delete records
   */
  async deleteOldRecords(beforeDate: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('ai_usage_records')
      .delete({ count: 'exact' })
      .lt('created_at', beforeDate);

    if (error) {
      throw error;
    }

    return count || 0;
  }
}
