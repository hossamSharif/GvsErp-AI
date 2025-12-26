/**
 * useSubscription Hook
 *
 * TanStack Query hooks for subscription management with Stripe integration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// Types
export interface SubscriptionLimits {
  max_items: number;
  max_users: number;
  max_transactions_per_month: number;
  pdf_export: boolean;
}

export interface SubscriptionInfo {
  plan: 'freemium' | 'premium';
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  limits: SubscriptionLimits;
}

export interface LimitStatus {
  allowed: boolean;
  current: number;
  limit: number;
}

export interface SubscriptionLimitsResponse {
  items: LimitStatus;
  users: LimitStatus;
  transactions: LimitStatus;
  pdf_export: boolean;
}

export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

// Query Keys
export const subscriptionKeys = {
  all: ['subscription'] as const,
  info: () => [...subscriptionKeys.all, 'info'] as const,
  limits: () => [...subscriptionKeys.all, 'limits'] as const,
  billingHistory: () => [...subscriptionKeys.all, 'billing-history'] as const,
};

/**
 * Get current subscription info
 */
export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKeys.info(),
    queryFn: async () => {
      const response = await api.get<{ data: SubscriptionInfo }>('/subscription');
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Get subscription limits and current usage
 */
export function useSubscriptionLimits() {
  return useQuery({
    queryKey: subscriptionKeys.limits(),
    queryFn: async () => {
      const response = await api.get<{ data: SubscriptionLimitsResponse }>(
        '/subscription/limits'
      );
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Get billing history (invoices)
 */
export function useBillingHistory(limit: number = 10) {
  return useQuery({
    queryKey: [...subscriptionKeys.billingHistory(), { limit }],
    queryFn: async () => {
      const response = await api.get<{ data: BillingHistoryItem[] }>(
        `/subscription/billing-history`, { limit }
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create checkout session for subscription upgrade
 */
export function useCreateCheckoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      plan: 'basic' | 'premium';
      success_url: string;
      cancel_url: string;
    }) => {
      const response = await api.post<{ data: CheckoutSessionResponse }>(
        '/subscription/checkout',
        input
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * Create customer portal session for billing management
 */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async (return_url: string) => {
      const response = await api.post<{ data: PortalSessionResponse }>(
        '/subscription/portal',
        { return_url }
      );
      return response.data;
    },
  });
}

/**
 * Cancel subscription at period end
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: { message: string } }>(
        '/subscription/cancel'
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * Resume a canceled subscription
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.post<{ data: { message: string } }>(
        '/subscription/resume'
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

/**
 * Check a specific limit
 */
export function useCheckLimit(limitType: 'items' | 'users' | 'transactions') {
  return useQuery({
    queryKey: [...subscriptionKeys.limits(), limitType],
    queryFn: async () => {
      const response = await api.get<{ data: LimitStatus }>(
        `/subscription/check/${limitType}`
      );
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(plan: 'freemium' | 'premium'): string {
  const names: Record<string, string> = {
    freemium: 'Freemium',
    premium: 'Premium',
  };
  return names[plan] || plan;
}

/**
 * Get status badge variant
 */
export function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'trialing':
      return 'secondary';
    case 'canceled':
    case 'past_due':
      return 'destructive';
    default:
      return 'outline';
  }
}
