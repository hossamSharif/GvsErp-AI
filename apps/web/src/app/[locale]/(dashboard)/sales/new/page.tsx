'use client';

/**
 * New Sale Page
 *
 * Create a new sales invoice with autosave support.
 * Loads real warehouses, customers, and items from the API.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useParties } from '@/hooks/use-parties';
import { useWarehouses } from '@/hooks/use-warehouses';
import type { InvoiceWithRelations } from '@erp/shared';

export default function NewSalePage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('sales.new');
  const tActions = useTranslations('sales.actions');

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'customer', limit: 100 });

  const isLoading = warehousesLoading || partiesLoading;

  const warehouses = useMemo(() =>
    (warehousesData?.data ?? []).map((w) => ({ id: w.id, name: w.name })),
    [warehousesData]
  );

  const parties = useMemo(() =>
    (partiesData?.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type as 'customer' | 'supplier',
      balance: p.balance ?? 0,
      email: p.email,
      phone: p.phone,
    })),
    [partiesData]
  );

  const [formKey, setFormKey] = useState(0);

  const handleSaved = useCallback((_invoice: InvoiceWithRelations) => {
    setFormKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label={tActions('back')}>
          <Link href={`/${locale}/sales`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <InvoiceForm
          key={formKey}
          type="sale"
          warehouses={warehouses}
          parties={parties}
          defaultWarehouseId={warehouses[0]?.id}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
