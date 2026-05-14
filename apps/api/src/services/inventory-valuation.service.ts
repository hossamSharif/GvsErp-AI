/**
 * Inventory Valuation Service (Phase 5)
 *
 * Maintains FIFO cost layers and computes COGS on sale finalize. Quarantined
 * behind a per-tenant feature flag — caller is responsible for checking
 * `tenants.settings.modules.accounting.cogs_enabled` before invoking these
 * methods.
 *
 * Append-only design: layers are never deleted. Sales consume qty_remaining
 * oldest-first; fully-consumed layers stay for audit trail.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';

export class InventoryValuationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'InventoryValuationError';
  }
}

/** Slim shape of an invoice line we need for valuation. */
interface ValuationLine {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
}

/** Slim shape of the parent invoice. */
interface ValuationInvoice {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  finalized_at: string | null;
}

interface ConsumedSummary {
  invoice_item_id: string;
  item_id: string;
  qty_requested: number;
  qty_satisfied: number;
  cogs: number;
}

export interface ConsumeResult {
  total_cogs: number;
  lines: ConsumedSummary[];
  short_stock: ConsumedSummary[];
}

export class InventoryValuationService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Compute the per-unit cost basis of a purchase line, stripping any
   * embedded tax so the layer's unit_cost reflects real inventory cost.
   *
   *   line_total = qty * price * (1 - discount%) * (1 + tax%)
   *   cost_basis = qty * price * (1 - discount%) = line_total / (1 + tax%)
   *   unit_cost  = cost_basis / qty
   */
  private computeUnitCost(line: ValuationLine): number {
    const taxFactor = 1 + (Number(line.tax_rate ?? 0) / 100);
    const costBasis = Number(line.line_total) / (taxFactor || 1);
    return costBasis / Number(line.quantity);
  }

  /**
   * Record one FIFO layer per purchase line. Idempotent: a re-run for the
   * same invoice will detect existing layers (by source_invoice_item_id)
   * and skip them, so finalize-retry doesn't double-count.
   */
  async recordLayersForPurchase(invoice: ValuationInvoice): Promise<number> {
    const { data: lines, error: lErr } = await this.supabase
      .from('invoice_items')
      .select('id, item_id, quantity, unit_price, discount_percent, tax_rate, line_total')
      .eq('invoice_id', invoice.id)
      .eq('tenant_id', invoice.tenant_id);
    if (lErr) throw lErr;

    if (!lines || lines.length === 0) return 0;

    // Idempotency check: which lines already have a layer?
    const { data: existing, error: eErr } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('source_invoice_item_id')
      .eq('tenant_id', invoice.tenant_id)
      .eq('source_invoice_id', invoice.id);
    if (eErr) throw eErr;
    const seen = new Set(
      ((existing as unknown) as { source_invoice_item_id: string | null }[] ?? [])
        .map((r) => r.source_invoice_item_id)
        .filter((x): x is string => !!x)
    );

    const layerDate = invoice.finalized_at ?? new Date().toISOString();
    const rows = (lines as ValuationLine[])
      .filter((line) => !seen.has(line.id))
      .map((line) => ({
        tenant_id: invoice.tenant_id,
        item_id: line.item_id,
        warehouse_id: invoice.warehouse_id,
        qty_in: Number(line.quantity),
        qty_remaining: Number(line.quantity),
        unit_cost: this.computeUnitCost(line),
        layer_date: layerDate,
        source_invoice_id: invoice.id,
        source_invoice_item_id: line.id,
      }));

    if (rows.length === 0) return 0;

    const { error: iErr } = await this.supabase
      .from('stock_valuation_layers' as any)
      .insert(rows);
    if (iErr) throw iErr;
    return rows.length;
  }

  /**
   * Consume FIFO layers for every line on a sales invoice and stamp the
   * resulting per-line COGS onto `invoice_items.cogs_amount`. Returns the
   * total COGS that the accounting layer should post as
   *   Dr COGS  / Cr Inventory.
   *
   * Idempotent: if a line already has a non-null `cogs_amount`, that line
   * is skipped (assumed to be a retry) — this preserves the original
   * layer consumption.
   *
   * Short-stock fallback: if the available layers don't cover the
   * requested quantity (e.g. opening stock wasn't migrated as a layer),
   * the missing units cost 0 — matching Tally's "negative-stock with no
   * cost" behavior. The shortfall is returned for the caller to log.
   */
  async consumeLayersForSale(invoice: ValuationInvoice): Promise<ConsumeResult> {
    const { data: lines, error: lErr } = await this.supabase
      .from('invoice_items')
      .select('id, item_id, quantity, unit_price, discount_percent, tax_rate, line_total, cogs_amount')
      .eq('invoice_id', invoice.id)
      .eq('tenant_id', invoice.tenant_id);
    if (lErr) throw lErr;

    const result: ConsumeResult = { total_cogs: 0, lines: [], short_stock: [] };
    if (!lines || lines.length === 0) return result;

    for (const lineRow of lines as unknown as Array<
      ValuationLine & { cogs_amount: number | null }
    >) {
      // Idempotency: pre-existing cogs_amount means this line was already
      // consumed. Surface it in the total so the caller's JE math stays right.
      if (lineRow.cogs_amount !== null && lineRow.cogs_amount !== undefined) {
        result.lines.push({
          invoice_item_id: lineRow.id,
          item_id: lineRow.item_id,
          qty_requested: Number(lineRow.quantity),
          qty_satisfied: Number(lineRow.quantity),
          cogs: Number(lineRow.cogs_amount),
        });
        result.total_cogs += Number(lineRow.cogs_amount);
        continue;
      }

      let remaining = Number(lineRow.quantity);
      let cogs = 0;

      // Pull layers oldest-first while remaining > 0. We do this in a loop
      // rather than one query because we need to UPDATE each layer's
      // qty_remaining as we consume it — and Supabase doesn't expose
      // transactions, so we serialize.
      while (remaining > 0.0001) {
        const { data: layer, error: layerErr } = await this.supabase
          .from('stock_valuation_layers' as any)
          .select('id, qty_remaining, unit_cost')
          .eq('tenant_id', invoice.tenant_id)
          .eq('item_id', lineRow.item_id)
          .eq('warehouse_id', invoice.warehouse_id)
          .gt('qty_remaining', 0)
          .order('layer_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (layerErr) throw layerErr;

        if (!layer) break; // Short stock: no more layers.

        const layerRow = layer as unknown as {
          id: string;
          qty_remaining: number;
          unit_cost: number;
        };
        const consume = Math.min(Number(layerRow.qty_remaining), remaining);
        cogs += consume * Number(layerRow.unit_cost);

        const newRemaining = Number(layerRow.qty_remaining) - consume;
        const { error: updErr } = await this.supabase
          .from('stock_valuation_layers' as any)
          .update({ qty_remaining: newRemaining })
          .eq('id', layerRow.id);
        if (updErr) throw updErr;

        remaining -= consume;
      }

      const satisfied = Number(lineRow.quantity) - remaining;
      const roundedCogs = Math.round(cogs * 100) / 100;

      // Stamp the line so reports + re-runs see the COGS.
      const { error: stampErr } = await this.supabase
        .from('invoice_items')
        .update({ cogs_amount: roundedCogs } as any)
        .eq('id', lineRow.id);
      if (stampErr) throw stampErr;

      const summary: ConsumedSummary = {
        invoice_item_id: lineRow.id,
        item_id: lineRow.item_id,
        qty_requested: Number(lineRow.quantity),
        qty_satisfied: satisfied,
        cogs: roundedCogs,
      };
      result.lines.push(summary);
      if (remaining > 0.0001) {
        result.short_stock.push(summary);
      }
      result.total_cogs += roundedCogs;
    }

    return result;
  }

  /**
   * Reverse a previously-recorded purchase: refund qty_remaining back to
   * any layers that originated from this invoice. Used on purchase delete.
   * Fully-consumed layers (qty_remaining = 0 because downstream sales ate
   * them) cannot be fully reversed — those layers stay at 0 and the
   * caller is informed via the returned shortfall.
   */
  async reverseLayersForPurchase(
    tenantId: string,
    invoiceId: string
  ): Promise<{ reversed: number; partially_consumed: number }> {
    const { data: layers, error } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('id, qty_in, qty_remaining')
      .eq('tenant_id', tenantId)
      .eq('source_invoice_id', invoiceId);
    if (error) throw error;

    let reversed = 0;
    let partiallyConsumed = 0;

    for (const row of ((layers as unknown) as {
      id: string;
      qty_in: number;
      qty_remaining: number;
    }[]) ?? []) {
      if (Number(row.qty_in) > Number(row.qty_remaining)) {
        partiallyConsumed++;
      }
      // Zero it out — the layer is removed from the FIFO queue. Keeping
      // the row preserves the audit trail of "this purchase happened".
      const { error: uErr } = await this.supabase
        .from('stock_valuation_layers' as any)
        .update({ qty_remaining: 0 })
        .eq('id', row.id);
      if (uErr) throw uErr;
      reversed++;
    }

    return { reversed, partially_consumed: partiallyConsumed };
  }
}
