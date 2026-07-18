'use client';

/**
 * New Purchase Page
 *
 * Create a new purchase order with autosave support.
 * Loads real warehouses, suppliers, and items from the API.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useParties } from '@/hooks/use-parties';
import { useWarehouses } from '@/hooks/use-warehouses';
import type { InvoiceWithRelations } from '@erp/shared';

export default function NewPurchasePage() {
  const { locale } = useParams();
  const t = useTranslations('purchases.new');

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'supplier', limit: 100 });

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
      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <InvoiceForm
          key={formKey}
          type="purchase"
          warehouses={warehouses}
          parties={parties}
          defaultWarehouseId={warehouses[0]?.id}
          onSaved={handleSaved}
          headerTitle={t('title')}
          headerBackHref={`/${locale}/purchases`}
        />
      )}
    </div>
  );
}
