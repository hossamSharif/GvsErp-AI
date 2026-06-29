/**
 * Shared value types for the offline engine.
 *
 * These mirror the operational shapes used by both the API service layer
 * (`apps/api`) and the web client (`apps/web`) so the deterministic finance
 * math has a single definition. Keep this file dependency-free.
 */

export type InvoiceType = 'sale' | 'purchase';

/** Minimal fields needed to price a single invoice line. */
export interface LineInput {
  quantity: number;
  unitPrice: number;
  /** Percentage 0-100. */
  discountPercent: number;
  /** Percentage 0-100. */
  taxRate: number;
}

/** Document-level totals matching the `invoices` table columns. */
export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** A single inventory adjustment produced by finalizing/returning a document. */
export interface StockMovement {
  itemId: string;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
}

/**
 * A party-balance change event, mirroring the Postgres triggers in
 * `007_parties_schema.sql`:
 *  - invoice finalize: balance += total * exchange_rate (return reverses)
 *  - payment:          balance -= amount * exchange_rate (reversal flips)
 */
export type PartyBalanceEvent =
  | {
      kind: 'invoice_finalize';
      total: number;
      exchangeRate?: number;
      /** A return reverses the finalize delta. */
      isReturn?: boolean;
    }
  | {
      kind: 'payment';
      amount: number;
      exchangeRate?: number;
      /** A payment deletion reverses the payment delta. */
      isReversal?: boolean;
    };
