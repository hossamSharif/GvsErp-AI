/**
 * Subscription Routes
 *
 * API endpoints for subscription management with Stripe integration.
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@erp-saas/database';
import { validateBody, asyncHandler, AppError, authMiddleware, tenantMiddleware } from '../middleware';
import { SubscriptionService, SubscriptionError } from '../services/subscription.service';

const router = Router();

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

// Validation schemas
const checkoutSessionSchema = z.object({
  plan: z.enum(['basic', 'premium']),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

const portalSessionSchema = z.object({
  return_url: z.string().url(),
});

/**
 * GET /subscription
 * Get current subscription info
 */
router.get(
  '/',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const subscriptionInfo = await service.getSubscriptionInfo();
      res.json({ data: subscriptionInfo });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * POST /subscription/checkout
 * Create a Stripe checkout session for subscription upgrade
 */
router.post(
  '/checkout',
  authMiddleware,
  tenantMiddleware,
  validateBody(checkoutSessionSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    const supabase = getServiceClient();

    // Get user email and name
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw AppError.notFound('User not found');
    }

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const session = await service.createCheckoutSession(
        req.body,
        user.email,
        user.full_name || 'Customer'
      );

      res.json({ data: session });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * POST /subscription/portal
 * Create a Stripe customer portal session for billing management
 */
router.post(
  '/portal',
  authMiddleware,
  tenantMiddleware,
  validateBody(portalSessionSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const session = await service.createPortalSession(req.body.return_url);
      res.json({ data: session });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * GET /subscription/billing-history
 * Get billing history (invoices)
 */
router.get(
  '/billing-history',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();
    const limit = parseInt(req.query.limit as string) || 10;

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const history = await service.getBillingHistory(limit);
      res.json({ data: history });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * POST /subscription/cancel
 * Cancel subscription at period end
 */
router.post(
  '/cancel',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();

    const service = new SubscriptionService(supabase, tenantId);

    try {
      await service.cancelSubscription();
      res.json({ data: { message: 'Subscription will be canceled at period end' } });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * POST /subscription/resume
 * Resume a canceled subscription
 */
router.post(
  '/resume',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();

    const service = new SubscriptionService(supabase, tenantId);

    try {
      await service.resumeSubscription();
      res.json({ data: { message: 'Subscription resumed' } });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * GET /subscription/limits
 * Get current usage limits and status
 */
router.get(
  '/limits',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const supabase = getServiceClient();

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const [items, users, transactions, canExportPdf] = await Promise.all([
        service.checkLimit('items'),
        service.checkLimit('users'),
        service.checkLimit('transactions'),
        service.canExportPdf(),
      ]);

      res.json({
        data: {
          items,
          users,
          transactions,
          pdf_export: canExportPdf,
        },
      });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

/**
 * GET /subscription/check/:limitType
 * Check a specific limit
 */
router.get(
  '/check/:limitType',
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId!;
    const limitType = req.params.limitType as 'items' | 'users' | 'transactions';
    const supabase = getServiceClient();

    if (!['items', 'users', 'transactions'].includes(limitType)) {
      throw AppError.badRequest('Invalid limit type');
    }

    const service = new SubscriptionService(supabase, tenantId);

    try {
      const result = await service.checkLimit(limitType);
      res.json({ data: result });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        throw new AppError(error.message, error.statusCode);
      }
      throw error;
    }
  })
);

export default router;
