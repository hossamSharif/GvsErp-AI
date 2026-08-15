/**
 * Item Movement Service
 *
 * Builds a per-item stock ledger: opening quantity, every in/out movement in a
 * date range, the closing quantity, and the KPIs (revenue, COGS, margin,
 * price spread) that make the numbers actionable.
 *
 * There is no `stock_movements` table in this schema — the `StockMovement`
 * type in @erp/shared is a shape, not a table. The ledger is therefore DERIVED
 * from:
 *
 *   invoice_items ⋈ invoices   status IN ('final','returned')
 *     type=purchase, returned_from_id IS NULL   → IN   (purchase)
 *     type=purchase, returned_from_id NOT NULL  → OUT  (purchase return)
 *     type=sale,     returned_from_id IS NULL   → OUT  (sale, incl. POS)
 *     type=sale,     returned_from_id NOT NULL  → IN   (sale return)
 *   stock_valuation_layers where source_invoice_id IS NULL
 *     AND source_settlement_id IS NULL       → IN   (opening entry)
 *   transfer_items ⋈ transfers status='completed' → IN/OUT, only when a
 *     warehouse filter is applied (company-wide they net to zero)
 *   settlement_items ⋈ settlements status='posted' → IN/OUT by the sign of
 *     difference_quantity. Always included: a settlement creates or destroys
 *     stock outright, so unlike transfers it never nets to zero.
 *
 * Opening quantity is computed BACKWARDS from current on-hand
 * (`opening = onHand − totalIn + totalOut`) rather than read from the opening
 * stock layer. That works for any date range, not just since setup, and makes
 * the ledger self-reconciling: opening + in − out must equal on-hand.
 *
 * Modelled on PartyService.getPartyStatement — fetch separately, merge, sort,
 * fold a running balance.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ItemRepository } from '../repositories/item.repository';
import { AccountingService } from './accounting.service';
import type {
  ItemMovementRow,
  ItemMovementReport,
  ItemMovementKpis,
  ItemMovementParams,
} from '@erp/shared';

export class ItemMovementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ItemMovementError';
  }
}

/** Shape returned by the invoice_items ⋈ invoices join. */
interface InvoiceLineRow {
  id: string;
  quantity: number | string;
  unit_price: number | string;
  discount_percent: number | string | null;
  cogs_amount: number | string | null;
  invoice: {
    id: string;
    invoice_number: string;
    type: 'sale' | 'purchase';
    status: string;
    invoice_date: string | null;
    finalized_at: string | null;
    created_at: string;
    currency: string | null;
    returned_from_id: string | null;
    party_id: string | null;
    warehouse_id: string | null;
    party: { id: string; name: string } | null;
    warehouse: { id: string; name: string } | null;
  } | null;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

export class ItemMovementService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly itemRepository: ItemRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.itemRepository = new ItemRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
  }

  async getItemMovement(
    itemId: string,
    params: ItemMovementParams
  ): Promise<ItemMovementReport> {
    const item = await this.itemRepository.findByIdWithRelations(this.tenantId, itemId);
    if (!item) {
      throw new ItemMovementError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    const { dateFrom, dateTo, warehouseId } = params;

    const warehouseName = warehouseId
      ? await this.getWarehouseName(warehouseId)
      : null;
    if (warehouseId && !warehouseName) {
      throw new ItemMovementError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }

    // Gather the four movement sources in parallel.
    const [
      invoiceRows,
      openingRows,
      transferRows,
      settlementRows,
      onHandQuantity,
      stockValue,
    ] = await Promise.all([
      this.getInvoiceMovements(itemId, dateFrom, dateTo, warehouseId),
      this.getOpeningLayerMovements(itemId, dateFrom, dateTo, warehouseId),
      warehouseId
        ? this.getTransferMovements(itemId, dateFrom, dateTo, warehouseId)
        : Promise.resolve<ItemMovementRow[]>([]),
      this.getSettlementMovements(itemId, dateFrom, dateTo, warehouseId),
      this.getOnHandQuantity(itemId, warehouseId),
      this.getStockValue(itemId, warehouseId),
    ]);

    const merged = [
      ...invoiceRows,
      ...openingRows,
      ...transferRows,
      ...settlementRows,
    ].sort((a, b) => {
      // Opening entries always lead, whatever their layer_date. Tenants
      // commonly record opening stock AFTER they have already entered some
      // sales; sorting it chronologically would run the ledger negative for
      // most of its length and only correct itself at the very end. An opening
      // balance is the starting position by definition, so it belongs first.
      const aOpening = a.movementType === 'opening' ? 0 : 1;
      const bOpening = b.movementType === 'opening' ? 0 : 1;
      if (aOpening !== bOpening) return aOpening - bOpening;

      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      // Stable secondary sort so equal dates render deterministically, with
      // incoming stock before outgoing on the same day.
      if (diff !== 0) return diff;
      return b.quantityIn - a.quantityIn;
    });

    const totalIn = merged.reduce((sum, r) => sum + r.quantityIn, 0);
    const totalOut = merged.reduce((sum, r) => sum + r.quantityOut, 0);

    // Derive opening backwards from on-hand so the ledger reconciles.
    const openingQuantity = round3(onHandQuantity - totalIn + totalOut);

    let running = openingQuantity;
    const withBalance = merged.map((row) => {
      running = round3(running + row.quantityIn - row.quantityOut);
      return { ...row, runningBalance: running };
    });

    const closingQuantity = running;

    // KPIs need `cogsAmount`, which rides along on invoice rows but is not part
    // of the wire shape — compute first, then strip it off the response.
    const kpis = await this.buildKpis(
      itemId,
      withBalance,
      dateFrom,
      dateTo,
      openingQuantity,
      closingQuantity,
      onHandQuantity
    );

    const movements: ItemMovementRow[] = withBalance.map((row) => {
      const { cogsAmount: _cogsAmount, ...rest } = row as ItemMovementRow & {
        cogsAmount?: number | null;
      };
      return rest;
    });

    return {
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        brand: item.brand,
        categoryName: item.category?.name ?? null,
        unitOfMeasure: item.unitOfMeasure,
        isActive: item.isActive,
      },
      warehouseId: warehouseId ?? null,
      warehouseName,
      dateFrom,
      dateTo,
      opening: { quantity: openingQuantity },
      closing: {
        quantity: closingQuantity,
        onHandQuantity,
        // Tolerance covers float noise on DECIMAL(15,3) round-trips.
        reconciles: Math.abs(closingQuantity - onHandQuantity) < 0.001,
        stockValue,
      },
      movements,
      kpis,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // MOVEMENT SOURCES
  // ==========================================================================

  /**
   * Invoice-backed movements. Draft invoices are excluded because they have not
   * touched stock — including them would break reconciliation with on-hand.
   */
  private async getInvoiceMovements(
    itemId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string
  ): Promise<ItemMovementRow[]> {
    let query = this.supabase
      .from('invoice_items')
      .select(
        `
        id,
        quantity,
        unit_price,
        discount_percent,
        cogs_amount,
        invoice:invoices!inner(
          id,
          invoice_number,
          type,
          status,
          invoice_date,
          finalized_at,
          created_at,
          currency,
          returned_from_id,
          party_id,
          warehouse_id,
          party:parties(id, name),
          warehouse:warehouses(id, name)
        )
      `
      )
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .in('invoice.status', ['final', 'returned'])
      .gte('invoice.invoice_date', dateFrom)
      .lte('invoice.invoice_date', dateTo);

    if (warehouseId) {
      query = query.eq('invoice.warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as unknown as InvoiceLineRow[])
      .filter((row) => row.invoice !== null)
      .map((row) => {
        const inv = row.invoice!;
        const isReturn = inv.returned_from_id !== null;
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unit_price);
        const discountPercent = Number(row.discount_percent ?? 0);
        const lineNet = round2(quantity * unitPrice * (1 - discountPercent / 100));

        // A returned sale puts stock back IN; a returned purchase sends it OUT.
        const isIncoming =
          inv.type === 'purchase' ? !isReturn : isReturn;

        const movementType = inv.type === 'purchase'
          ? (isReturn ? 'purchase_return' : 'purchase')
          : (isReturn ? 'sale_return' : 'sale');

        return {
          id: row.id,
          movementType,
          date: inv.invoice_date || inv.finalized_at || inv.created_at,
          invoiceId: inv.id,
          invoiceType: inv.type,
          invoiceNumber: inv.invoice_number,
          partyId: inv.party?.id ?? null,
          partyName: inv.party?.name ?? null,
          warehouseId: inv.warehouse?.id ?? null,
          warehouseName: inv.warehouse?.name ?? null,
          quantityIn: isIncoming ? quantity : 0,
          quantityOut: isIncoming ? 0 : quantity,
          runningBalance: 0, // folded in by the caller
          unitPrice,
          discountPercent,
          lineNet,
          currency: inv.currency,
          notes: null,
          // Carried for KPI computation, stripped from the wire shape below.
          cogsAmount: row.cogs_amount === null ? null : Number(row.cogs_amount),
        } as ItemMovementRow & { cogsAmount: number | null };
      });
  }

  /**
   * Opening-stock entries. Convention (see OpeningStockService): a FIFO layer
   * with source_invoice_id IS NULL is an opening entry rather than a purchase.
   */
  private async getOpeningLayerMovements(
    itemId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string
  ): Promise<ItemMovementRow[]> {
    let query = this.supabase
      .from('stock_valuation_layers' as any)
      .select('id, qty_in, unit_cost, layer_date, warehouse_id, warehouse:warehouses(id, name)')
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .is('source_invoice_id', null)
      // A settlement overage also creates a layer with no source invoice, but it
      // is an adjustment, not opening stock — it is reported by
      // getSettlementMovements instead.
      .is('source_settlement_id', null)
      .gte('layer_date', dateFrom)
      // layer_date is a timestamptz — extend to the end of the closing day so
      // same-day entries are not silently dropped.
      .lte('layer_date', `${dateTo}T23:59:59.999Z`);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      movementType: 'opening' as const,
      date: row.layer_date,
      invoiceId: null,
      invoiceType: null,
      invoiceNumber: null,
      partyId: null,
      partyName: null,
      warehouseId: row.warehouse_id ?? null,
      warehouseName: row.warehouse?.name ?? null,
      quantityIn: Number(row.qty_in),
      quantityOut: 0,
      runningBalance: 0,
      unitPrice: row.unit_cost === null ? null : Number(row.unit_cost),
      discountPercent: null,
      lineNet:
        row.unit_cost === null
          ? null
          : round2(Number(row.qty_in) * Number(row.unit_cost)),
      currency: null,
      notes: null,
    }));
  }

  /**
   * Posted stock settlements (physical-count adjustments). Unlike transfers,
   * these do NOT net to zero company-wide — a settlement creates or destroys
   * stock outright — so they are always included, warehouse filter or not.
   *
   * Omitting this source would not trip the `reconciles` flag, because opening
   * is derived backwards from on-hand: the ledger would silently absorb every
   * adjustment into the opening balance and still look self-consistent.
   */
  private async getSettlementMovements(
    itemId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId?: string
  ): Promise<ItemMovementRow[]> {
    let query = this.supabase
      .from('settlement_items' as any)
      .select(
        `
        id,
        difference_quantity,
        unit_cost,
        value_delta,
        notes,
        settlement:settlements!inner(
          id,
          settlement_number,
          settlement_date,
          status,
          reason,
          warehouse_id,
          warehouse:warehouses(id, name)
        )
      `
      )
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .eq('settlement.status', 'posted')
      .gte('settlement.settlement_date', dateFrom)
      .lte('settlement.settlement_date', dateTo);

    if (warehouseId) {
      query = query.eq('settlement.warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as any[])
      .filter((row) => Number(row.difference_quantity ?? 0) !== 0)
      .map((row) => {
        const diff = Number(row.difference_quantity);
        const settlement = row.settlement;

        return {
          id: row.id,
          movementType: 'adjustment' as const,
          date: settlement.settlement_date,
          invoiceId: null,
          invoiceType: null,
          invoiceNumber: settlement.settlement_number,
          partyId: null,
          partyName: null,
          warehouseId: settlement.warehouse_id ?? null,
          warehouseName: settlement.warehouse?.name ?? null,
          quantityIn: diff > 0 ? diff : 0,
          quantityOut: diff < 0 ? -diff : 0,
          runningBalance: 0,
          unitPrice: row.unit_cost === null ? null : Number(row.unit_cost),
          discountPercent: null,
          lineNet: row.value_delta === null ? null : round2(Number(row.value_delta)),
          currency: null,
          notes: row.notes ?? settlement.reason ?? null,
        };
      });
  }

  /**
   * Inter-warehouse transfers. Only meaningful when the report is scoped to a
   * single warehouse — company-wide, every transfer in is matched by a transfer
   * out and they cancel.
   */
  private async getTransferMovements(
    itemId: string,
    dateFrom: string,
    dateTo: string,
    warehouseId: string
  ): Promise<ItemMovementRow[]> {
    const { data, error } = await this.supabase
      .from('transfer_items')
      .select(
        `
        id,
        quantity,
        transfer:transfers!inner(
          id,
          transfer_number,
          status,
          completed_at,
          from_warehouse_id,
          to_warehouse_id,
          from_warehouse:warehouses!transfers_from_warehouse_id_fkey(id, name),
          to_warehouse:warehouses!transfers_to_warehouse_id_fkey(id, name)
        )
      `
      )
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .eq('transfer.status', 'completed')
      .gte('transfer.completed_at', dateFrom)
      .lte('transfer.completed_at', `${dateTo}T23:59:59.999Z`);

    if (error) throw error;

    return ((data ?? []) as any[])
      // Filtered in memory rather than via an embedded .or() — a single item's
      // transfer volume is small, and this avoids PostgREST embedded-filter
      // syntax that differs across supabase-js versions.
      .filter(
        (row) =>
          row.transfer !== null &&
          (row.transfer.from_warehouse_id === warehouseId ||
            row.transfer.to_warehouse_id === warehouseId)
      )
      .map((row) => {
        const tr = row.transfer;
        const isIncoming = tr.to_warehouse_id === warehouseId;
        const quantity = Number(row.quantity);

        return {
          id: row.id,
          movementType: (isIncoming ? 'transfer_in' : 'transfer_out') as
            | 'transfer_in'
            | 'transfer_out',
          date: tr.completed_at,
          invoiceId: null,
          invoiceType: null,
          invoiceNumber: tr.transfer_number,
          partyId: null,
          partyName: null,
          warehouseId: isIncoming ? tr.to_warehouse_id : tr.from_warehouse_id,
          warehouseName: isIncoming
            ? (tr.to_warehouse?.name ?? null)
            : (tr.from_warehouse?.name ?? null),
          quantityIn: isIncoming ? quantity : 0,
          quantityOut: isIncoming ? 0 : quantity,
          runningBalance: 0,
          unitPrice: null,
          discountPercent: null,
          lineNet: null,
          currency: null,
          notes: isIncoming
            ? (tr.from_warehouse?.name ?? null)
            : (tr.to_warehouse?.name ?? null),
        };
      });
  }

  // ==========================================================================
  // STOCK POSITION
  // ==========================================================================

  /** Current on-hand, summed across warehouses unless scoped to one. */
  private async getOnHandQuantity(
    itemId: string,
    warehouseId?: string
  ): Promise<number> {
    let query = this.supabase
      .from('inventory')
      .select('quantity')
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return round3(
      (data ?? []).reduce((sum, row: { quantity: number | string }) => sum + Number(row.quantity), 0)
    );
  }

  /** Value of unconsumed FIFO layers — what the stock on hand is worth at cost. */
  private async getStockValue(itemId: string, warehouseId?: string): Promise<number> {
    let query = this.supabase
      .from('stock_valuation_layers' as any)
      .select('qty_remaining, unit_cost')
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .gt('qty_remaining', 0);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return round2(
      ((data ?? []) as any[]).reduce(
        (sum, row) => sum + Number(row.qty_remaining) * Number(row.unit_cost),
        0
      )
    );
  }

  private async getWarehouseName(warehouseId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('warehouses')
      .select('name')
      .eq('tenant_id', this.tenantId)
      .eq('id', warehouseId)
      .maybeSingle();

    if (error) throw error;
    return data?.name ?? null;
  }

  // ==========================================================================
  // KPIs
  // ==========================================================================

  private async buildKpis(
    itemId: string,
    movements: (ItemMovementRow & { cogsAmount?: number | null })[],
    dateFrom: string,
    dateTo: string,
    openingQuantity: number,
    closingQuantity: number,
    onHandQuantity: number
  ): Promise<ItemMovementKpis> {
    const by = (type: string) => movements.filter((m) => m.movementType === type);

    const sales = by('sale');
    const salesReturns = by('sale_return');
    const purchases = by('purchase');
    const purchaseReturns = by('purchase_return');

    const soldQty = sales.reduce((s, m) => s + m.quantityOut, 0);
    const salesReturnedQty = salesReturns.reduce((s, m) => s + m.quantityIn, 0);
    const purchasedQty = purchases.reduce((s, m) => s + m.quantityIn, 0);
    const purchaseReturnedQty = purchaseReturns.reduce((s, m) => s + m.quantityOut, 0);

    const netSoldQty = soldQty - salesReturnedQty;
    const netPurchasedQty = purchasedQty - purchaseReturnedQty;

    const sum = (rows: typeof movements) =>
      rows.reduce((s, m) => s + (m.lineNet ?? 0), 0);

    const revenue = round2(sum(sales) - sum(salesReturns));
    const purchaseCost = round2(sum(purchases) - sum(purchaseReturns));

    // COGS: prefer the exact FIFO figure written at finalize time. Fall back to
    // the weighted-average purchase cost when the tenant has cogs_enabled off
    // or the rows predate COGS tracking, and flag it as estimated.
    const cogsEnabled = await this.accountingService.isCogsEnabled(this.tenantId);
    const recordedCogs = sales.reduce((s, m) => s + (m.cogsAmount ?? 0), 0);
    const recordedReturnCogs = salesReturns.reduce((s, m) => s + (m.cogsAmount ?? 0), 0);
    const hasRecordedCogs =
      cogsEnabled && sales.length > 0 && sales.every((m) => m.cogsAmount !== null && m.cogsAmount !== undefined);

    const avgPurchaseCost =
      netPurchasedQty > 0 ? round2(purchaseCost / netPurchasedQty) : null;

    // When the period contains no purchases, fall back to the weighted cost of
    // the remaining FIFO layers so profit is still meaningful.
    const fallbackUnitCost =
      avgPurchaseCost ?? (await this.getWeightedLayerCost(itemId));

    const cogs = hasRecordedCogs
      ? round2(recordedCogs - recordedReturnCogs)
      : round2(netSoldQty * (fallbackUnitCost ?? 0));

    const grossProfit = round2(revenue - cogs);
    const marginPercent =
      revenue !== 0 ? round2((grossProfit / revenue) * 100) : null;

    const avgSellPrice = netSoldQty > 0 ? round2(revenue / netSoldQty) : null;

    const sellPrices = sales
      .map((m) => m.unitPrice)
      .filter((p): p is number => p !== null);

    const salesInvoiceIds = new Set(sales.map((m) => m.invoiceId).filter(Boolean));
    const purchaseInvoiceIds = new Set(purchases.map((m) => m.invoiceId).filter(Boolean));
    const customerIds = new Set(sales.map((m) => m.partyId).filter(Boolean));
    const supplierIds = new Set(purchases.map((m) => m.partyId).filter(Boolean));

    const latest = (rows: typeof movements): string | null =>
      rows.length === 0
        ? null
        : rows.reduce((max, m) => (m.date > max ? m.date : max), rows[0].date);

    // Days of stock: how long current on-hand lasts at the period's sales rate.
    const periodDays = Math.max(
      1,
      Math.round(
        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000
      ) + 1
    );
    const avgDailySold = netSoldQty / periodDays;
    const daysOfStock =
      avgDailySold > 0 ? round2(onHandQuantity / avgDailySold) : null;

    const averageStock = (openingQuantity + closingQuantity) / 2;
    const turnover =
      averageStock > 0 ? round2(netSoldQty / averageStock) : null;

    return {
      purchasedQty: round3(purchasedQty),
      purchaseReturnedQty: round3(purchaseReturnedQty),
      soldQty: round3(soldQty),
      salesReturnedQty: round3(salesReturnedQty),
      totalIn: round3(movements.reduce((s, m) => s + m.quantityIn, 0)),
      totalOut: round3(movements.reduce((s, m) => s + m.quantityOut, 0)),

      revenue,
      purchaseCost,
      cogs,
      cogsIsEstimated: !hasRecordedCogs,
      grossProfit,
      marginPercent,

      avgSellPrice,
      avgPurchaseCost,
      minSellPrice: sellPrices.length > 0 ? Math.min(...sellPrices) : null,
      maxSellPrice: sellPrices.length > 0 ? Math.max(...sellPrices) : null,

      salesInvoiceCount: salesInvoiceIds.size,
      purchaseInvoiceCount: purchaseInvoiceIds.size,
      distinctCustomers: customerIds.size,
      distinctSuppliers: supplierIds.size,
      lastSoldAt: latest(sales),
      lastPurchasedAt: latest(purchases),

      daysOfStock,
      turnover,
    };
  }

  /**
   * Weighted-average unit cost across all remaining FIFO layers — the cost
   * fallback when the reporting period contains no purchases of its own.
   */
  private async getWeightedLayerCost(itemId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('qty_in, unit_cost')
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId);

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const totalQty = rows.reduce((s, r) => s + Number(r.qty_in), 0);
    if (totalQty <= 0) return null;

    const totalValue = rows.reduce(
      (s, r) => s + Number(r.qty_in) * Number(r.unit_cost),
      0
    );
    return round2(totalValue / totalQty);
  }
}
