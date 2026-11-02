'use client';

/**
 * usePrintInvoice
 *
 * Shared printing hook for sales and purchase invoice detail pages.
 * Wraps react-to-print with a sensible documentTitle (so the saved
 * PDF is named like "Sale-INV-2026-0142.pdf" instead of a UUID) and
 * an A4 page setup.
 *
 * Template-aware: `handlePrint()` prints the default template from tenant
 * settings (`standard` unless changed); `handlePrint('statement')` prints a
 * one-off with another template. The statement template needs the party
 * balance snapshot, so printing waits until it has loaded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useTenantSettings } from '@/hooks/use-settings';
import { useInvoiceBalanceSnapshot } from '@/hooks/use-invoices';
import { printTemplateFromSettings, type InvoicePrintTemplate } from '@/lib/print-template';

interface PrintableInvoice {
  id: string;
  invoiceNumber: string;
  type: 'sale' | 'purchase';
}

export function usePrintInvoice(invoice: PrintableInvoice | undefined) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: settingsResp } = useTenantSettings();
  const defaultTemplate = invoice
    ? printTemplateFromSettings(settingsResp?.data, invoice.type)
    : 'standard';

  // One-off template for the print in flight; null → the default.
  const [override, setOverride] = useState<InvoicePrintTemplate | null>(null);
  const [pending, setPending] = useState(false);
  const activeTemplate = override ?? defaultTemplate;

  const snapshotQuery = useInvoiceBalanceSnapshot(
    invoice?.id,
    defaultTemplate === 'statement' || activeTemplate === 'statement'
  );

  const titlePrefix =
    activeTemplate === 'statement'
      ? 'Statement'
      : invoice?.type === 'sale'
        ? 'Sale'
        : 'Purchase';

  const print = useReactToPrint({
    content: () => printRef.current,
    documentTitle: invoice ? `${titlePrefix}-${invoice.invoiceNumber}` : 'Invoice',
    pageStyle: '@page { size: A4; margin: 12mm 14mm; }',
    removeAfterPrint: true,
    onAfterPrint: () => setOverride(null),
  });

  const handlePrint = useCallback((template?: InvoicePrintTemplate) => {
    setOverride(template ?? null);
    setPending(true);
  }, []);

  // Print once the chosen template is rendered and, for the statement, its
  // balance snapshot has settled (a failed fetch still prints, showing "—").
  const snapshotReady = activeTemplate !== 'statement' || !snapshotQuery.isLoading;
  useEffect(() => {
    if (!pending || !snapshotReady) return;
    setPending(false);
    print();
  }, [pending, snapshotReady, print]);

  return {
    printRef,
    handlePrint,
    activeTemplate,
    defaultTemplate,
    snapshot: snapshotQuery.data,
    isPreparingPrint: pending,
  };
}
