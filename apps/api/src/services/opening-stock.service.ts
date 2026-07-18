/**
 * Opening Stock Service
 *
 * Handles first-time / corrective inventory setup:
 *   - Adds quantity to on-hand (additive, never overwrites)
 *   - Seeds a FIFO cost layer (always, even when COGS flag is off)
 *   - Posts a JE (Dr Inventory Asset / Cr Opening Balance Equity) when
 *     the accounting module is active
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { InventoryRepository } from '../repositories/inventory.repository';
import { ItemRepository } from '../repositories/item.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { AccountingService } from './accounting.service';
import type {
  OpeningStockRow,
  OpeningStockResult,
  SetOpeningStockInput,
} from '@erp/shared';

export class OpeningStockError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'OpeningStockError';
  }
}

export class OpeningStockService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly inventoryRepo: InventoryRepository;
  private readonly itemRepo: ItemRepository;
  private readonly warehouseRepo: WarehouseRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.inventoryRepo = new InventoryRepository(supabase);
    this.itemRepo = new ItemRepository(supabase);
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  /**
   * Return a row per active item in the tenant, joined with:
   *   - current on-hand quantity in this warehouse
   *   - suggested unit cost from the item's 'cost' price tier
   *   - whether an opening-stock layer (source_invoice_id IS NULL) already exists
   */
  async getOpeningStockRows(warehouseId: string): Promise<OpeningStockRow[]> {
    const warehouse = await this.warehouseRepo.getById(this.tenantId, warehouseId);
    if (!warehouse) {
      throw new OpeningStockError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }

    // Fetch all active items with their cost price, paginating to bypass the
    // PostgREST 1000-row default cap.
    const PAGE_SIZE = 500;
    let page = 1;
    let allItems: typeof firstPage.data = [];
    const firstPage = await this.itemRepo.findAllWithFilters({
      tenantId: this.tenantId,
      page: 1,
      limit: PAGE_SIZE,
      sort_by: 'name',
      sort_order: 'asc',
      includeInactive: false,
    });
    allItems = firstPage.data;
    const totalPages = firstPage.meta.total_pages;
    for (page = 2; page <= totalPages; page++) {
      const pageResult = await this.itemRepo.findAllWithFilters({
        tenantId: this.tenantId,
        page,
        limit: PAGE_SIZE,
        sort_by: 'name',
        sort_order: 'asc',
        includeInactive: false,
      });
      allItems = allItems.concat(pageResult.data);
    }

    const itemsResult = { data: allItems };

    if (itemsResult.data.length === 0) return [];

    const activeItemIds = new Set(itemsResult.data.map((i) => i.id));

    // Fetch current inventory quantities for this warehouse — no item_id filter
    // to avoid URL-length limits when there are thousands of items.
    const { data: invRows, error: invErr } = await this.supabase
      .from('inventory')
      .select('item_id, quantity')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId);
    if (invErr) throw invErr;

    const quantityMap = new Map<string, number>(
      ((invRows ?? []) as { item_id: string; quantity: number }[])
        .filter((r) => activeItemIds.has(r.item_id))
        .map((r) => [r.item_id, Number(r.quantity)])
    );

    // Fetch the opening-stock layers (source_invoice_id IS NULL) — same
    // approach, no item_id IN clause; aggregate per item in-memory into the
    // opening quantity, unsold remaining, already-sold floor and weighted cost.
    const { data: layerRows, error: layerErr } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('item_id, qty_in, qty_remaining, unit_cost')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId)
      .is('source_invoice_id', null);
    if (layerErr) throw layerErr;

    interface OpeningAgg {
      qtyIn: number;
      qtyRemaining: number;
      valueIn: number; // Σ qty_in * unit_cost
    }
    const openingMap = new Map<string, OpeningAgg>();
    for (const raw of (layerRows ?? []) as unknown as {
      item_id: string;
      qty_in: number;
      qty_remaining: number;
      unit_cost: number;
    }[]) {
      const agg = openingMap.get(raw.item_id) ?? { qtyIn: 0, qtyRemaining: 0, valueIn: 0 };
      agg.qtyIn += Number(raw.qty_in);
      agg.qtyRemaining += Number(raw.qty_remaining);
      agg.valueIn += Number(raw.qty_in) * Number(raw.unit_cost);
      openingMap.set(raw.item_id, agg);
    }

    return itemsResult.data.map((item) => {
      const costPrice =
        item.prices?.find((p) => p.priceTier === 'cost')?.price ?? 0;
      const agg = openingMap.get(item.id);
      const openingQuantity = agg ? agg.qtyIn : 0;
      const openingRemaining = agg ? agg.qtyRemaining : 0;
      const openingUnitCost =
        agg && agg.qtyIn > 0 ? agg.valueIn / agg.qtyIn : 0;
      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku ?? null,
        barcode: item.barcode ?? null,
        unitOfMeasure: item.unitOfMeasure,
        currentQuantity: quantityMap.get(item.id) ?? 0,
        suggestedUnitCost: costPrice,
        hasOpeningEntry: !!agg,
        openingQuantity,
        openingRemaining,
        openingSoldQuantity: Math.max(0, openingQuantity - openingRemaining),
        openingUnitCost,
      };
    });
  }

  // ===========================================================================
  // WRITE
  // ===========================================================================

  /**
   * Set opening stock for a batch of items in a warehouse (set/replace).
   *
   * Each submitted item's quantity/cost is treated as the value the opening
   * stock should now BE — not an amount to add. Per item we:
   *   1. Read the existing opening layers to derive the current opening qty,
   *      unsold remaining and already-sold floor.
   *   2. Reject any edit that drops below the already-sold quantity.
   *   3. Apply only the delta to on-hand (`inventory.quantity`).
   *   4. Consolidate the opening layers into a single canonical layer.
   *   5. Accumulate the accounting value delta.
   * A single adjusting JE for the net value delta is posted afterwards
   * (Dr/Cr direction depends on the sign) when accounting is active.
   */
  async setOpeningStock(
    warehouseId: string,
    input: SetOpeningStockInput,
    userId?: string
  ): Promise<OpeningStockResult> {
    const warehouse = await this.warehouseRepo.getById(this.tenantId, warehouseId);
    if (!warehouse) {
      throw new OpeningStockError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }

    const { asOfDate, items } = input;
    const EPS = 0.0001;
    let valueDelta = 0; // net change in booked opening value, across all items
    let updated = 0;

    for (const item of items) {
      const newQty = Number(item.quantity);
      const newCost = Number(item.unitCost);

      // Step 1: read this item's existing opening layers.
      const { data: layers, error: readErr } = await this.supabase
        .from('stock_valuation_layers' as any)
        .select('id, qty_in, qty_remaining, unit_cost')
        .eq('tenant_id', this.tenantId)
        .eq('item_id', item.itemId)
        .eq('warehouse_id', warehouseId)
        .is('source_invoice_id', null);
      if (readErr) throw readErr;

      const openingLayers = (layers ?? []) as unknown as {
        id: string;
        qty_in: number;
        qty_remaining: number;
        unit_cost: number;
      }[];

      const openingQty = openingLayers.reduce((s, l) => s + Number(l.qty_in), 0);
      const openingRemaining = openingLayers.reduce(
        (s, l) => s + Number(l.qty_remaining),
        0
      );
      const soldFromOpening = Math.max(0, openingQty - openingRemaining);
      const oldValue = openingLayers.reduce(
        (s, l) => s + Number(l.qty_in) * Number(l.unit_cost),
        0
      );

      // Step 2: floor guard — can't set below what's already been sold.
      if (newQty < soldFromOpening - EPS) {
        throw new OpeningStockError(
          `Cannot set opening stock below the ${soldFromOpening} unit(s) already sold for this item`,
          'OPENING_BELOW_SOLD',
          400
        );
      }

      // Skip true no-ops (same qty and same cost).
      const qtyUnchanged = Math.abs(newQty - openingQty) < EPS;
      const costUnchanged = Math.abs(newCost - (openingQty > 0 ? oldValue / openingQty : newCost)) < EPS;
      if (qtyUnchanged && costUnchanged) {
        continue;
      }

      // Step 3: apply the on-hand delta (may be negative). The floor guarantees
      // the resulting on-hand stays >= 0, but adjustQuantity backstops anyway.
      const delta = newQty - openingQty;
      if (Math.abs(delta) > EPS) {
        await this.inventoryRepo.adjustQuantity(
          this.tenantId,
          item.itemId,
          warehouseId,
          delta,
          0
        );
      }

      // Step 4: consolidate — delete existing opening layers, then insert one
      // canonical layer carrying the new qty/cost and the correct unsold
      // remaining. Already-sold units keep their stamped COGS on invoice_items,
      // so collapsing the layers is safe for future FIFO consumption.
      if (openingLayers.length > 0) {
        const { error: delErr } = await this.supabase
          .from('stock_valuation_layers' as any)
          .delete()
          .in('id', openingLayers.map((l) => l.id));
        if (delErr) throw delErr;
      }

      if (newQty > EPS) {
        const { error: insErr } = await this.supabase
          .from('stock_valuation_layers' as any)
          .insert({
            tenant_id: this.tenantId,
            item_id: item.itemId,
            warehouse_id: warehouseId,
            qty_in: newQty,
            qty_remaining: newQty - soldFromOpening,
            unit_cost: newCost,
            layer_date: new Date(asOfDate).toISOString(),
            source_invoice_id: null,
            source_invoice_item_id: null,
          });
        if (insErr) throw insErr;
      }

      // Step 5: accumulate the booked-value delta.
      valueDelta += newQty * newCost - oldValue;
      updated++;
    }

    // Post a single adjusting JE for the net value change (when accounting on).
    let journalEntryId: string | null = null;

    const accountingEnabled = await this.accountingService.isEnabled(this.tenantId);
    if (accountingEnabled && Math.abs(valueDelta) > EPS) {
      const defaults = await this.accountingService.getDefaultAccountIds(this.tenantId);
      const inventoryAccountId = defaults.inventory_asset;

      if (inventoryAccountId) {
        const equityAccountId =
          await this.accountingService.getOrCreateOpeningBalanceEquityAccount(
            this.tenantId
          );

        const amount = Math.abs(valueDelta);
        // valueDelta > 0: inventory increased  → Dr Inventory / Cr Opening Equity
        // valueDelta < 0: inventory decreased  → Dr Opening Equity / Cr Inventory
        const lines =
          valueDelta > 0
            ? [
                { account_id: inventoryAccountId, debit: amount, credit: 0 },
                { account_id: equityAccountId, debit: 0, credit: amount },
              ]
            : [
                { account_id: equityAccountId, debit: amount, credit: 0 },
                { account_id: inventoryAccountId, debit: 0, credit: amount },
              ];

        const je = await this.accountingService.createJournalEntry(
          this.tenantId,
          userId ?? 'system',
          {
            entry_date: asOfDate,
            description: `Opening stock — ${warehouse.name} (${asOfDate})`,
            lines,
          }
        );

        await this.accountingService.postJournalEntry(this.tenantId, je.id);
        journalEntryId = je.id;
      } else {
        console.warn(
          `[opening-stock] Accounting active but inventory_asset unmapped for tenant ${this.tenantId} — JE skipped`
        );
      }
    }

    return { updated, journalEntryId };
  }
}
