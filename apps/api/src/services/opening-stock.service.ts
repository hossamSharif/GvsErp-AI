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

    // Fetch which items already have an opening-stock layer — same approach,
    // no item_id IN clause; filter to active items in-memory.
    const { data: layerRows, error: layerErr } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('item_id')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId)
      .is('source_invoice_id', null);
    if (layerErr) throw layerErr;

    const openingSet = new Set<string>(
      ((layerRows ?? []) as unknown as { item_id: string }[]).map((r) => r.item_id)
    );

    return itemsResult.data.map((item) => {
      const costPrice =
        item.prices?.find((p) => p.priceTier === 'cost')?.price ?? 0;
      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku ?? null,
        unitOfMeasure: item.unitOfMeasure,
        currentQuantity: quantityMap.get(item.id) ?? 0,
        suggestedUnitCost: costPrice,
        hasOpeningEntry: openingSet.has(item.id),
      };
    });
  }

  // ===========================================================================
  // WRITE
  // ===========================================================================

  /**
   * Set opening stock for a batch of items in a warehouse:
   *   1. Additive quantity update on `inventory`
   *   2. FIFO cost layer insert on `stock_valuation_layers` (source_invoice_id = NULL)
   *   3. Optionally post JE if accounting is active
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

    // Step 1 + 2: For each item — adjust inventory quantity and insert FIFO layer.
    for (const item of items) {
      await this.inventoryRepo.adjustQuantity(
        this.tenantId,
        item.itemId,
        warehouseId,
        item.quantity, // additive
        0
      );

      const { error: layerErr } = await this.supabase
        .from('stock_valuation_layers' as any)
        .insert({
          tenant_id: this.tenantId,
          item_id: item.itemId,
          warehouse_id: warehouseId,
          qty_in: item.quantity,
          qty_remaining: item.quantity,
          unit_cost: item.unitCost,
          layer_date: new Date(asOfDate).toISOString(),
          source_invoice_id: null,
          source_invoice_item_id: null,
        });
      if (layerErr) throw layerErr;
    }

    // Step 3: Journal entry (only when accounting is active and inventory_asset is mapped).
    let journalEntryId: string | null = null;

    const accountingEnabled = await this.accountingService.isEnabled(this.tenantId);
    if (accountingEnabled) {
      const defaults = await this.accountingService.getDefaultAccountIds(this.tenantId);
      const inventoryAccountId = defaults.inventory_asset;

      if (inventoryAccountId) {
        const totalValue = items.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0
        );

        if (totalValue > 0) {
          const equityAccountId =
            await this.accountingService.getOrCreateOpeningBalanceEquityAccount(
              this.tenantId
            );

          const je = await this.accountingService.createJournalEntry(
            this.tenantId,
            userId ?? 'system',
            {
              entry_date: asOfDate,
              description: `Opening stock — ${warehouse.name} (${asOfDate})`,
              lines: [
                { account_id: inventoryAccountId, debit: totalValue, credit: 0 },
                { account_id: equityAccountId, debit: 0, credit: totalValue },
              ],
            }
          );

          await this.accountingService.postJournalEntry(this.tenantId, je.id);
          journalEntryId = je.id;
        }
      } else {
        console.warn(
          `[opening-stock] Accounting active but inventory_asset unmapped for tenant ${this.tenantId} — JE skipped`
        );
      }
    }

    return { updated: items.length, journalEntryId };
  }
}
