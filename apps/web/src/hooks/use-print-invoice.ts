'use client';

/**
 * usePrintInvoice
 *
 * Shared printing hook for sales and purchase invoice detail pages.
 * Wraps react-to-print with a sensible documentTitle (so the saved
 * PDF is named like "Sale-INV-2026-0142.pdf" instead of a UUID) and
 * an A4 page setup.
 */

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

interface PrintableInvoice {
  invoiceNumber: string;
  type: 'sale' | 'purchase';
}

export function usePrintInvoice(invoice: PrintableInvoice | undefined) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: invoice
      ? `${invoice.type === 'sale' ? 'Sale' : 'Purchase'}-${invoice.invoiceNumber}`
      : 'Invoice',
    pageStyle: '@page { size: A4; margin: 12mm 14mm; }',
    removeAfterPrint: true,
  });

  return { printRef, handlePrint };
}
