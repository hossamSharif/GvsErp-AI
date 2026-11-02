'use client';

/**
 * Invoice Statement Template ("كشف بيان")
 *
 * Compact alternative to the standard invoice, for sales and purchases. Same
 * look as the standard template, different content:
 *  - items table reduced to row / item / qty / price / amount (gross),
 *  - totals as gross → discount → net (no tax line),
 *  - the party's balance before/after the invoice, what was paid with it and
 *    what remains (from GET /invoices/:id/balance-snapshot),
 *  - a note line, and a footer with print time, user, a configurable note and
 *    page numbers. No signatures, no payment instructions, no ZATCA QR.
 */

import React, { forwardRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { isRtlLocale, type Locale } from '@/i18n/config';
import { useTenantSettings } from '@/hooks/use-settings';
import { InvoicePrintStyles } from './invoice-print-styles';
import {
  formatAmount,
  formatQty,
  formatShortDate,
  formatTime,
} from './invoice-format';
import type {
  InvoiceBalanceSnapshot,
  InvoiceStatus,
  InvoiceWithRelations,
} from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

export interface InvoiceStatementTemplateProps {
  invoice: InvoiceWithRelations;
  /** Party balance around the invoice; undefined while loading */
  snapshot?: InvoiceBalanceSnapshot;
  className?: string;
}

/** Amounts within half a cent of zero print as zero */
const EPSILON = 0.005;

// =============================================================================
// COMPONENT
// =============================================================================

export const InvoiceStatementTemplate = forwardRef<HTMLDivElement, InvoiceStatementTemplateProps>(
  function InvoiceStatementTemplate({ invoice, snapshot, className }, ref) {
    const t = useTranslations('invoice.statement');
    const tPdf = useTranslations('invoice.pdf');
    const locale = useLocale();
    const isRtl = isRtlLocale(locale as Locale);

    const { data: settingsResp } = useTenantSettings();
    const settings = settingsResp?.data;

    const companyName = settings?.company_name || tPdf('defaultCompanyName');
    const companyAddress = settings?.company_address || '';
    const companyPhone = settings?.company_phone || '';
    const companyEmail = settings?.company_email || '';
    const companyLogo = settings?.logo_url || '';
    const footerNote = settings?.invoice_footer_note?.trim() || '';

    const currencyCode = invoice.currency || settings?.default_currency || 'USD';
    const isSale = invoice.type === 'sale';
    const isReturn = invoice.status === 'returned' && !!invoice.returnedFromId;
    const balanceLabels = isSale ? 'sale' : 'purchase';

    // ---------- Totals ----------
    // Line totals already net out line discounts and add tax, so the table
    // shows gross (qty × price) and every discount is folded into one line.
    // Deriving the discount from the net keeps gross − discount (+ tax) = net
    // exact whatever the line/invoice discount mix was.
    const gross = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const rawDiscount = gross + invoice.taxAmount - invoice.total;
    const discount = Math.abs(rawDiscount) < EPSILON ? 0 : rawDiscount;

    // ---------- Status ----------
    const STATUS_LABELS: Record<InvoiceStatus, string> = {
      draft: tPdf('labels.draft'),
      final: tPdf('labels.invoice'),
      returned: tPdf('labels.return'),
      canceled: tPdf('labels.canceled'),
    };
    // A finalized statement needs no stamp; anything else is called out.
    const showStatusPill = invoice.status !== 'final';

    // ---------- Balance block ----------
    const showBalance = !!invoice.party && snapshot?.hasParty !== false;
    const balanceCurrency = snapshot?.currency ?? currencyCode;

    const renderBalance = (value: number | undefined) => {
      if (value === undefined) return '—';
      if (Math.abs(value) < EPSILON) return formatAmount(0);
      if (value > 0) return formatAmount(value);
      return (
        <>
          {formatAmount(-value)}{' '}
          <span className="text-[10px] font-normal text-slate-500">
            {t(`${balanceLabels}.negativeTag`)}
          </span>
        </>
      );
    };

    const balanceRows: { label: string; value: number | undefined; strong?: boolean }[] = [
      { label: t(`${balanceLabels}.previousBalance`), value: snapshot?.previousBalance },
      { label: t(`${balanceLabels}.balanceAfter`), value: snapshot?.balanceAfter },
      { label: t(`${balanceLabels}.paidWithInvoice`), value: snapshot?.paidWithInvoice },
      { label: t(`${balanceLabels}.remaining`), value: snapshot?.remaining, strong: true },
    ];

    const totalRows: { label: string; value: string; strong?: boolean }[] = [
      { label: t('totalGross'), value: formatAmount(gross) },
      { label: t('totalDiscount'), value: formatAmount(discount) },
      { label: t('totalNet'), value: formatAmount(invoice.total), strong: true },
    ];

    // ---------- Footer ----------
    const printedAt = new Date();
    const userName = invoice.creator?.fullName || invoice.creator?.email || '';
    // Page X of Y lives in the page margin: only the print engine knows it.
    const pageCounterCss = `@page { @bottom-center { content: ${JSON.stringify(
      `${t('pagePrefix')} `
    )} counter(page) ${JSON.stringify(` ${t('pageOf')} `)} counter(pages); font-size: 9px; color: #64748b; } }`;

    return (
      <>
        <InvoicePrintStyles />
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: pageCounterCss }}
        />
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
            <header className="flex justify-between items-start gap-8 mb-6">
              {/* Company block */}
              <div className="flex-1 min-w-0">
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt={companyName}
                    className="h-14 w-auto object-contain mb-3"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                    {companyName}
                  </h1>
                )}
                {companyLogo && (
                  <p className="text-base font-semibold text-slate-900">{companyName}</p>
                )}
                <div className="text-xs leading-relaxed text-slate-600 mt-1 space-y-0.5">
                  {companyPhone && (
                    <p className="tabular-nums">
                      <span dir="ltr">{companyPhone}</span>
                    </p>
                  )}
                  {companyAddress && <p>{companyAddress}</p>}
                  {companyEmail && <p>{companyEmail}</p>}
                </div>
              </div>

              {/* Document title + meta */}
              <div className="text-end shrink-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">
                  {t('titleAlt')}
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">
                  {isReturn ? t('returnTitle') : t('title')}
                </h2>
                {showStatusPill && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    {STATUS_LABELS[invoice.status]}
                  </span>
                )}
                <dl className="mt-3 text-xs text-slate-700 space-y-1">
                  <div className="flex gap-3 justify-end">
                    <dt className="text-slate-500">{t('invoiceNo')}</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {invoice.invoiceNumber}
                    </dd>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <dt className="text-slate-500">{t('date')}</dt>
                    <dd className="tabular-nums">
                      {formatShortDate(invoice.invoiceDate || invoice.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </header>

            {/* ---------- Party ---------- */}
            <section className="rounded-md border border-slate-200 mb-6 avoid-break text-sm">
              {invoice.party ? (
                <dl className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-2 px-4 py-3">
                  <dt className="text-slate-500">{t('name')}:</dt>
                  <dd className="font-semibold text-slate-900 col-span-3">
                    {invoice.party.name}
                  </dd>
                  <dt className="text-slate-500">{t('address')}:</dt>
                  <dd className="text-slate-800">{invoice.party.address || '—'}</dd>
                  <dt className="text-slate-500">{t('phone')}:</dt>
                  <dd className="text-slate-800 tabular-nums">
                    <span dir="ltr">{invoice.party.phone || '—'}</span>
                  </dd>
                </dl>
              ) : (
                <p className="px-4 py-3 italic text-slate-500">{tPdf('walkInCustomer')}</p>
              )}
            </section>

            {/* ---------- Items table ---------- */}
            <section className="mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white [&>th]:border [&>th]:border-slate-900 [&>th:not(:last-child)]:border-e-slate-500">
                    <th className="text-start py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-12">
                      {t('columnRow')}
                    </th>
                    <th className="text-start py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">
                      {t('columnItem')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-20">
                      {t('columnQty')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-32">
                      {t('columnPrice')}
                    </th>
                    <th className="text-end py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-36">
                      {t('columnTotal')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={cn(
                        '[&>td]:border [&>td]:border-slate-400',
                        index % 2 === 1 && 'bg-slate-50/60'
                      )}
                    >
                      <td className="py-2 px-3 text-slate-500 tabular-nums align-top">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3 align-top font-medium text-slate-900">
                        {item.item.name}
                      </td>
                      <td className="py-2 px-3 text-end tabular-nums align-top">
                        {formatQty(item.quantity)}
                      </td>
                      <td className="py-2 px-3 text-end tabular-nums align-top">
                        {formatAmount(item.unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-end font-semibold tabular-nums align-top">
                        {formatAmount(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ---------- Balance + totals ---------- */}
            <section className="grid grid-cols-2 gap-8 mb-2 avoid-break items-start">
              {/* Balance / payment block (start side) */}
              {showBalance ? (
                <div>
                  <dl className="rounded-md border border-slate-200 text-sm overflow-hidden">
                    {balanceRows.map((row, i) => (
                      <div
                        key={row.label}
                        className={cn(
                          'flex justify-between gap-4 px-3 py-1.5',
                          i > 0 && 'border-t border-slate-200',
                          row.strong && 'bg-slate-50'
                        )}
                      >
                        <dt className={cn('text-slate-600', row.strong && 'font-semibold text-slate-900')}>
                          {row.label}
                        </dt>
                        <dd
                          className={cn(
                            'tabular-nums text-end',
                            row.strong && 'font-bold text-slate-900'
                          )}
                        >
                          {renderBalance(row.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {balanceCurrency !== currencyCode && (
                    <p className="text-[10px] text-slate-500 italic mt-1">
                      {t('amountsIn', { currency: balanceCurrency })}
                    </p>
                  )}
                </div>
              ) : (
                <div />
              )}

              {/* Totals block (end side) */}
              <div>
                <dl className="rounded-md border border-slate-200 text-sm overflow-hidden">
                  {totalRows.map((row, i) => (
                    <div
                      key={row.label}
                      className={cn(
                        'flex justify-between gap-4 px-3 py-1.5',
                        i > 0 && 'border-t border-slate-200',
                        row.strong && 'border-t-2 border-t-slate-900'
                      )}
                    >
                      <dt className={cn('text-slate-600', row.strong && 'font-bold text-slate-900')}>
                        {row.label}
                      </dt>
                      <dd
                        className={cn(
                          'tabular-nums',
                          row.strong && 'text-base font-bold text-slate-900'
                        )}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  {t('amountsIn', { currency: currencyCode })}
                  {invoice.taxAmount > 0 &&
                    ` · ${t('includesTax', { amount: formatAmount(invoice.taxAmount) })}`}
                </p>
              </div>
            </section>

            {/* ---------- Note line ---------- */}
            <section className="flex items-baseline gap-2 mt-4 mb-6 text-sm avoid-break">
              <span className="font-semibold text-slate-700 shrink-0">{t('note')}:</span>
              {invoice.notes ? (
                <span className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</span>
              ) : (
                <span className="flex-1 border-b border-dotted border-slate-400 h-4" />
              )}
            </section>

            {/* ---------- Return reference ---------- */}
            {invoice.returnedFromId && invoice.returnedFrom && (
              <section className="mb-6 avoid-break rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 mb-1">
                  {tPdf('returnTitle')}
                </p>
                <p className="text-sm text-amber-900">
                  {tPdf('returnBody')}{' '}
                  <strong>{invoice.returnedFrom.invoiceNumber}</strong>
                </p>
              </section>
            )}

            {/* Spacer pushes footer to bottom on short invoices */}
            <div className="flex-1" />

            {/* ---------- Footer ---------- */}
            <footer className="border-t border-slate-200 pt-3 mt-2 text-[10px] text-slate-500 flex justify-between items-center gap-6">
              <p className="tabular-nums shrink-0" dir="ltr">
                {formatShortDate(printedAt.toISOString())} · {formatTime(printedAt)}
              </p>
              {footerNote && (
                <p className="flex-1 text-center font-medium text-slate-700">{footerNote}</p>
              )}
              {userName && <p className="shrink-0">{userName}</p>}
            </footer>
          </div>
        </div>
      </>
    );
  }
);

export default InvoiceStatementTemplate;
