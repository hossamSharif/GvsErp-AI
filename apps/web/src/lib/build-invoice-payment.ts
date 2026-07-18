/**
 * buildInvoicePaymentPayload
 *
 * Shared construction of the `CreatePaymentInput` that settles a just-finalized
 * invoice with a single full allocation. Used by both the RecordPaymentDialog
 * (fields from the edited form) and the invoice form's background payment path
 * (values default from the invoice + the top-card accelerators).
 */

import type { CreatePaymentInput, InvoiceWithRelations } from '@erp/shared';

/** Select sentinel for the "cash" (no bank account) option. */
export const SENTINEL_CASH = '__cash__';

export interface InvoicePaymentOverrides {
  /** Raw select value: '' / SENTINEL_CASH → cash (null). */
  bankAccountId?: string | null;
  reference?: string | null;
  notes?: string | null;
  /** Default: invoice.total. */
  amount?: number;
  /** Default: invoice.currency. */
  currency?: string;
  /** Default: invoice.exchangeRate. */
  exchangeRate?: number;
  /** Default: invoice.invoiceDate. */
  paymentDate?: string;
}

/**
 * Build the payment payload. `invoice.partyId` MUST be non-null (callers gate on
 * this — walk-in invoices never record an immediate payment).
 */
export function buildInvoicePaymentPayload(
  invoice: InvoiceWithRelations,
  overrides: InvoicePaymentOverrides = {}
): CreatePaymentInput {
  const amount = overrides.amount ?? invoice.total;
  const rawBank = overrides.bankAccountId;
  const bankAccountId =
    rawBank && rawBank !== SENTINEL_CASH ? rawBank : null;

  return {
    partyId: invoice.partyId!,
    type: invoice.type === 'sale' ? 'received' : 'made',
    amount,
    currency: overrides.currency ?? invoice.currency,
    exchangeRate: overrides.exchangeRate ?? invoice.exchangeRate,
    bankAccountId,
    reference: overrides.reference || null,
    notes: overrides.notes || null,
    paymentDate: overrides.paymentDate ?? invoice.invoiceDate,
    // Auto-settle: allocate the whole payment to the invoice just saved.
    allocations: [{ invoice_id: invoice.id, amount }],
  };
}
