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

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const supplierId = params.id as string;
  const { toast } = useToast();
  const t = useTranslations('parties');
  const tCommon = useTranslations('common');

  const { data: partyResponse, isLoading: isPartyLoading, error } = useParty(supplierId);

  const updateMutation = useUpdateParty({
    onSuccess: (response) => {
      toast({
        title: t('toast.supplierUpdated'),
        description: `${response.data.name}`,
      });
      router.push(`/${locale}/suppliers/${supplierId}`);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toast.supplierUpdated'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: CreatePartyInput | UpdatePartyInput) => {
      await updateMutation.mutateAsync({ id: supplierId, input: data as UpdatePartyInput });
    },
    [updateMutation, supplierId]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/suppliers/${supplierId}`);
  }, [router, locale, supplierId]);

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
        <p className="text-destructive">{error?.message || t('detail.supplierNotFound')}</p>
        <Button onClick={() => router.push(`/${locale}/suppliers`)}>
          {t('detail.backToSuppliers')}
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
          <h1 className="text-2xl font-bold tracking-tight">{t('editPage.supplierTitle')}</h1>
          <p className="text-muted-foreground">{t('editPage.supplierDescription')}</p>
        </div>
      </div>

      <PartyForm
        partyType="supplier"
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
