'use client';

/**
 * Edit Purchase Page
 *
 * Edit an existing draft purchase order.
 * Loads real warehouses, suppliers, and items from the API.
 */

import React, { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useInvoice } from '@/hooks/use-invoices';
import { useItems } from '@/hooks/use-items';
import { useParties } from '@/hooks/use-parties';
import { useWarehouses } from '@/hooks/use-warehouses';
import type { InvoiceWithRelations } from '@erp/shared';

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('purchases.edit');
  const tDetail = useTranslations('purchases.detail');
  const tActions = useTranslations('purchases.actions');

  const invoiceId = params.id as string;
  const locale = params.locale as string;

  // Fetch existing invoice
  const { data, isLoading: invoiceLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  // Fetch real data from API
  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'supplier', limit: 100 });
  const { data: itemsData, isLoading: itemsLoading } = useItems({ isActive: true, limit: 100 });

  const isLoading = invoiceLoading || warehousesLoading || partiesLoading || itemsLoading;

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

  const handleSaved = useCallback((updatedInvoice: InvoiceWithRelations) => {
    router.push(`/${locale}/purchases/${updatedInvoice.id}`);
  }, [router, locale]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{tDetail('notFound')}</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/purchases`}>{tActions('backToPurchases')}</Link>
        </Button>
      </div>
    );
  }

  const editable = invoice.status === 'draft' || invoice.status === 'final';
  if (!editable) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{t('notEditable')}</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/purchases/${invoiceId}`}>{tActions('view')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label={tActions('back')}>
          <Link href={`/${locale}/purchases/${invoiceId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      {invoice.status === 'final' && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">{t('editFinalBanner.title')}</p>
            <p className="text-sm">{t('editFinalBanner.description')}</p>
          </div>
        </div>
      )}

      {/* Invoice Form */}
      <InvoiceForm
        type="purchase"
        existingInvoice={invoice}
        warehouses={warehouses}
        parties={parties}
        items={items}
        onSaved={handleSaved}
      />
    </div>
  );
}
