'use client';

import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PartyForm } from '@/components/forms/party-form';
import { useCreateParty } from '@/hooks/use-parties';
import { useToast } from '@/components/ui/use-toast';
import type { CreatePartyInput, UpdatePartyInput } from '@erp/shared';

export default function NewSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('parties');
  const tCommon = useTranslations('common');

  const createMutation = useCreateParty({
    onSuccess: (response) => {
      toast({
        title: t('toast.supplierCreated'),
        description: `${response.data.name}`,
      });
      router.push(`/${locale}/suppliers/${response.data.id}`);
    },
    onError: (error) => {
      toast({
        title: tCommon('error'),
        description: error.message || t('toast.supplierCreated'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: CreatePartyInput | UpdatePartyInput) => {
      await createMutation.mutateAsync(data as CreatePartyInput);
    },
    [createMutation]
  );

  const handleCancel = useCallback(() => {
    router.push(`/${locale}/suppliers`);
  }, [router, locale]);

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
          <h1 className="text-2xl font-bold tracking-tight">{t('new.supplierTitle')}</h1>
          <p className="text-muted-foreground">{t('new.supplierDescription')}</p>
        </div>
      </div>

      <PartyForm
        partyType="supplier"
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
