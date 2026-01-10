/**
 * AI Usage Hooks
 * TanStack Query hooks for AI usage tracking and limits
 */

import { useQuery } from '@tanstack/react-query';
import { api as apiClient } from '@/lib/api-client';
import type {
  UsageStats,
  TierLimits,
  SubscriptionTier,
  UsageActionType,
} from '@erp-saas/shared';

const AI_USAGE_KEY = 'ai-usage';

/**
 * Usage statistics with tier limits
 */
interface UsageWithLimits {
  tier: SubscriptionTier;
  limits: TierLimits;
  today: UsageStats;
  month: UsageStats;
  percentages: {
    questions_today: number;
    questions_month: number;
    documents_today: number;
    documents_month: number;
    tasks_today: number;
    tasks_month: number;
  };
}

/**
 * Usage check result
 */
interface UsageCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  period: 'day' | 'month';
  tier: SubscriptionTier;
  upgradeRequired?: boolean;
}

/**
 * Upgrade recommendation
 */
interface UpgradeRecommendation {
  recommend: boolean;
  reason?: string;
  currentTier: SubscriptionTier;
  suggestedTier?: SubscriptionTier;
}

/**
 * Fetch usage stats with limits
 */
async function fetchUsageStats(): Promise<UsageWithLimits> {
  const { data } = await apiClient.get('/ai/usage/stats');
  return data;
}

/**
 * Check if action is allowed
 */
async function checkUsageLimit(
  actionType: UsageActionType
): Promise<UsageCheckResult> {
  const { data } = await apiClient.get(`/ai/usage/check/${actionType}`);
  return data;
}

/**
 * Get upgrade recommendation
 */
async function fetchUpgradeRecommendation(): Promise<UpgradeRecommendation> {
  const { data } = await apiClient.get('/ai/usage/upgrade-recommendation');
  return data;
}

/**
 * Hook: Get usage statistics
 */
export function useUsageStats() {
  return useQuery({
    queryKey: [AI_USAGE_KEY, 'stats'],
    queryFn: fetchUsageStats,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook: Check usage limit for action
 */
export function useUsageCheck(actionType: UsageActionType) {
  return useQuery({
    queryKey: [AI_USAGE_KEY, 'check', actionType],
    queryFn: () => checkUsageLimit(actionType),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook: Get upgrade recommendation
 */
export function useUpgradeRecommendation() {
  return useQuery({
    queryKey: [AI_USAGE_KEY, 'upgrade-recommendation'],
    queryFn: fetchUpgradeRecommendation,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Hook: Calculate usage percentage for UI
 */
export function useUsagePercentage() {
  const { data: usage } = useUsageStats();

  if (!usage) {
    return {
      questions: 0,
      documents: 0,
      tasks: 0,
      isNearLimit: false,
      isAtLimit: false,
    };
  }

  const maxPercentage = Math.max(
    usage.percentages.questions_today,
    usage.percentages.documents_today,
    usage.percentages.tasks_today
  );

  return {
    questions: usage.percentages.questions_today,
    documents: usage.percentages.documents_today,
    tasks: usage.percentages.tasks_today,
    isNearLimit: maxPercentage >= 80,
    isAtLimit: maxPercentage >= 100,
  };
}

/**
 * Hook: Get remaining usage for display
 */
export function useRemainingUsage() {
  const { data: usage } = useUsageStats();

  if (!usage) {
    return {
      questions: { used: 0, limit: 0, remaining: 0 },
      documents: { used: 0, limit: 0, remaining: 0 },
      tasks: { used: 0, limit: 0, remaining: 0 },
    };
  }

  const questionsLimit =
    usage.limits.questions_per_day === -1
      ? Infinity
      : usage.limits.questions_per_day;
  const documentsLimit =
    usage.limits.documents_per_day === -1
      ? Infinity
      : usage.limits.documents_per_day;
  const tasksLimit =
    usage.limits.tasks_per_day === -1 ? Infinity : usage.limits.tasks_per_day;

  return {
    questions: {
      used: usage.today.questions,
      limit: questionsLimit,
      remaining: questionsLimit === Infinity ? Infinity : questionsLimit - usage.today.questions,
    },
    documents: {
      used: usage.today.documents,
      limit: documentsLimit,
      remaining: documentsLimit === Infinity ? Infinity : documentsLimit - usage.today.documents,
    },
    tasks: {
      used: usage.today.tasks,
      limit: tasksLimit,
      remaining: tasksLimit === Infinity ? Infinity : tasksLimit - usage.today.tasks,
    },
  };
}
