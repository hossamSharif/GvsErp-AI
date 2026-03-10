'use client';

/**
 * New Payment Page
 *
 * Record a new payment (received from customer or made to supplier).
 * Loads parties from the API and uses PaymentForm component.
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentForm } from '@/components/forms/payment-form';
import { useParties } from '@/hooks/use-parties';
import { useCreatePayment } from '@/hooks/use-payments';
import { useToast } from '@/components/ui/use-toast';
import type { CreatePaymentInput, PaymentType } from '@erp/shared';

export default function NewPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Pre-fill from query params (e.g., from customer/supplier detail pages)
  const prefilledPartyId = searchParams.get('partyId') || undefined;
  const prefilledType = (searchParams.get('type') as PaymentType) || 'received';

  const [activeTab, setActiveTab] = useState<PaymentType>(prefilledType);

  // Fetch parties
  const { data: customersData, isLoading: customersLoading } = useParties({ type: 'customer', limit: 200 });
  const { data: suppliersData, isLoading: suppliersLoading } = useParties({ type: 'supplier', limit: 200 });

  const isLoading = customersLoading || suppliersLoading;

  // Create payment mutation
  const createPayment = useCreatePayment({
    onSuccess: (data) => {
      toast({
        title: 'Payment recorded',
        description: `Payment of ${data.data.amount} ${data.data.currency} has been recorded.`,
      });
      router.push(`/${locale}/payments`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(async (data: CreatePaymentInput) => {
    await createPayment.mutateAsync(data);
  }, [createPayment]);

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/payments`);
  }, [router, locale]);

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back to payments">
          <Link href={`/${locale}/payments`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Payment</h1>
          <p className="text-muted-foreground">
            Record a payment received from a customer or made to a supplier
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PaymentType)}>
          <TabsList>
            <TabsTrigger value="received">Payment Received</TabsTrigger>
            <TabsTrigger value="made">Payment Made</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="mt-6">
            <PaymentForm
              paymentType="received"
              parties={customersData?.data ?? []}
              selectedPartyId={activeTab === 'received' ? prefilledPartyId : undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createPayment.isPending}
            />
          </TabsContent>
          <TabsContent value="made" className="mt-6">
            <PaymentForm
              paymentType="made"
              parties={suppliersData?.data ?? []}
              selectedPartyId={activeTab === 'made' ? prefilledPartyId : undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={createPayment.isPending}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
