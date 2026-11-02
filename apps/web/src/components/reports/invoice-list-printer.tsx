'use client';

/**
 * Invoice List Printer
 *
 * Lets the sales/purchase list pages print or export an invoice straight from
 * a row's actions menu, without opening the detail page. It loads the full
 * invoice (usually already cached by the row-hover prefetch), renders the
 * printable template off-screen and prints it through usePrintInvoice — so
 * the default template and one-off overrides behave exactly as on the
 * detail page.
 */

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { InvoicePdf } from './invoice-pdf';
import { useInvoice } from '@/hooks/use-invoices';
import { usePrintInvoice } from '@/hooks/use-print-invoice';
import { useToast } from '@/hooks/use-toast';
import type { InvoicePrintTemplate } from '@/lib/print-template';

export interface InvoicePrintRequest {
  id: string;
  /** One-off template; omitted → the default from settings */
  template?: InvoicePrintTemplate;
  /** Distinguishes repeated requests for the same invoice */
  nonce: number;
}

interface InvoiceListPrinterProps {
  request: InvoicePrintRequest | null;
  /** Called when a request can't be fulfilled (invoice failed to load) */
  onFailed: () => void;
}

export function InvoiceListPrinter({ request, onFailed }: InvoiceListPrinterProps) {
  const { toast } = useToast();
  const tPrint = useTranslations('invoice.printMenu');

  // The request stays set after printing so the template remains mounted
  // while react-to-print copies it; the nonce guards against re-printing.
  const { data, isError } = useInvoice(request?.id);
  const invoice = data?.data?.id === request?.id ? data?.data : undefined;
  const { printRef, handlePrint, activeTemplate, snapshot } = usePrintInvoice(invoice);
  const handledNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!request || handledNonce.current === request.nonce) return;
    if (invoice) {
      handledNonce.current = request.nonce;
      handlePrint(request.template);
    } else if (isError) {
      handledNonce.current = request.nonce;
      toast({ variant: 'destructive', title: tPrint('loadFailed') });
      onFailed();
    }
  }, [request, invoice, isError, handlePrint, toast, tPrint, onFailed]);

  if (!invoice) return null;

  return (
    <div className="hidden">
      <InvoicePdf
        ref={printRef}
        invoice={invoice}
        template={activeTemplate}
        snapshot={snapshot}
      />
    </div>
  );
}

export default InvoiceListPrinter;
