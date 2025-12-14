'use client';

/**
 * Subscription & Billing Page (Placeholder)
 *
 * Placeholder for future Stripe integration:
 * - Current plan display
 * - Billing information
 * - Upgrade/downgrade options
 * - Payment history
 */

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Check,
  ArrowLeft,
  Sparkles,
  Clock,
  Info,
} from 'lucide-react';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  isCurrent?: boolean;
  isPopular?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: '$29',
    period: 'month',
    isCurrent: true,
    features: [
      'Up to 5 users',
      'Basic invoicing',
      'Inventory management',
      '50 GB storage',
      'Email support',
    ],
  },
  {
    name: 'Professional',
    price: '$99',
    period: 'month',
    isPopular: true,
    features: [
      'Up to 20 users',
      'Advanced invoicing',
      'Multi-warehouse management',
      '500 GB storage',
      'Priority support',
      'Custom reports',
      'API access',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited users',
      'All features',
      'Unlimited storage',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'Advanced security',
    ],
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/settings`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscription & Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription plan and billing information
          </p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">Stripe Integration Coming Soon</CardTitle>
          </div>
          <CardDescription className="text-blue-700">
            We're working on integrating Stripe for seamless subscription management and
            billing. This feature will be available in an upcoming release.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Starter Plan</h3>
                <p className="text-sm text-muted-foreground">
                  $29 per month • Next billing: January 1, 2026
                </p>
              </div>
            </div>
            <Badge variant="default">Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.isPopular
                  ? 'border-primary shadow-lg'
                  : plan.isCurrent
                  ? 'border-green-200 bg-green-50'
                  : ''
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.isPopular && (
                    <Badge variant="default" className="bg-primary">
                      Popular
                    </Badge>
                  )}
                  {plan.isCurrent && (
                    <Badge variant="default" className="bg-green-600">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">/{plan.period}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 shrink-0 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.isCurrent ? 'outline' : 'default'}
                  disabled
                >
                  {plan.isCurrent ? 'Current Plan' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Billing History Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your payment and invoice history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Billing history and invoice downloads will be available once Stripe
              integration is complete.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Manage your payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Add and manage payment methods once Stripe integration is complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
