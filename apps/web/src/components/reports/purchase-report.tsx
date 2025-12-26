'use client';

/**
 * Purchase Report Component
 *
 * Generates a printable/PDF purchase report with summary and details.
 */

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { PurchaseReportEntry, PurchaseReportSummary, InvoiceStatus } from '@erp-saas/shared';

// =============================================================================
// TYPES
// =============================================================================

interface PurchaseReportProps {
  entries: PurchaseReportEntry[];
  summary?: PurchaseReportSummary;
  dateFrom?: string;
  dateTo?: string;
  generatedAt: string;
  companyName?: string;
  companyLogo?: string;
  className?: string;
}

// =============================================================================
// STATUS LABELS
// =============================================================================

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  final: 'Finalized',
  returned: 'Returned',
  canceled: 'Canceled',
};

// =============================================================================
// COMPONENT
// =============================================================================

export const PurchaseReport = forwardRef<HTMLDivElement, PurchaseReportProps>(
  function PurchaseReport(
    {
      entries,
      summary,
      dateFrom,
      dateTo,
      generatedAt,
      companyName = 'Your Company',
      companyLogo,
      className,
    },
    ref
  ) {
    const formatCurrency = (value: number) => {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString();
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white text-black p-8 min-h-[11in] w-[8.5in] mx-auto',
          'print:p-0 print:shadow-none',
          className
        )}
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="h-12 mb-2 object-contain" />
              ) : (
                <h1 className="text-2xl font-bold">{companyName}</h1>
              )}
              <p className="text-gray-600">Purchase Report</p>
            </div>
            <div className="text-right text-sm">
              <p>
                <strong>Period:</strong>{' '}
                {dateFrom && dateTo
                  ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
                  : 'All Time'}
              </p>
              <p>
                <strong>Generated:</strong> {formatDate(generatedAt)}
              </p>
              <p>
                <strong>Total Orders:</strong> {entries.length}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        {summary && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 border-b pb-2">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded">
                <p className="text-sm text-gray-600">Total Purchases</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(summary.totalAmount)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalSubtotal)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Total Tax</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalTax)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Total Discount</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalDiscount)}</p>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">By Status</h3>
              <div className="grid grid-cols-4 gap-2 text-sm">
                {(Object.entries(summary.byStatus) as [InvoiceStatus, { count: number; total: number }][]).map(
                  ([status, data]) => (
                    <div key={status} className="p-2 border rounded">
                      <p className="text-gray-600">{STATUS_LABELS[status]}</p>
                      <p className="font-medium">
                        {data.count} ({formatCurrency(data.total)})
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Details Table */}
        <div>
          <h2 className="text-lg font-bold mb-4 border-b pb-2">Purchase Order Details</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2">PO #</th>
                <th className="text-left py-2 px-2">Date</th>
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">Subtotal</th>
                <th className="text-right py-2 px-2">Tax</th>
                <th className="text-right py-2 px-2">Discount</th>
                <th className="text-right py-2 px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-b border-gray-200',
                    index % 2 === 1 && 'bg-gray-50'
                  )}
                >
                  <td className="py-2 px-2 font-medium">{entry.invoiceNumber}</td>
                  <td className="py-2 px-2">{formatDate(entry.date)}</td>
                  <td className="py-2 px-2">{entry.partyName || 'No Supplier'}</td>
                  <td className="py-2 px-2 text-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        entry.status === 'final' && 'bg-green-100 text-green-800',
                        entry.status === 'draft' && 'bg-yellow-100 text-yellow-800',
                        entry.status === 'returned' && 'bg-gray-100 text-gray-800',
                        entry.status === 'canceled' && 'bg-red-100 text-red-800'
                      )}
                    >
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">{formatCurrency(entry.subtotal)}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(entry.taxAmount)}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(entry.discountAmount)}</td>
                  <td className="py-2 px-2 text-right font-medium">
                    {formatCurrency(entry.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-bold">
                <td colSpan={4} className="py-2 px-2 text-right">
                  Totals:
                </td>
                <td className="py-2 px-2 text-right">
                  {formatCurrency(entries.reduce((sum, e) => sum + e.subtotal, 0))}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatCurrency(entries.reduce((sum, e) => sum + e.taxAmount, 0))}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatCurrency(entries.reduce((sum, e) => sum + e.discountAmount, 0))}
                </td>
                <td className="py-2 px-2 text-right">
                  {formatCurrency(entries.reduce((sum, e) => sum + e.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-500 text-center">
          <p>
            This report was generated on {new Date(generatedAt).toLocaleString()} |{' '}
            {companyName}
          </p>
          <p className="mt-1">Page 1 of 1</p>
        </div>
      </div>
    );
  }
);

export default PurchaseReport;
