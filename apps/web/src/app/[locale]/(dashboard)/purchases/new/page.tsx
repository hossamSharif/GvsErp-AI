'use client';

/**
 * New Purchase Page
 *
 * Create a new purchase order with autosave support.
 */

import React, { useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useParties } from '@/hooks/use-parties';
import { useItems } from '@/hooks/use-items';
import type { InvoiceWithRelations } from '@erp-saas/shared';

export default function NewPurchasePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useActiveWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'supplier', limit: 100 });
  const { data: itemsData, isLoading: itemsLoading } = useItems({ isActive: true, includePrices: true, limit: 100 });

  // Transform data for the form
  const warehouses = useMemo(() => {
    return warehousesData?.data?.filter(w => w && w.id).map(w => ({
      id: w.id,
      name: w.name,
    })) || [];
  }, [warehousesData]);

  const parties = useMemo(() => {
    return partiesData?.data?.filter(p => p && p.id).map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      balance: p.balance || 0,
      email: p.email || undefined,
      phone: p.phone || undefined,
    })) || [];
  }, [partiesData]);

  const items = useMemo(() => {
    return itemsData?.data?.filter(i => i && i.id).map(i => {
      // Find cost price from prices array (when includePrices: true)
      let unitPrice = 0;
      if ('prices' in i && Array.isArray(i.prices)) {
        const costPrice = i.prices.find(p => p.priceTier === 'cost');
        unitPrice = costPrice?.price || 0;
      }

      return {
        id: i.id,
        name: i.name,
        sku: i.sku || null,
        unitPrice,
        taxRate: i.taxRate || 0,
      };
    }) || [];
  }, [itemsData]);

  const handleSaved = useCallback((invoice: InvoiceWithRelations) => {
    // Navigate to the invoice details page
    router.push(`/${locale}/purchases/${invoice.id}`);
  }, [router, locale]);

  const isLoading = warehousesLoading || partiesLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/purchases`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Purchase Order</h1>
          <p className="text-muted-foreground">
            Create a new purchase order from a supplier
          </p>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm
        type="purchase"
        warehouses={warehouses}
        parties={parties}
        items={items}
        defaultWarehouseId={warehouses[0]?.id}
        onSaved={handleSaved}
      />
    </div>
  );
}
