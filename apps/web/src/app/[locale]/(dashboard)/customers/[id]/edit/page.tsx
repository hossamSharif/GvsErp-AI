'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PartyForm } from '@/components/forms/party-form';
import { useParty, useUpdateParty } from '@/hooks/use-parties';
import { useToast } from '@/components/ui/use-toast';
import type { CreatePartyInput, UpdatePartyInput } from '@erp/shared';

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const customerId = params.id as string;
  const { toast } = useToast();
  const t = useTranslations('parties');
  const tCommon = useTranslations('common');

  const { data: partyResponse, isLoading: isPartyLoading, error } = useParty(customerId);

  const updateMutation = useUpdateParty({
    onSuccess: (response) => {
      toast({
        title: t('toast.customerUpdated'),
        description: `${response.data.name}`,
      });
      router.push(`/${locale}/customers/${customerId}`);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toast.customerUpdated'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: CreatePartyInput | UpdatePartyInput) => {
      await updateMutation.mutateAsync({ id: customerId, input: data as UpdatePartyInput });
    },
    [updateMutation, customerId]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/customers/${customerId}`);
  }, [router, locale, customerId]);

  if (isPartyLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !partyResponse?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8">
        <p className="text-destructive">{error?.message || t('detail.customerNotFound')}</p>
        <Button onClick={() => router.push(`/${locale}/customers`)}>
          {t('detail.backToCustomers')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('detail.goBack')}
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('editPage.customerTitle')}</h1>
          <p className="text-muted-foreground">{t('editPage.customerDescription')}</p>
        </div>
      </div>

      <PartyForm
        partyType="customer"
        mode="edit"
        party={partyResponse.data}
        hasTransactions={
          (partyResponse.data.invoiceCount ?? 0) + (partyResponse.data.paymentCount ?? 0) > 0
        }
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}
