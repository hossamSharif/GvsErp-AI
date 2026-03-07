'use client';

/**
 * New Sale Page
 *
 * Create a new sales invoice with autosave support.
 * Loads real warehouses, customers, and items from the API.
 */

import React, { useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useItems } from '@/hooks/use-items';
import { useParties } from '@/hooks/use-parties';
import { useWarehouses } from '@/hooks/use-warehouses';
import type { InvoiceWithRelations } from '@erp/shared';

export default function NewSalePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'customer', limit: 100 });
  const { data: itemsData, isLoading: itemsLoading } = useItems({ isActive: true, limit: 100 });

  const isLoading = warehousesLoading || partiesLoading || itemsLoading;

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

  const items = useMemo(() =>
    (itemsData?.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      unitPrice: i.prices?.[0]?.price ?? 0,
      taxRate: i.taxRate,
    })),
    [itemsData]
  );

  const handleSaved = useCallback((invoice: InvoiceWithRelations) => {
    router.push(`/${locale}/sales/${invoice.id}`);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/sales`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-muted-foreground">
            Create a new sales invoice
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
          type="sale"
          warehouses={warehouses}
          parties={parties}
          items={items}
          defaultWarehouseId={warehouses[0]?.id}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
