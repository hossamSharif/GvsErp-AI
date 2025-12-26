/**
 * AI Usage Service
 * Handles usage tracking, statistics, and tier limit enforcement
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type {
  UsageStats,
  UsageActionType,
  UsageRecord,
  TierLimits,
  SubscriptionTier,
} from '@erp-saas/shared';
import { AIUsageRepository } from '../repositories/ai-usage.repository';

/**
 * Tier limits configuration
 * Matches database ai_tier_limits
 */
const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    questions_per_day: 10,
    questions_per_month: 100,
    documents_per_day: 2,
    documents_per_month: 20,
    tasks_per_day: 5,
    tasks_per_month: 50,
    max_document_size: 5242880, // 5MB
  },
  basic: {
    questions_per_day: 50,
    questions_per_month: 1000,
    documents_per_day: 10,
    documents_per_month: 200,
    tasks_per_day: 25,
    tasks_per_month: 500,
    max_document_size: 10485760, // 10MB
  },
  professional: {
    questions_per_day: 200,
    questions_per_month: 5000,
    documents_per_day: 50,
    documents_per_month: 1000,
    tasks_per_day: 100,
    tasks_per_month: 2000,
    max_document_size: 10485760, // 10MB
  },
  enterprise: {
    questions_per_day: -1, // Unlimited
    questions_per_month: -1,
    documents_per_day: -1,
    documents_per_month: -1,
    tasks_per_day: -1,
    tasks_per_month: -1,
    max_document_size: 10485760, // 10MB
  },
};

/**
 * Usage check result
 */
export interface UsageCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  period: 'day' | 'month';
  tier: SubscriptionTier;
  upgradeRequired?: boolean;
}

/**
 * AI Usage Service
 * Manages usage tracking and limit enforcement
 */
export class AIUsageService {
  private usageRepo: AIUsageRepository;

  constructor(private supabase: SupabaseClient<Database>) {
    this.usageRepo = new AIUsageRepository(supabase);
  }

  /**
   * Check if user can perform an action based on tier limits
   * @param userId - User ID
   * @param actionType - Type of action
   * @returns Usage check result
   */
  async checkUsageLimit(
    userId: string,
    actionType: UsageActionType
  ): Promise<UsageCheckResult> {
    // Get user's subscription tier
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier];

    // Get current usage counts
    const todayUsage = await this.usageRepo.getUsageCount(userId, actionType, 'today');
    const monthUsage = await this.usageRepo.getUsageCount(userId, actionType, 'month');

    // Determine which limit to check based on action type
    let dailyLimit: number;
    let monthlyLimit: number;

    switch (actionType) {
      case 'question':
        dailyLimit = limits.questions_per_day;
        monthlyLimit = limits.questions_per_month;
        break;
      case 'document_upload':
        dailyLimit = limits.documents_per_day;
        monthlyLimit = limits.documents_per_month;
        break;
      case 'task_creation':
        dailyLimit = limits.tasks_per_day;
        monthlyLimit = limits.tasks_per_month;
        break;
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    // Enterprise tier has unlimited (-1)
    if (dailyLimit === -1 && monthlyLimit === -1) {
      return {
        allowed: true,
        currentUsage: todayUsage,
        limit: -1,
        period: 'day',
        tier,
      };
    }

    // Check daily limit first (more restrictive)
    if (todayUsage >= dailyLimit) {
      return {
        allowed: false,
        currentUsage: todayUsage,
        limit: dailyLimit,
        period: 'day',
        tier,
        upgradeRequired: tier !== 'enterprise',
      };
    }

    // Check monthly limit
    if (monthUsage >= monthlyLimit) {
      return {
        allowed: false,
        currentUsage: monthUsage,
        limit: monthlyLimit,
        period: 'month',
        tier,
        upgradeRequired: tier !== 'enterprise',
      };
    }

    return {
      allowed: true,
      currentUsage: todayUsage,
      limit: dailyLimit,
      period: 'day',
      tier,
    };
  }

  /**
   * Get user's subscription tier
   * @param userId - User ID
   * @returns Subscription tier
   */
  private async getUserTier(userId: string): Promise<SubscriptionTier> {
    const { data, error } = await this.supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 'free'; // Default to free tier
    }

    return (data.subscription_tier as SubscriptionTier) || 'free';
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
    return this.usageRepo.getUserUsageStats(userId, period);
  }

  /**
   * Get usage statistics with limits
   * @param userId - User ID
   * @returns Usage stats with tier limits
   */
  async getUserUsageWithLimits(userId: string) {
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier];

    const [todayStats, monthStats] = await Promise.all([
      this.getUserUsageStats(userId, 'today'),
      this.getUserUsageStats(userId, 'month'),
    ]);

    return {
      tier,
      limits,
      today: todayStats,
      month: monthStats,
      percentages: {
        questions_today:
          limits.questions_per_day === -1
            ? 0
            : (todayStats.questions / limits.questions_per_day) * 100,
        questions_month:
          limits.questions_per_month === -1
            ? 0
            : (monthStats.questions / limits.questions_per_month) * 100,
        documents_today:
          limits.documents_per_day === -1
            ? 0
            : (todayStats.documents / limits.documents_per_day) * 100,
        documents_month:
          limits.documents_per_month === -1
            ? 0
            : (monthStats.documents / limits.documents_per_month) * 100,
        tasks_today:
          limits.tasks_per_day === -1
            ? 0
            : (todayStats.tasks / limits.tasks_per_day) * 100,
        tasks_month:
          limits.tasks_per_month === -1
            ? 0
            : (monthStats.tasks / limits.tasks_per_month) * 100,
      },
    };
  }

  /**
   * Track document file size against tier limits
   * @param userId - User ID
   * @param fileSize - File size in bytes
   * @returns Whether file size is within limits
   */
  async checkDocumentSizeLimit(
    userId: string,
    fileSize: number
  ): Promise<{ allowed: boolean; limit: number; tier: SubscriptionTier }> {
    const tier = await this.getUserTier(userId);
    const limits = TIER_LIMITS[tier];

    return {
      allowed: fileSize <= limits.max_document_size,
      limit: limits.max_document_size,
      tier,
    };
  }

  /**
   * Get usage records for a tenant
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @param limit - Maximum records
   * @returns Array of usage records
   */
  async getTenantUsage(
    tenantId: string,
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<UsageRecord[]> {
    return this.usageRepo.getTenantUsage(tenantId, startDate, endDate, limit);
  }

  /**
   * Get usage aggregated by model
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Map of model to usage count
   */
  async getUsageByModel(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Record<string, number>> {
    return this.usageRepo.getUsageByModel(tenantId, startDate, endDate);
  }

  /**
   * Get total cost for a tenant in a period
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Total estimated cost in USD
   */
  async getTotalCost(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    return this.usageRepo.getTotalCost(tenantId, startDate, endDate);
  }

  /**
   * Get tier limits for a specific tier
   * @param tier - Subscription tier
   * @returns Tier limits
   */
  getTierLimits(tier: SubscriptionTier): TierLimits {
    return TIER_LIMITS[tier];
  }

  /**
   * Get all tier limits
   * @returns All tier limits
   */
  getAllTierLimits(): Record<SubscriptionTier, TierLimits> {
    return TIER_LIMITS;
  }

  /**
   * Check if user needs to upgrade based on usage
   * @param userId - User ID
   * @returns Whether upgrade is recommended
   */
  async shouldRecommendUpgrade(userId: string): Promise<{
    recommend: boolean;
    reason?: string;
    currentTier: SubscriptionTier;
    suggestedTier?: SubscriptionTier;
  }> {
    const tier = await this.getUserTier(userId);

    // Enterprise users don't need to upgrade
    if (tier === 'enterprise') {
      return { recommend: false, currentTier: tier };
    }

    const stats = await this.getUserUsageWithLimits(userId);

    // Check if hitting limits (>80% usage)
    const hitting80Percent =
      stats.percentages.questions_today > 80 ||
      stats.percentages.questions_month > 80 ||
      stats.percentages.documents_today > 80 ||
      stats.percentages.documents_month > 80 ||
      stats.percentages.tasks_today > 80 ||
      stats.percentages.tasks_month > 80;

    if (!hitting80Percent) {
      return { recommend: false, currentTier: tier };
    }

    // Suggest next tier
    const tierProgression: SubscriptionTier[] = [
      'free',
      'basic',
      'professional',
      'enterprise',
    ];
    const currentIndex = tierProgression.indexOf(tier);
    const suggestedTier = tierProgression[currentIndex + 1];

    return {
      recommend: true,
      reason: 'You are approaching your usage limits for the current billing period.',
      currentTier: tier,
      suggestedTier,
    };
  }

  /**
   * Clean up old usage records (older than 90 days)
   * @returns Number of records deleted
   */
  async cleanupOldRecords(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this.usageRepo.deleteOldRecords(ninetyDaysAgo.toISOString());
  }

  /**
   * Get usage summary for admin dashboard
   * @param tenantId - Tenant ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Usage summary
   */
  async getUsageSummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ) {
    const [usageByModel, totalCost, records] = await Promise.all([
      this.getUsageByModel(tenantId, startDate, endDate),
      this.getTotalCost(tenantId, startDate, endDate),
      this.getTenantUsage(tenantId, startDate, endDate, 1000),
    ]);

    // Calculate totals
    const totalQuestions = records.filter((r) => r.actionType === 'question').length;
    const totalDocuments = records.filter(
      (r) => r.actionType === 'document_upload'
    ).length;
    const totalTasks = records.filter((r) => r.actionType === 'task_creation').length;

    const totalTokens = records.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      totals: {
        questions: totalQuestions,
        documents: totalDocuments,
        tasks: totalTasks,
        tokens: totalTokens,
        cost: totalCost,
      },
      byModel: usageByModel,
      averageTokensPerQuestion:
        totalQuestions > 0 ? Math.round(totalTokens / totalQuestions) : 0,
    };
  }
}
