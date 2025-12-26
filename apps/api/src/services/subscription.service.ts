/**
 * Subscription Service
 *
 * Business logic for subscription management with Stripe integration.
 * Handles subscription creation, upgrades, cancellations, and billing.
 */

import Stripe from 'stripe';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Stripe Product and Price IDs
export const STRIPE_CONFIG = {
  products: {
    basic: process.env.STRIPE_PRODUCT_BASIC || 'prod_Tb5OUBRlKIuyhm',
    premium: process.env.STRIPE_PRODUCT_PREMIUM || 'prod_Tb5OQNYhnZdGV0',
  },
  prices: {
    // These will be created/fetched dynamically if not set
    basic_monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
  },
  // Plan limits
  limits: {
    freemium: {
      max_items: 50,
      max_users: 1,
      max_transactions_per_month: 25,
      pdf_export: false,
    },
    premium: {
      max_items: -1, // unlimited
      max_users: -1, // unlimited
      max_transactions_per_month: -1, // unlimited
      pdf_export: true,
    },
  },
};

export type SubscriptionPlan = 'freemium' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  limits: typeof STRIPE_CONFIG.limits.freemium;
}

export interface CreateCheckoutSessionInput {
  plan: 'basic' | 'premium';
  success_url: string;
  cancel_url: string;
}

export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: Date;
  invoice_url: string | null;
  invoice_pdf: string | null;
}

/**
 * Application error for subscription-related operations
 */
export class SubscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

/**
 * Service for subscription management with Stripe
 */
export class SubscriptionService {
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
  }

  /**
   * Get or create a Stripe customer for the tenant
   */
  async getOrCreateStripeCustomer(email: string, name: string): Promise<string> {
    // Get current tenant data
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('stripe_customer_id, name')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant) {
      throw new SubscriptionError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    }

    // Return existing customer if available
    if (tenant.stripe_customer_id) {
      return tenant.stripe_customer_id;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: name || tenant.name,
      metadata: {
        tenant_id: this.tenantId,
      },
    });

    // Update tenant with Stripe customer ID
    await this.supabase
      .from('tenants')
      .update({ stripe_customer_id: customer.id })
      .eq('id', this.tenantId);

    return customer.id;
  }

  /**
   * Get current subscription info
   */
  async getSubscriptionInfo(): Promise<SubscriptionInfo> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id, settings')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant) {
      throw new SubscriptionError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    }

    const plan = tenant.subscription_plan as SubscriptionPlan;
    const limits = STRIPE_CONFIG.limits[plan] || STRIPE_CONFIG.limits.freemium;

    let currentPeriodEnd: Date | null = null;
    let cancelAtPeriodEnd = false;

    // Get subscription details from Stripe if available
    if (tenant.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        cancelAtPeriodEnd = subscription.cancel_at_period_end;
      } catch {
        // Subscription might not exist anymore
      }
    }

    return {
      plan,
      status: tenant.subscription_status as SubscriptionStatus,
      stripe_customer_id: tenant.stripe_customer_id,
      stripe_subscription_id: tenant.stripe_subscription_id,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      limits,
    };
  }

  /**
   * Create a Stripe checkout session for subscription upgrade
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
    email: string,
    name: string
  ): Promise<{ sessionId: string; url: string }> {
    // Get or create Stripe customer
    const customerId = await this.getOrCreateStripeCustomer(email, name);

    // Get or create the price for the plan
    const priceId = await this.getOrCreatePrice(input.plan);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: input.success_url,
      cancel_url: input.cancel_url,
      subscription_data: {
        metadata: {
          tenant_id: this.tenantId,
          plan: input.plan,
        },
        trial_period_days: input.plan === 'basic' ? 30 : undefined, // 30-day trial for basic
      },
      metadata: {
        tenant_id: this.tenantId,
        plan: input.plan,
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a Stripe customer portal session for billing management
   */
  async createPortalSession(return_url: string): Promise<{ url: string }> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant?.stripe_customer_id) {
      throw new SubscriptionError('No billing account found', 'NO_BILLING_ACCOUNT', 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url,
    });

    return { url: session.url };
  }

  /**
   * Get billing history (invoices)
   */
  async getBillingHistory(limit: number = 10): Promise<BillingHistoryItem[]> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant?.stripe_customer_id) {
      return [];
    }

    const invoices = await stripe.invoices.list({
      customer: tenant.stripe_customer_id,
      limit,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status || 'unknown',
      created: new Date(invoice.created * 1000),
      invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
    }));
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(): Promise<void> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('stripe_subscription_id')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant?.stripe_subscription_id) {
      throw new SubscriptionError('No active subscription found', 'NO_SUBSCRIPTION', 400);
    }

    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(): Promise<void> {
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .select('stripe_subscription_id')
      .eq('id', this.tenantId)
      .single();

    if (error || !tenant?.stripe_subscription_id) {
      throw new SubscriptionError('No subscription found', 'NO_SUBSCRIPTION', 400);
    }

    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Update subscription in database based on Stripe webhook event
   */
  async syncSubscriptionFromStripe(subscriptionId: string): Promise<void> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const tenantId = subscription.metadata.tenant_id;

    if (!tenantId) {
      throw new SubscriptionError('No tenant ID in subscription metadata', 'INVALID_METADATA', 400);
    }

    // Map Stripe status to our status
    let status: SubscriptionStatus = 'active';
    switch (subscription.status) {
      case 'active':
        status = 'active';
        break;
      case 'trialing':
        status = 'trialing';
        break;
      case 'canceled':
        status = 'canceled';
        break;
      case 'past_due':
      case 'unpaid':
        status = 'past_due';
        break;
      default:
        status = 'active';
    }

    // Determine plan from price
    const plan = subscription.metadata.plan === 'premium' ? 'premium' : 'freemium';

    // Get appropriate limits
    const limits = STRIPE_CONFIG.limits[plan];

    // Update tenant subscription info
    await this.supabase
      .from('tenants')
      .update({
        subscription_plan: plan,
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
        settings: this.supabase.rpc('jsonb_set', {
          target: 'settings',
          path: '{limits}',
          value: JSON.stringify(limits),
        }),
      })
      .eq('id', tenantId);
  }

  /**
   * Get or create a recurring price for a plan
   */
  private async getOrCreatePrice(plan: 'basic' | 'premium'): Promise<string> {
    const configKey = `${plan}_monthly` as keyof typeof STRIPE_CONFIG.prices;

    // Check if we have a configured price
    if (STRIPE_CONFIG.prices[configKey]) {
      return STRIPE_CONFIG.prices[configKey];
    }

    const productId = STRIPE_CONFIG.products[plan];
    const amount = plan === 'basic' ? 2900 : 9900; // $29 or $99

    // Check if a recurring price already exists for this product
    const existingPrices = await stripe.prices.list({
      product: productId,
      type: 'recurring',
      active: true,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0].id;
    }

    // Create a new recurring price
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan,
      },
    });

    return price.id;
  }

  /**
   * Check if tenant has reached a specific limit
   */
  async checkLimit(limitType: 'items' | 'users' | 'transactions'): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const subscriptionInfo = await this.getSubscriptionInfo();
    const limits = subscriptionInfo.limits;

    let current = 0;
    let limit = 0;

    switch (limitType) {
      case 'items':
        limit = limits.max_items;
        const { count: itemCount } = await this.supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', this.tenantId);
        current = itemCount || 0;
        break;

      case 'users':
        limit = limits.max_users;
        const { count: userCount } = await this.supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', this.tenantId);
        current = userCount || 0;
        break;

      case 'transactions':
        limit = limits.max_transactions_per_month;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: txCount } = await this.supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', this.tenantId)
          .gte('created_at', startOfMonth.toISOString());
        current = txCount || 0;
        break;
    }

    // -1 means unlimited
    const allowed = limit === -1 || current < limit;

    return {
      allowed,
      current,
      limit: limit === -1 ? Infinity : limit,
    };
  }

  /**
   * Check if PDF export is allowed
   */
  async canExportPdf(): Promise<boolean> {
    const subscriptionInfo = await this.getSubscriptionInfo();
    return subscriptionInfo.limits.pdf_export;
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
  event: Stripe.Event,
  supabase: SupabaseClient<Database>
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const tenantId = session.metadata?.tenant_id;
        if (tenantId) {
          const plan = session.metadata?.plan === 'premium' ? 'premium' : 'freemium';
          const limits = STRIPE_CONFIG.limits[plan];

          await supabase
            .from('tenants')
            .update({
              subscription_plan: plan,
              subscription_status: 'active',
              stripe_subscription_id: session.subscription as string,
              stripe_customer_id: session.customer as string,
            })
            .eq('id', tenantId);
        }
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;

      if (tenantId) {
        let status: SubscriptionStatus = 'active';
        switch (subscription.status) {
          case 'active':
            status = 'active';
            break;
          case 'trialing':
            status = 'trialing';
            break;
          case 'canceled':
            status = 'canceled';
            break;
          case 'past_due':
          case 'unpaid':
            status = 'past_due';
            break;
        }

        const plan = subscription.metadata?.plan === 'premium' ? 'premium' : 'freemium';

        await supabase
          .from('tenants')
          .update({
            subscription_plan: plan,
            subscription_status: status,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', tenantId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;

      if (tenantId) {
        // Downgrade to freemium
        await supabase
          .from('tenants')
          .update({
            subscription_plan: 'freemium',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('id', tenantId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        // Find tenant by subscription ID
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (tenant) {
          await supabase
            .from('tenants')
            .update({ subscription_status: 'past_due' })
            .eq('id', tenant.id);
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        // Find tenant by subscription ID and update status
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        if (tenant) {
          await supabase
            .from('tenants')
            .update({ subscription_status: 'active' })
            .eq('id', tenant.id);
        }
      }
      break;
    }
  }
}

export { stripe };
