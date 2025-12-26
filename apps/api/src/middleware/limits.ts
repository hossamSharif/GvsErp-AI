/**
 * Subscription Limits Middleware
 *
 * Middleware to enforce subscription-based limits on API operations.
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { SubscriptionService, STRIPE_CONFIG } from '../services/subscription.service';
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

export type LimitType = 'items' | 'users' | 'transactions';

/**
 * Create middleware that checks subscription limits before allowing an operation
 */
export function checkLimit(limitType: LimitType) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;

      if (!tenantId) {
        return next(AppError.unauthorized('Tenant ID required'));
      }

      const supabase = getServiceClient();
      const service = new SubscriptionService(supabase, tenantId);

      const result = await service.checkLimit(limitType);

      if (!result.allowed) {
        const limitName = limitType === 'transactions' ? 'monthly transactions' : limitType;
        return next(
          new AppError(
            `You have reached your ${limitName} limit (${result.current}/${result.limit}). Please upgrade your plan to continue.`,
            403,
            'LIMIT_EXCEEDED'
          )
        );
      }

      next();
    } catch (error) {
      console.error('Limit check error:', error);
      // Don't block the request if limit check fails
      next();
    }
  };
}

/**
 * Middleware to check if PDF export is allowed
 */
export async function checkPdfExport(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next(AppError.unauthorized('Tenant ID required'));
    }

    const supabase = getServiceClient();
    const service = new SubscriptionService(supabase, tenantId);

    const canExport = await service.canExportPdf();

    if (!canExport) {
      return next(
        new AppError(
          'PDF export is not available on the Freemium plan. Please upgrade to Premium to export PDFs.',
          403,
          'PDF_EXPORT_NOT_ALLOWED'
        )
      );
    }

    next();
  } catch (error) {
    console.error('PDF export check error:', error);
    // Don't block the request if check fails
    next();
  }
}

/**
 * Middleware to attach subscription info to request
 */
export async function attachSubscriptionInfo(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next();
    }

    const supabase = getServiceClient();
    const service = new SubscriptionService(supabase, tenantId);

    const subscriptionInfo = await service.getSubscriptionInfo();

    // Attach to request for use in handlers
    (req as any).subscriptionInfo = subscriptionInfo;

    next();
  } catch (error) {
    // Don't block the request if subscription info fetch fails
    next();
  }
}

/**
 * Quick check middleware for subscription status
 * Blocks requests if subscription is canceled or past_due
 */
export async function requireActiveSubscription(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return next(AppError.unauthorized('Tenant ID required'));
    }

    const supabase = getServiceClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('subscription_status')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      return next(AppError.notFound('Tenant not found'));
    }

    if (tenant.subscription_status === 'canceled') {
      return next(
        new AppError(
          'Your subscription has been canceled. Please reactivate to continue using the service.',
          403,
          'SUBSCRIPTION_CANCELED'
        )
      );
    }

    if (tenant.subscription_status === 'past_due') {
      return next(
        new AppError(
          'Your subscription payment is past due. Please update your payment method to continue.',
          403,
          'PAYMENT_PAST_DUE'
        )
      );
    }

    next();
  } catch (error) {
    // Don't block on error
    next();
  }
}

/**
 * Get limits for a subscription plan
 */
export function getPlanLimits(plan: 'freemium' | 'premium') {
  return STRIPE_CONFIG.limits[plan] || STRIPE_CONFIG.limits.freemium;
}
