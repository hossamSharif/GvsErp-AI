'use client';

/**
 * Edit Sales Invoice Page
 *
 * Edit an existing draft sales invoice.
 */

import React, { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useInvoice } from '@/hooks/use-invoices';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useParties } from '@/hooks/use-parties';
import { useItems } from '@/hooks/use-items';
import type { InvoiceWithRelations } from '@erp-saas/shared';

export default function EditSalesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const invoiceId = params.id as string;

  // Fetch existing invoice
  const { data, isLoading: invoiceLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useActiveWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'customer', limit: 100 });
  const { data: itemsData, isLoading: itemsLoading } = useItems({ isActive: true, includePrices: true, limit: 100 });

  // Transform data for the form
  const warehouses = useMemo(() => {
    return warehousesData?.data?.map(w => ({
      id: w.id,
      name: w.name,
    })) || [];
  }, [warehousesData]);

  const parties = useMemo(() => {
    return partiesData?.data?.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      balance: p.balance || 0,
      email: p.email || undefined,
      phone: p.phone || undefined,
    })) || [];
  }, [partiesData]);

  const items = useMemo(() => {
    return itemsData?.data?.map(i => {
      // Find retail price from prices array (when includePrices: true)
      let unitPrice = 0;
      if ('prices' in i && Array.isArray(i.prices)) {
        const retailPrice = i.prices.find(p => p.priceTier === 'retail');
        unitPrice = retailPrice?.price || 0;
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

  const handleSaved = useCallback((updatedInvoice: InvoiceWithRelations) => {
    // Navigate to the invoice details page
    router.push(`/${locale}/sales/${updatedInvoice.id}`);
  }, [router, locale]);

  const isLoading = invoiceLoading || warehousesLoading || partiesLoading || itemsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Sales invoice not found</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/sales`}>Back to Sales</Link>
        </Button>
      </div>
    );
  }

  if (invoice.status !== 'draft') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Only draft sales invoices can be edited</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/sales/${invoiceId}`}>View Sales Invoice</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/sales/${invoiceId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Sales Invoice</h1>
          <p className="text-muted-foreground">
            Editing {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      {/* Invoice Form */}
      <InvoiceForm
        type="sale"
        existingInvoice={invoice}
        warehouses={warehouses}
        parties={parties}
        items={items}
        onSaved={handleSaved}
      />
    </div>
  );
}
