'use client';

/**
 * Subscription & Billing Page
 *
 * Subscription management with Stripe integration:
 * - Current plan display
 * - Billing information
 * - Upgrade/downgrade options
 * - Payment history
 * - Usage limits
 */

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CreditCard,
  Check,
  ArrowLeft,
  Sparkles,
  Download,
  ExternalLink,
  AlertTriangle,
  Zap,
  Users,
  Package,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  useSubscription,
  useSubscriptionLimits,
  useBillingHistory,
  useCreateCheckoutSession,
  useCreatePortalSession,
  useCancelSubscription,
  useResumeSubscription,
  formatPrice,
} from '@/hooks/use-subscription';

interface PlanFeature {
  key: string;
}

interface Plan {
  id: 'freemium' | 'premium';
  nameKey: string;
  price: string;
  periodKey: string;
  features: PlanFeature[];
  limits: {
    items: number | string;
    users: number | string;
    transactions: number | string;
    pdf_export: boolean;
  };
}

const plans: Plan[] = [
  {
    id: 'freemium',
    nameKey: 'plans.freemium',
    price: '$0',
    periodKey: 'pricing.month',
    features: [
      { key: 'features.upTo50Items' },
      { key: 'features.oneUser' },
      { key: 'features.25TransactionsPerMonth' },
      { key: 'features.basicFeatures' },
      { key: 'features.communitySupport' },
    ],
    limits: {
      items: 50,
      users: 1,
      transactions: 25,
      pdf_export: false,
    },
  },
  {
    id: 'premium',
    nameKey: 'plans.premium',
    price: '$99',
    periodKey: 'pricing.month',
    features: [
      { key: 'features.unlimitedItems' },
      { key: 'features.unlimitedUsers' },
      { key: 'features.unlimitedTransactions' },
      { key: 'features.pdfExport' },
      { key: 'features.prioritySupport' },
      { key: 'features.advancedReports' },
      { key: 'features.apiAccess' },
      { key: 'features.accountingModule' },
      { key: 'features.hrModule' },
    ],
    limits: {
      items: 'Unlimited',
      users: 'Unlimited',
      transactions: 'Unlimited',
      pdf_export: true,
    },
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('settings.subscription');

  // Queries
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  const { data: limits, isLoading: isLoadingLimits } = useSubscriptionLimits();
  const { data: billingHistory, isLoading: isLoadingHistory } = useBillingHistory();

  // Mutations
  const createCheckoutSession = useCreateCheckoutSession();
  const createPortalSession = useCreatePortalSession();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();

  const handleUpgrade = async (plan: 'basic' | 'premium') => {
    try {
      const result = await createCheckoutSession.mutateAsync({
        plan,
        success_url: `${window.location.origin}/${locale}/settings/subscription?success=true`,
        cancel_url: `${window.location.origin}/${locale}/settings/subscription?canceled=true`,
      });

      // Redirect to Stripe checkout
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  const handleManageBilling = async () => {
    try {
      const result = await createPortalSession.mutateAsync(
        `${window.location.origin}/${locale}/settings/subscription`
      );

      // Redirect to Stripe portal
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription.mutateAsync();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      await resumeSubscription.mutateAsync();
    } catch (error) {
      console.error('Failed to resume subscription:', error);
    }
  };

  const currentPlan = subscription?.plan || 'freemium';
  const isPremium = currentPlan === 'premium';
  const isCanceled = subscription?.cancel_at_period_end;

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      active: t('status.active'),
      trialing: t('status.trialing'),
      canceled: t('status.canceled'),
      past_due: t('status.pastDue'),
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
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
  };

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
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Status Alert - Past Due */}
      {subscription?.status === 'past_due' && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <CardTitle className="text-red-900 dark:text-red-100">
                {t('alerts.pastDueTitle')}
              </CardTitle>
            </div>
            <CardDescription className="text-red-700 dark:text-red-300">
              {t('alerts.pastDueDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleManageBilling} variant="destructive">
              {t('alerts.updatePaymentMethod')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Alert - Canceled */}
      {isCanceled && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <CardTitle className="text-yellow-900 dark:text-yellow-100">
                {t('alerts.canceledTitle')}
              </CardTitle>
            </div>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              {subscription?.current_period_end
                ? t('alerts.canceledDescription', {
                    date: new Date(subscription.current_period_end).toLocaleDateString(
                      locale === 'ar' ? 'ar-EG' : 'en-US'
                    ),
                  })
                : t('alerts.subscriptionEndsAt')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleResumeSubscription}
              disabled={resumeSubscription.isPending}
            >
              {resumeSubscription.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('resume.button')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>{t('currentPlan')}</CardTitle>
          <CardDescription>{t('yourActivePlan')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubscription ? (
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  {isPremium ? (
                    <Zap className="h-6 w-6 text-primary" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {isPremium ? t('plans.premiumPlan') : t('plans.freemiumPlan')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isPremium
                      ? `$99 ${t('pricing.perMonth')}`
                      : t('pricing.free')}{' '}
                    {subscription?.current_period_end &&
                      `• ${t('billing.nextBilling')}: ${new Date(
                        subscription.current_period_end
                      ).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(subscription?.status || 'active')}>
                  {getStatusLabel(subscription?.status || 'active')}
                </Badge>
                {isPremium && subscription?.stripe_subscription_id && (
                  <Button variant="outline" size="sm" onClick={handleManageBilling}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t('manageBilling')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle>{t('usage.title')}</CardTitle>
          <CardDescription>{t('usage.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLimits ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('usage.items')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {limits?.items.current} /{' '}
                    {limits?.items.limit === Infinity ? '∞' : limits?.items.limit}
                  </span>
                </div>
                <Progress
                  value={
                    limits?.items.limit === Infinity
                      ? 0
                      : ((limits?.items.current || 0) / (limits?.items.limit || 1)) * 100
                  }
                  className="h-2"
                />
              </div>

              {/* Users */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('usage.users')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {limits?.users.current} /{' '}
                    {limits?.users.limit === Infinity ? '∞' : limits?.users.limit}
                  </span>
                </div>
                <Progress
                  value={
                    limits?.users.limit === Infinity
                      ? 0
                      : ((limits?.users.current || 0) / (limits?.users.limit || 1)) * 100
                  }
                  className="h-2"
                />
              </div>

              {/* Transactions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('usage.monthlyTransactions')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {limits?.transactions.current} /{' '}
                    {limits?.transactions.limit === Infinity
                      ? '∞'
                      : limits?.transactions.limit}
                  </span>
                </div>
                <Progress
                  value={
                    limits?.transactions.limit === Infinity
                      ? 0
                      : ((limits?.transactions.current || 0) /
                          (limits?.transactions.limit || 1)) *
                        100
                  }
                  className="h-2"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">{t('availablePlans')}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <Card
                key={plan.id}
                className={
                  plan.id === 'premium'
                    ? 'border-primary shadow-lg'
                    : isCurrent
                    ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                    : ''
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t(plan.nameKey)}</CardTitle>
                    {plan.id === 'premium' && !isCurrent && (
                      <Badge variant="default" className="bg-primary">
                        {t('recommended')}
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="default" className="bg-green-600">
                        {t('current')}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.periodKey && (
                      <span className="text-muted-foreground">/{t(plan.periodKey)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature.key} className="flex items-start gap-2">
                        <Check className="h-5 w-5 shrink-0 text-green-600" />
                        <span className="text-sm">{t(feature.key)}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      {t('currentPlanButton')}
                    </Button>
                  ) : plan.id === 'premium' ? (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade('premium')}
                      disabled={createCheckoutSession.isPending}
                    >
                      {createCheckoutSession.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t('upgradeToPremium')}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>
                      {t('freePlan')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.title')}</CardTitle>
          <CardDescription>{t('billing.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : billingHistory && billingHistory.length > 0 ? (
            <div className="space-y-4">
              {billingHistory.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {formatPrice(invoice.amount, invoice.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.created).toLocaleDateString(
                        locale === 'ar' ? 'ar-EG' : 'en-US'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                      {invoice.status === 'paid' ? t('billing.paid') : t('billing.pending')}
                    </Badge>
                    {invoice.invoice_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {invoice.invoice_pdf && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {t('billing.noHistory')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
      {isPremium && subscription?.stripe_subscription_id && !isCanceled && (
        <Card className="border-red-100 dark:border-red-900">
          <CardHeader>
            <CardTitle>{t('cancel.title')}</CardTitle>
            <CardDescription>{t('cancel.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t('cancel.button')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cancel.confirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('cancel.confirmDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel.keepSubscription')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelSubscription.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t('cancel.yesCancel')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
