/**
 * AI Rate Limiting Middleware
 * Enforces tiered rate limits for AI Agent operations
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type { UsageActionType } from '@erp-saas/shared';
import { AppError } from './error';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * In-memory rate limiter for per-minute limits
 * Uses sliding window approach
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   * @param key - User or IP identifier
   * @returns True if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Filter out old requests outside the window
    const recentRequests = timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  /**
   * Get remaining requests in window
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const recentRequests = timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  /**
   * Cleanup old entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(
        (timestamp) => now - timestamp < this.windowMs
      );
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
}

// Per-minute rate limiter: 10 questions per minute per user
const questionRateLimiter = new InMemoryRateLimiter(
  60 * 1000, // 1 minute
  parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '10', 10)
);

/**
 * Middleware to enforce per-minute rate limit
 * 10 questions per minute per user (configurable via AI_RATE_LIMIT_PER_MINUTE)
 */
export async function aiQuestionRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(AppError.unauthorized('User ID required'));
    }

    // Check per-minute limit
    if (!questionRateLimiter.isAllowed(userId)) {
      const remaining = questionRateLimiter.getRemaining(userId);
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message:
          'Too many AI requests. Please wait a moment before trying again.',
        retryAfter: 60, // seconds
        remaining,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('AI rate limit check error:', error);
    // Don't block on error
    next();
  }
}

/**
 * Check tier-based daily/monthly limits
 * @param actionType - Type of AI action (question, document, task)
 */
export function checkAIUsageLimit(actionType: UsageActionType) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const tenantId = req.user?.tenant_id;

      if (!userId || !tenantId) {
        return next(AppError.unauthorized('Authentication required'));
      }

      const supabase = getServiceClient();

      // Check if limit check function exists and call it
      const { data: canProceed, error } = await supabase.rpc(
        'check_ai_tier_limit',
        {
          p_user_id: userId,
          p_action_type: actionType,
        }
      );

      if (error) {
        console.error('Error checking AI tier limit:', error);
        // Don't block on error
        return next();
      }

      if (!canProceed) {
        // Get current usage stats
        const { data: usageStats } = await supabase.rpc('get_user_ai_usage', {
          p_user_id: userId,
          p_period: actionType === 'question' ? 'today' : 'month',
        });

        const limitMessages = {
          question:
            'Daily question limit reached (25 questions on free plan). Upgrade to Premium for unlimited questions.',
          document:
            'Monthly document limit reached (3 documents on free plan, 100 on Premium). Upgrade or wait until next month.',
          task: 'Monthly task limit reached (5 tasks on free plan). Upgrade to Premium for unlimited tasks.',
        };

        res.status(403).json({
          code: 'AI_USAGE_LIMIT_EXCEEDED',
          message: limitMessages[actionType],
          usage: usageStats,
          upgradeUrl: `/settings/subscription`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('AI usage limit check error:', error);
      // Don't block on error
      next();
    }
  };
}

/**
 * Middleware to track AI usage after successful operation
 * Should be called after the AI operation completes
 */
export async function trackAIUsage(
  userId: string,
  tenantId: string,
  actionType: UsageActionType,
  options: {
    conversationId?: string;
    tokensUsed?: number;
    modelUsed?: string;
    costEstimate?: number;
  }
): Promise<void> {
  try {
    const supabase = getServiceClient();

    await supabase.from('ai_usage_records').insert({
      user_id: userId,
      tenant_id: tenantId,
      action_type: actionType,
      conversation_id: options.conversationId || null,
      tokens_used: options.tokensUsed || 0,
      model_used: options.modelUsed || 'unknown',
      cost_estimate: options.costEstimate || null,
    });
  } catch (error) {
    console.error('Failed to track AI usage:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Combined middleware for AI endpoints
 * Enforces both per-minute and tier-based limits
 */
export function aiRateLimits(actionType: UsageActionType) {
  return [aiQuestionRateLimit, checkAIUsageLimit(actionType)];
}
