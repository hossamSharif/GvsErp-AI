'use client';

/**
 * Edit Sale Page
 *
 * Edit an existing sales invoice. Drafts are edited freely; finalized
 * invoices are also editable, with a banner warning that saving will
 * adjust inventory and customer balance. Returned and canceled invoices
 * are immutable.
 */

import React, { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/forms/invoice-form';
import { useInvoice } from '@/hooks/use-invoices';
import { useParties } from '@/hooks/use-parties';
import { useWarehouses } from '@/hooks/use-warehouses';
import type { InvoiceWithRelations } from '@erp/shared';

export default function EditSalePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('sales.edit');
  const tDetail = useTranslations('sales.detail');
  const tActions = useTranslations('sales.actions');

  const invoiceId = params.id as string;
  const locale = params.locale as string;

  const { data, isLoading: invoiceLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ type: 'customer', limit: 100 });

  const isLoading = invoiceLoading || warehousesLoading || partiesLoading;

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

  const handleSaved = useCallback((updatedInvoice: InvoiceWithRelations) => {
    router.push(`/${locale}/sales/${updatedInvoice.id}`);
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
          <Link href={`/${locale}/sales`}>{tActions('backToSales')}</Link>
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
          <Link href={`/${locale}/sales/${invoiceId}`}>{tActions('view')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" asChild aria-label={tActions('back')}>
          <Link href={`/${locale}/sales/${invoiceId}`}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold md:text-2xl">{t('title')}</h1>
          <p className="text-muted-foreground">{invoice.invoiceNumber}</p>
        </div>
      </div>

      {invoice.status === 'final' && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 md:p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">{t('editFinalBanner.title')}</p>
            <p className="text-sm">{t('editFinalBanner.description')}</p>
          </div>
        </div>
      )}

      <InvoiceForm
        type="sale"
        existingInvoice={invoice}
        warehouses={warehouses}
        parties={parties}
        onSaved={handleSaved}
      />
    </div>
  );
}
