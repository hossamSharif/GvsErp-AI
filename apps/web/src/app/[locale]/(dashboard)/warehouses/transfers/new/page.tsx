'use client';

/**
 * New Transfer Page
 *
 * Create a new stock transfer between warehouses.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { TransferForm } from '@/components/forms/transfer-form';
import { useCreateTransfer } from '@/hooks/use-warehouses';
import type { CreateTransferInput } from '@erp-saas/shared';

export default function NewTransferPage() {
  const t = useTranslations('warehouses.transfersList');
  const router = useRouter();
  const searchParams = useSearchParams();
  const createMutation = useCreateTransfer();

  const initialFromWarehouseId = searchParams.get('from') || undefined;
  const initialToWarehouseId = searchParams.get('to') || undefined;

  const handleSubmit = async (data: CreateTransferInput) => {
    const result = await createMutation.mutateAsync(data);
    router.push(`/warehouses/transfers/${result.data.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/warehouses/transfers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('newTransfer')}</h1>
          <p className="text-muted-foreground">{t('newTransferDescription')}</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('transferDetails')}</CardTitle>
          <CardDescription>{t('transferDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <TransferForm
            initialFromWarehouseId={initialFromWarehouseId}
            initialToWarehouseId={initialToWarehouseId}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
