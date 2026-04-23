'use client';

/**
 * Invoice PDF Template
 *
 * Generates a printable/PDF invoice document.
 */

import React, { forwardRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import type { InvoiceWithRelations, InvoiceStatus } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface InvoicePdfProps {
  invoice: InvoiceWithRelations;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogo?: string;
  showPaymentInfo?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const InvoicePdf = forwardRef<HTMLDivElement, InvoicePdfProps>(
  function InvoicePdf(
    {
      invoice,
      companyName,
      companyAddress = '123 Business St, City, Country',
      companyPhone = '+1 234 567 8900',
      companyEmail = 'info@company.com',
      companyLogo,
      showPaymentInfo = true,
      className,
    },
    ref
  ) {
    const t = useTranslations('sales.pdf');
    const locale = useLocale();
    const resolvedCompanyName = companyName ?? t('defaultCompanyName');
    const intlLocale = locale === 'ar' ? 'ar-EG' : 'en-US';

    const STATUS_LABELS: Record<InvoiceStatus, string> = {
      draft: t('labels.draft'),
      final: t('labels.invoice'),
      returned: t('labels.return'),
      canceled: t('labels.canceled'),
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: invoice.currency,
        minimumFractionDigits: 2,
      }).format(value);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString(intlLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const isSale = invoice.type === 'sale';
    const documentTitle = isSale ? t('documentSale') : t('documentPurchase');

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white text-black p-8 min-h-[11in] w-[8.5in] mx-auto',
          'print:p-0 print:shadow-none',
          className
        )}
      >
        {/* Watermark for non-final invoices */}
        {invoice.status !== 'final' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <span className="text-8xl font-bold text-gray-500 rotate-[-30deg]">
              {STATUS_LABELS[invoice.status]}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          {/* Company Info */}
          <div>
            {companyLogo ? (
              <img src={companyLogo} alt={resolvedCompanyName} className="h-12 mb-2" />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{resolvedCompanyName}</h1>
            )}
            <div className="text-sm text-gray-600 mt-2">
              <p>{companyAddress}</p>
              <p>{companyPhone}</p>
              <p>{companyEmail}</p>
            </div>
          </div>

          {/* Invoice Info */}
          <div className="text-right">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{documentTitle}</h2>
            <table className="text-sm ml-auto">
              <tbody>
                <tr>
                  <td className="text-gray-600 pr-4">{t('invoiceNo')}</td>
                  <td className="font-bold">{invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td className="text-gray-600 pr-4">{t('date')}</td>
                  <td>{formatDate(invoice.createdAt)}</td>
                </tr>
                {invoice.finalizedAt && (
                  <tr>
                    <td className="text-gray-600 pr-4">{t('finalized')}</td>
                    <td>{formatDate(invoice.finalizedAt)}</td>
                  </tr>
                )}
                <tr>
                  <td className="text-gray-600 pr-4">{t('status')}</td>
                  <td>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        invoice.status === 'final' && 'bg-green-100 text-green-800',
                        invoice.status === 'draft' && 'bg-yellow-100 text-yellow-800',
                        invoice.status === 'returned' && 'bg-gray-100 text-gray-800',
                        invoice.status === 'canceled' && 'bg-red-100 text-red-800'
                      )}
                    >
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-bold text-gray-600 uppercase mb-2">
              {isSale ? t('billTo') : t('supplier')}
            </h3>
            {invoice.party ? (
              <div className="text-sm">
                <p className="font-bold text-lg">{invoice.party.name}</p>
                {invoice.party.address && <p className="text-gray-600">{invoice.party.address}</p>}
                {invoice.party.phone && <p className="text-gray-600">{invoice.party.phone}</p>}
                {invoice.party.email && <p className="text-gray-600">{invoice.party.email}</p>}
              </div>
            ) : (
              <p className="text-gray-500 italic">{t('walkInCustomer')}</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-600 uppercase mb-2">{t('warehouse')}</h3>
            <div className="text-sm">
              <p className="font-bold">{invoice.warehouse.name}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-3 px-4 font-bold">{t('columnRow')}</th>
              <th className="text-left py-3 px-4 font-bold">{t('columnItem')}</th>
              <th className="text-left py-3 px-4 font-bold">{t('columnDescription')}</th>
              <th className="text-right py-3 px-4 font-bold">{t('columnQty')}</th>
              <th className="text-right py-3 px-4 font-bold">{t('columnUnitPrice')}</th>
              <th className="text-right py-3 px-4 font-bold">{t('columnDisc')}</th>
              <th className="text-right py-3 px-4 font-bold">{t('columnTax')}</th>
              <th className="text-right py-3 px-4 font-bold">{t('columnTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                <td className="py-3 px-4">
                  <p className="font-medium">{item.item.name}</p>
                  {item.item.sku && (
                    <p className="text-xs text-gray-500">{t('skuPrefix')} {item.item.sku}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-600">{item.description || '-'}</td>
                <td className="py-3 px-4 text-right">
                  {item.quantity} {item.item.unitOfMeasure}
                </td>
                <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-4 text-right">
                  {item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right">
                  {item.taxRate > 0 ? `${item.taxRate}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  {formatCurrency(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">{t('subtotal')}</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">{t('tax')}</span>
              <span>{formatCurrency(invoice.taxAmount)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">{t('discount')}</span>
                <span className="text-red-600">-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-gray-900 mt-2">
              <span>{t('total')}</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-8 p-4 bg-gray-50 rounded">
            <h3 className="text-sm font-bold text-gray-600 uppercase mb-2">{t('notesTitle')}</h3>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Payment Info */}
        {showPaymentInfo && invoice.status === 'final' && (
          <div className="mb-8 p-4 border border-gray-200 rounded">
            <h3 className="text-sm font-bold text-gray-600 uppercase mb-2">{t('paymentTitle')}</h3>
            <div className="text-sm text-gray-600">
              <p>{t('paymentBody')}</p>
              <p className="font-medium mt-1">{resolvedCompanyName}</p>
              <p className="mt-2">{t('paymentReference', { number: invoice.invoiceNumber })}</p>
            </div>
          </div>
        )}

        {/* Return Reference */}
        {invoice.returnedFromId && invoice.returnedFrom && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="text-sm font-bold text-yellow-800 uppercase mb-2">{t('returnTitle')}</h3>
            <p className="text-sm text-yellow-700">
              {t('returnBody')}{' '}
              <strong>{invoice.returnedFrom.invoiceNumber}</strong>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-8 left-8 right-8 border-t pt-4">
          <div className="flex justify-between text-xs text-gray-500">
            <div>
              <p>{t('thankYou')}</p>
              <p>{resolvedCompanyName}</p>
            </div>
            <div className="text-right">
              <p>{t('footerInvoice', { number: invoice.invoiceNumber })}</p>
              <p>{t('footerPage')}</p>
            </div>
          </div>
        </div>

        {/* Signature Area (for printed invoices) */}
        <div className="mt-16 pt-8 border-t hidden print:block">
          <div className="grid grid-cols-2 gap-16">
            <div>
              <div className="border-b border-gray-400 mb-2 h-16"></div>
              <p className="text-sm text-gray-600">{t('authorizedSignature')}</p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-2 h-16"></div>
              <p className="text-sm text-gray-600">{t('customerSignature')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default InvoicePdf;
