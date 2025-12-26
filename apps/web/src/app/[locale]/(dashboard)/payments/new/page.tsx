'use client';

/**
 * New Payment Page
 *
 * Page for recording a new payment with:
 * - Payment form component
 * - Support for pre-selected party via query params
 * - Support for payment type (received/made) via query params
 * - Navigation back to payments list
 * - Success/error handling
 */

import { useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCreatePayment } from '@/hooks/use-payments';
import { useParties } from '@/hooks/use-parties';
import { PaymentForm } from '@/components/forms/payment-form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { CreatePaymentInput, PaymentType } from '@erp-saas/shared';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('payments');
  const tc = useTranslations('common');

  // Get query params
  const partyIdParam = searchParams.get('partyId');
  const typeParam = searchParams.get('type') as PaymentType | null;
  const defaultType: PaymentType = typeParam || 'received';

  // Fetch customers (for received payments)
  const { data: customersData, isLoading: customersLoading } = useParties({
    type: 'customer',
    isActive: true,
    limit: 100,
  });

  // Fetch suppliers (for made payments)
  const { data: suppliersData, isLoading: suppliersLoading } = useParties({
    type: 'supplier',
    isActive: true,
    limit: 100,
  });

  const customers = useMemo(() => customersData?.data || [], [customersData]);
  const suppliers = useMemo(() => suppliersData?.data || [], [suppliersData]);

  // Create payment mutation
  const createMutation = useCreatePayment({
    onSuccess: (response) => {
      toast({
        title: t('recordSuccess'),
        description: t('recordSuccessDesc', { amount: response.data.amount.toFixed(2) }),
      });
      router.push(`/${locale}/payments`);
    },
    onError: (error) => {
      toast({
        title: tc('error'),
        description: error.message || t('recordError'),
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleSubmitReceived = useCallback(
    async (data: CreatePaymentInput) => {
      await createMutation.mutateAsync({
        ...data,
        type: 'received',
      });
    },
    [createMutation]
  );

  const handleSubmitMade = useCallback(
    async (data: CreatePaymentInput) => {
      await createMutation.mutateAsync({
        ...data,
        type: 'made',
      });
    },
    [createMutation]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/payments`);
  }, [router, locale]);

  const handleBack = useCallback(() => {
    router.push(`/${locale}/payments`);
  }, [router, locale]);

  const isLoading = customersLoading || suppliersLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('addPayment')}</h1>
          <p className="text-muted-foreground">
            {t('newPageDesc')}
          </p>
        </div>
      </div>

      {/* Payment Type Tabs */}
      <div className="max-w-2xl">
        <Tabs defaultValue={defaultType} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">{t('types.received')}</TabsTrigger>
            <TabsTrigger value="made">{t('types.made')}</TabsTrigger>
          </TabsList>

          {/* Received Payment Tab */}
          <TabsContent value="received" className="mt-6">
            <PaymentForm
              paymentType="received"
              parties={customers}
              selectedPartyId={typeParam === 'received' ? partyIdParam || undefined : undefined}
              onSubmit={handleSubmitReceived}
              onCancel={handleCancel}
              isLoading={createMutation.isPending}
            />
          </TabsContent>

          {/* Made Payment Tab */}
          <TabsContent value="made" className="mt-6">
            <PaymentForm
              paymentType="made"
              parties={suppliers}
              selectedPartyId={typeParam === 'made' ? partyIdParam || undefined : undefined}
              onSubmit={handleSubmitMade}
              onCancel={handleCancel}
              isLoading={createMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
