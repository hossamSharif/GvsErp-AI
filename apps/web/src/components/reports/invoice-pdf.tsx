'use client';

/**
 * Invoice PDF
 *
 * Printable invoice for sales and purchases. Renders the template chosen in
 * settings (or for a one-off print): `standard` — the full invoice, default —
 * or `statement`, the compact "كشف بيان" with the party's balance block.
 */

import React, { forwardRef } from 'react';
import { InvoiceStandardTemplate } from './invoice-standard-template';
import { InvoiceStatementTemplate } from './invoice-statement-template';
import type {
  InvoiceBalanceSnapshot,
  InvoicePrintTemplate,
  InvoiceWithRelations,
} from '@erp/shared';

interface InvoicePdfProps {
  invoice: InvoiceWithRelations;
  /** Layout to render; defaults to the standard invoice */
  template?: InvoicePrintTemplate;
  /** Party balance around the invoice (statement template only) */
  snapshot?: InvoiceBalanceSnapshot;
  showPaymentInfo?: boolean;
  className?: string;
}

export const InvoicePdf = forwardRef<HTMLDivElement, InvoicePdfProps>(
  function InvoicePdf({ template = 'standard', snapshot, ...props }, ref) {
    if (template === 'statement') {
      return (
        <InvoiceStatementTemplate
          ref={ref}
          invoice={props.invoice}
          snapshot={snapshot}
          className={props.className}
        />
      );
    }
    return <InvoiceStandardTemplate ref={ref} {...props} />;
  }
);

export default InvoicePdf;
