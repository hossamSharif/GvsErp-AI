'use client';

/**
 * New Settlement Page
 *
 * Creates a draft stock settlement from a physical count sheet.
 */

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SettlementForm } from '@/components/forms/settlement-form';
import { useCreateSettlement } from '@/hooks/use-settlements';
import { useDirection } from '@/hooks/use-direction';
import type { CreateSettlementInput } from '@erp/shared';

export default function NewSettlementPage() {
  const t = useTranslations('settlements');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { isRtl } = useDirection();
  const { toast } = useToast();

  const locale = params.locale as string;
  const warehouseId = searchParams.get('warehouse') ?? undefined;

  const createSettlement = useCreateSettlement();

  const handleSubmit = async (data: CreateSettlementInput) => {
    try {
      const result = await createSettlement.mutateAsync(data);
      toast({
        title: t('toasts.draftCreated'),
        description: result.data.settlementNumber,
      });
      router.push(`/${locale}/warehouses/settlements/${result.data.id}`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.createFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/warehouses/settlements`)}
          aria-label={t('actions.back')}
        >
          <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('new.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('new.description')}</p>
        </div>
      </div>

      <SettlementForm
        initialWarehouseId={warehouseId}
        onSubmit={handleSubmit}
        isSubmitting={createSettlement.isPending}
      />
    </div>
  );
}
