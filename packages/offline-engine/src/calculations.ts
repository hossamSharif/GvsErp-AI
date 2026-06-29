/**
 * Deterministic finance calculations shared by the API and the web client.
 *
 * Every function here is pure (no I/O, no globals) and must produce output
 * byte-identical to the existing server logic, so an invoice priced offline
 * matches the same invoice priced/finalized on the server. The reference
 * implementations these mirror:
 *  - line total:        apps/api/src/services/invoice.service.ts (calculateLineTotal)
 *                       apps/web/src/stores/draft-store.ts (calculateLineTotal)
 *  - invoice totals:    apps/web/src/stores/draft-store.ts (getDraft* selectors)
 *  - stock movements:   apps/api/src/services/invoice.service.ts (applyStockMovements)
 *  - party balance:     packages/database/migrations/007_parties_schema.sql (triggers)
 */

import type {
  InvoiceTotals,
  InvoiceType,
  LineInput,
  PartyBalanceEvent,
  StockMovement,
} from './types';

/** Round to 2 decimal places the same way the server does. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Line total = quantity * unitPrice * (1 - discount%) * (1 + tax%), rounded to
 * 2 decimals. Matches both server and draft-store implementations exactly.
 */
export function calculateLineTotal(line: LineInput): number {
  return round2(
    line.quantity *
      line.unitPrice *
      (1 - line.discountPercent / 100) *
      (1 + line.taxRate / 100)
  );
}

/**
 * Document totals. `subtotal` and `taxAmount` are intentionally left unrounded
 * (matching the draft-store selectors); only `total` is rounded, after applying
 * the document-level discount.
 */
export function computeInvoiceTotals(
  items: LineInput[],
  discountAmount = 0
): InvoiceTotals {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (1 - item.discountPercent / 100),
    0
  );

  const taxAmount = items.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        item.unitPrice *
        (1 - item.discountPercent / 100) *
        (item.taxRate / 100),
    0
  );

  const total = round2(subtotal + taxAmount - discountAmount);

  return { subtotal, taxAmount, total };
}

/**
 * Signed inventory change for one line.
 *  - sale finalize:    -quantity   purchase finalize:   +quantity
 *  - sale return:      +quantity   purchase return:     -quantity
 */
export function stockQuantityChange(
  type: InvoiceType,
  quantity: number,
  isReturn = false
): number {
  const sign = type === 'sale' ? -1 : 1;
  return (isReturn ? -sign : sign) * quantity;
}

/** Apply a signed change to a previous quantity. */
export function applyStockDelta(
  previousQuantity: number,
  quantityChange: number
): number {
  return previousQuantity + quantityChange;
}

/**
 * Compute the full set of stock movements for a document's items against a
 * snapshot of current quantities (keyed by itemId; missing = 0).
 */
export function computeStockMovements(
  type: InvoiceType,
  items: Array<{ itemId: string; quantity: number }>,
  currentQuantities: Record<string, number>,
  isReturn = false
): StockMovement[] {
  return items.map((item) => {
    const previousQuantity = currentQuantities[item.itemId] ?? 0;
    const quantityChange = stockQuantityChange(type, item.quantity, isReturn);
    return {
      itemId: item.itemId,
      quantityChange,
      previousQuantity,
      newQuantity: applyStockDelta(previousQuantity, quantityChange),
    };
  });
}

/**
 * Signed change to a party's balance for a given event, in base currency.
 * Mirrors the Postgres triggers exactly so offline projections converge with
 * the server once the queued mutation replays.
 */
export function computePartyBalanceDelta(event: PartyBalanceEvent): number {
  if (event.kind === 'invoice_finalize') {
    const base = event.total * (event.exchangeRate ?? 1);
    return event.isReturn ? -base : base;
  }
  // payment: balance decreases; a reversal (delete) increases it back.
  const base = event.amount * (event.exchangeRate ?? 1);
  return event.isReversal ? base : -base;
}
