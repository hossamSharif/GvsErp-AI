'use client';

/**
 * Invoice Standard Template
 *
 * Modern, RTL-aware invoice document for sales and purchase invoices — the
 * default print template (see InvoicePdf for template selection).
 * Auto-switches to a ZATCA-style layout (bilingual labels + QR code)
 * when the tenant has a tax_number configured. Designed to print
 * cleanly to A4 via react-to-print.
 */

import React, { forwardRef, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { isRtlLocale, type Locale } from '@/i18n/config';
import { useTenantSettings } from '@/hooks/use-settings';
import { buildZatcaTlvBase64 } from '@/lib/zatca';
import { InvoicePrintStyles } from './invoice-print-styles';
import { InvoiceCompanyHeading } from './invoice-company-heading';
import { dateLocale } from './invoice-format';
import type { InvoiceWithRelations, InvoiceStatus } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface InvoiceStandardTemplateProps {
  invoice: InvoiceWithRelations;
  showPaymentInfo?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const InvoiceStandardTemplate = forwardRef<HTMLDivElement, InvoiceStandardTemplateProps>(
  function InvoiceStandardTemplate({ invoice, showPaymentInfo = true, className }, ref) {
    const t = useTranslations('invoice.pdf');
    const locale = useLocale();
    const isRtl = isRtlLocale(locale as Locale);
    // Latin digits + Gregorian calendar, also in Arabic.
    const intlLocale = dateLocale(locale);

    const { data: settingsResp } = useTenantSettings();
    const settings = settingsResp?.data;

    const companyName = settings?.company_name || t('defaultCompanyName');
    const companyAddress = settings?.company_address || '';
    const companyPhone = settings?.company_phone || '';
    const companyEmail = settings?.company_email || '';
    const companyLogo = settings?.logo_url || '';
    const vatNumber = settings?.tax_number || '';
    const isZatca = vatNumber.length > 0;

    const currencyCode = invoice.currency || settings?.default_currency || 'USD';
    const isSale = invoice.type === 'sale';

    // ---------- Formatting helpers ----------
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(value);

    const formatDate = (dateString: string) =>
      new Date(dateString).toLocaleDateString(intlLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    // ---------- Status labels ----------
    const STATUS_LABELS: Record<InvoiceStatus, string> = {
      draft: t('labels.draft'),
      final: t('labels.invoice'),
      returned: t('labels.return'),
      canceled: t('labels.canceled'),
    };

    const documentTitle = isSale ? t('documentSale') : t('documentPurchase');
    const documentTitleAlt = isSale ? t('documentSaleAr') : t('documentPurchaseAr');

    // ---------- ZATCA QR ----------
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    useEffect(() => {
      if (!isZatca || invoice.status !== 'final') {
        setQrDataUrl('');
        return;
      }
      const tlv = buildZatcaTlvBase64({
        sellerName: companyName,
        vatNumber,
        timestamp: invoice.finalizedAt || invoice.createdAt,
        invoiceTotal: invoice.total,
        vatTotal: invoice.taxAmount,
      });
      QRCode.toDataURL(tlv, { errorCorrectionLevel: 'M', margin: 1, width: 160 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }, [
      isZatca,
      companyName,
      vatNumber,
      invoice.status,
      invoice.finalizedAt,
      invoice.createdAt,
      invoice.total,
      invoice.taxAmount,
    ]);

    // ---------- Bilingual label helper ----------
    // In ZATCA mode, return "EN / AR" pair; otherwise the localised single label.
    const dual = (localised: string, alt: string) =>
      isZatca ? `${localised} / ${alt}` : localised;

    // ---------- Status pill colors ----------
    const statusPill = (s: InvoiceStatus) => {
      switch (s) {
        case 'final':
          return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
        case 'draft':
          return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
        case 'returned':
          return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
        case 'canceled':
          return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
      }
    };

    return (
      <>
        <InvoicePrintStyles />
        <div
          ref={ref}
          dir={isRtl ? 'rtl' : 'ltr'}
          lang={locale}
          className={cn(
            'invoice-print-root relative bg-white text-slate-900 mx-auto shadow-sm',
            'flex flex-col w-[210mm] min-h-[297mm]',
            isRtl && 'font-arabic',
            className
          )}
          style={{ fontFeatureSettings: '"tnum" 1, "lnum" 1' }}
        >
          {/* Brand accent bar */}
          <div className="h-1.5 w-full bg-[hsl(var(--primary))]" />

          {/* Watermark for non-final invoices */}
          {invoice.status !== 'final' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="text-[140px] font-black tracking-widest text-slate-900 uppercase select-none"
                style={{ opacity: 0.06, transform: 'rotate(-28deg)' }}
              >
                {STATUS_LABELS[invoice.status]}
              </span>
            </div>
          )}

          {/* ============ Body ============ */}
          <div className="relative flex flex-col flex-1 px-12 pt-10 pb-6">
            {/* ---------- Header ---------- */}
            <header className="flex justify-between items-start gap-8 mb-10">
              {/* Company block */}
              <div className="flex-1 min-w-0">
                <InvoiceCompanyHeading logoUrl={companyLogo} companyName={companyName} />
                <div className="text-xs leading-relaxed text-slate-600 mt-1 space-y-0.5">
                  {companyAddress && <p>{companyAddress}</p>}
                  {(companyPhone || companyEmail) && (
                    <p>
                      {companyPhone}
                      {companyPhone && companyEmail && ' · '}
                      {companyEmail}
                    </p>
                  )}
                  {vatNumber && (
                    <p className="font-medium text-slate-700">
                      {dual(t('vatNumber'), 'VAT')}: {vatNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Document title + meta */}
              <div className="text-end shrink-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">
                  {documentTitleAlt}
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">
                  {documentTitle}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                    statusPill(invoice.status)
                  )}
                >
                  {STATUS_LABELS[invoice.status]}
                </span>
                <dl className="mt-4 text-xs text-slate-700 space-y-1">
                  <div className="flex gap-3 justify-end">
                    <dt className="text-slate-500">{dual(t('invoiceNo'), 'No.')}</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {invoice.invoiceNumber}
                    </dd>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <dt className="text-slate-500">{dual(t('date'), 'Date')}</dt>
                    <dd className="tabular-nums">{formatDate(invoice.createdAt)}</dd>
                  </div>
                  {invoice.finalizedAt && (
                    <div className="flex gap-3 justify-end">
                      <dt className="text-slate-500">{dual(t('finalized'), 'Finalized')}</dt>
                      <dd className="tabular-nums">{formatDate(invoice.finalizedAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </header>

            {/* ---------- Parties + ZATCA QR ---------- */}
            <section
              className={cn(
                'grid gap-6 mb-8',
                qrDataUrl ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'
              )}
            >
              {/* Bill To / Supplier */}
              <div className="rounded-md border border-slate-200 p-4 avoid-break">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {isSale
                    ? dual(t('billTo'), t('billToAr'))
                    : dual(t('supplier'), t('supplierAr'))}
                </p>
                {invoice.party ? (
                  <div className="text-sm text-slate-800">
                    <p className="font-semibold text-base text-slate-900 leading-tight">
                      {invoice.party.name}
                    </p>
                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                      {invoice.party.address && <p>{invoice.party.address}</p>}
                      {invoice.party.phone && <p>{invoice.party.phone}</p>}
                      {invoice.party.email && <p>{invoice.party.email}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-500">{t('walkInCustomer')}</p>
                )}
              </div>

              {/* Warehouse */}
              <div className="rounded-md border border-slate-200 p-4 avoid-break">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {dual(t('warehouse'), t('warehouseAr'))}
                </p>
                <p className="font-semibold text-base text-slate-900 leading-tight">
                  {invoice.warehouse.name}
                </p>
              </div>

              {/* ZATCA QR */}
              {qrDataUrl && (
                <div className="rounded-md border border-slate-200 p-3 avoid-break flex flex-col items-center justify-center">
                  <img src={qrDataUrl} alt="ZATCA QR" className="h-24 w-24" />
                  <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider">
                    {t('zatcaQrLabel')}
                  </p>
                </div>
              )}
            </section>

            {/* ---------- Items table ---------- */}
            <section className="mb-6 avoid-break">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="text-start py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-10">
                      {t('columnRow')}
                    </th>
                    <th className="text-start py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {dual(t('columnItem'), 'Item')}
                    </th>
                    <th className="text-start py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {dual(t('columnDescription'), 'Description')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {dual(t('columnQty'), 'Qty')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {dual(t('columnUnitPrice'), 'Price')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {t('columnDisc')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {t('columnTax')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {dual(t('columnTotal'), 'Total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={cn(
                        'border-b border-slate-200',
                        index % 2 === 1 && 'bg-slate-50/60'
                      )}
                    >
                      <td className="py-2.5 px-3 text-slate-500 tabular-nums align-top">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <p className="font-medium text-slate-900">{item.item.name}</p>
                        {item.item.sku && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {t('skuPrefix')}: {item.item.sku}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 align-top">
                        {item.description || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums align-top">
                        {item.quantity}
                        {item.item.unitOfMeasure && (
                          <span className="text-slate-400 text-xs ms-1">
                            {item.item.unitOfMeasure}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums align-top">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums align-top text-slate-600">
                        {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums align-top text-slate-600">
                        {item.taxRate > 0 ? `${item.taxRate}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-end font-semibold tabular-nums align-top">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ---------- Totals + currency note ---------- */}
            <section className="flex justify-between items-start gap-8 mb-8">
              <div className="text-[10px] text-slate-500 italic max-w-xs leading-relaxed pt-3">
                {t('currencyCode', { currency: currencyCode })}
              </div>
              <div className="w-72 avoid-break">
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between py-1">
                    <dt className="text-slate-600">{dual(t('subtotal'), 'Subtotal')}</dt>
                    <dd className="tabular-nums">{formatCurrency(invoice.subtotal)}</dd>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between py-1">
                      <dt className="text-slate-600">{dual(t('discount'), 'Discount')}</dt>
                      <dd className="tabular-nums text-rose-600">
                        −{formatCurrency(invoice.discountAmount)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <dt className="text-slate-600">{dual(t('tax'), 'VAT')}</dt>
                    <dd className="tabular-nums">{formatCurrency(invoice.taxAmount)}</dd>
                  </div>
                  <div className="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-slate-900">
                    <dt className="text-base font-bold uppercase tracking-wider text-slate-900">
                      {dual(t('total'), 'Total')}
                    </dt>
                    <dd className="text-xl font-bold tabular-nums text-slate-900">
                      {formatCurrency(invoice.total)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* ---------- Notes ---------- */}
            {invoice.notes && (
              <section className="mb-6 avoid-break">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {t('notesTitle')}
                </p>
                <div className="text-sm text-slate-700 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50/60 p-3">
                  {invoice.notes}
                </div>
              </section>
            )}

            {/* ---------- Payment info ---------- */}
            {showPaymentInfo && invoice.status === 'final' && (
              <section className="mb-6 avoid-break">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {t('paymentTitle')}
                </p>
                <div className="text-sm text-slate-700 rounded-md border border-slate-200 p-3">
                  <p>{t('paymentBody')}</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{companyName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('paymentReference', { number: invoice.invoiceNumber })}
                  </p>
                </div>
              </section>
            )}

            {/* ---------- Return reference ---------- */}
            {invoice.returnedFromId && invoice.returnedFrom && (
              <section className="mb-6 avoid-break rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 mb-1">
                  {t('returnTitle')}
                </p>
                <p className="text-sm text-amber-900">
                  {t('returnBody')}{' '}
                  <strong>{invoice.returnedFrom.invoiceNumber}</strong>
                </p>
              </section>
            )}

            {/* Spacer pushes footer to bottom on short invoices */}
            <div className="flex-1" />

            {/* ---------- Signatures (print-only) ---------- */}
            <div className="hidden print:grid grid-cols-2 gap-16 mt-12 mb-6 avoid-break">
              <div>
                <div className="border-b border-slate-400 mb-2 h-12" />
                <p className="text-xs text-slate-600">
                  {dual(t('authorizedSignature'), 'Authorized Signature')}
                </p>
              </div>
              <div>
                <div className="border-b border-slate-400 mb-2 h-12" />
                <p className="text-xs text-slate-600">
                  {dual(t('customerSignature'), 'Customer Signature')}
                </p>
              </div>
            </div>

            {/* ---------- Footer ---------- */}
            <footer className="border-t border-slate-200 pt-3 mt-2 text-[10px] text-slate-500 flex justify-between">
              <div>
                <p>{t('thankYou')}</p>
                <p className="text-slate-400">{companyName}</p>
              </div>
              <div className="text-end">
                <p>{t('footerInvoice', { number: invoice.invoiceNumber })}</p>
                <p className="text-slate-400">
                  {t('footerGenerated', { date: formatDate(new Date().toISOString()) })}
                </p>
              </div>
            </footer>
          </div>
        </div>
      </>
    );
  }
);

export default InvoiceStandardTemplate;
