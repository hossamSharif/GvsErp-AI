/**
 * Webhooks Routes
 *
 * Webhook handlers for external services (Stripe, etc.)
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { stripe, handleStripeWebhook } from '../services/subscription.service';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 *
 * IMPORTANT: This endpoint must receive raw body (not parsed JSON)
 * The express.json() middleware is applied AFTER this route in index.ts
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('Stripe webhook: Missing signature header');
    return res.status(400).json({ error: 'Missing signature header' });
  }

  let event;

  try {
    // If webhook secret is configured, verify the signature
    if (STRIPE_WEBHOOK_SECRET) {
      // The raw body should be available as req.body (Buffer) when using express.raw()
      const rawBody = req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // Development mode: parse the body directly (not recommended for production)
      console.warn('Stripe webhook: Running without signature verification (development mode)');
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Stripe webhook signature verification failed: ${message}`);
    return res.status(400).json({ error: `Webhook Error: ${message}` });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  const supabase = getServiceClient();

  try {
    await handleStripeWebhook(event, supabase);
    console.log(`Stripe webhook processed successfully: ${event.type}`);
    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Stripe webhook processing failed: ${message}`);
    // Still return 200 to acknowledge receipt (Stripe will retry on 4xx/5xx)
    // Log the error for debugging
    res.json({ received: true, error: message });
  }
});

/**
 * GET /webhooks/health
 * Health check for webhook endpoint
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    stripe_webhook_configured: !!STRIPE_WEBHOOK_SECRET,
    timestamp: new Date().toISOString(),
  });
});

export default router;
