/**
 * Settlement Service
 *
 * Inventory settlements (stock adjustments): correct warehouse on-hand against a
 * physical count, keep FIFO valuation in step, and book the value difference to
 * the Inventory Adjustment account.
 *
 * Lines carry an ABSOLUTE counted quantity, not a delta. Two consequences worth
 * knowing:
 *   - On-hand can never go negative (counted_quantity has a >= 0 CHECK and
 *     on-hand is set to it), so no "would drive stock negative" guard is needed
 *     on the forward path. Reversals are the exception — see reverseSettlement.
 *   - A draft's system_quantity is only a display snapshot. The authoritative
 *     value is re-read under a row lock inside the post_settlement RPC, so a
 *     sale between drafting and posting cannot be silently overwritten.
 *
 * Posting is delegated to the post_settlement() Postgres function so the whole
 * document applies atomically. The rest of this codebase writes stock
 * non-transactionally and tolerates partial application; a half-applied physical
 * count would corrupt both on-hand and valuation, so settlements do not.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { SettlementRepository } from '../repositories/settlement.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { AccountingService } from './accounting.service';
import type {
  CountSheetParams,
  CountSheetRow,
  CreateSettlementInput,
  PostSettlementResult,
  ReverseSettlementResult,
  SettlementItemInput,
  SettlementQueryParams,
  SettlementWithDetails,
  UpdateSettlementInput,
} from '@erp/shared';

export class SettlementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SettlementError';
  }
}

const EPS = 0.0001;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

interface PostSettlementRpcRow {
  lines_applied: number;
  increase_value: number | string;
  decrease_value: number | string;
  net_value_delta: number | string;
}

export class SettlementService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly tenantId: string;
  private readonly repo: SettlementRepository;
  private readonly warehouseRepo: WarehouseRepository;
  private readonly accountingService: AccountingService;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.repo = new SettlementRepository(supabase);
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.accountingService = new AccountingService(supabase);
  }

  // ==========================================================================
  // COUNT SHEET
  // ==========================================================================

  /**
   * Build the physical-count worksheet for a warehouse: every item with its
   * current on-hand and a suggested unit cost.
   *
   * Suggested cost falls back in the same order OpeningStockService uses:
   * newest remaining FIFO layer → `cost` price tier → 0.
   */
  async getCountSheet(
    params: CountSheetParams
  ): Promise<{ data: CountSheetRow[]; meta: { page: number; limit: number; total: number; total_pages: number } }> {
    const { warehouseId, categoryId, search, onlyWithStock, page = 1, limit = 100 } =
      params;

    const warehouse = await this.warehouseRepo.getById(this.tenantId, warehouseId);
    if (!warehouse) {
      throw new SettlementError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }

    let query = this.supabase
      .from('items')
      .select(
        `id, name, sku, barcode, unit_of_measure, category_id,
         categories(id, name),
         inventory(quantity, warehouse_id),
         item_prices(price, price_tier)`,
        { count: 'exact' }
      )
      .eq('tenant_id', this.tenantId)
      .eq('is_active', true);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (search) {
      const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
      query = query.or(
        `name.ilike.%${escaped}%,sku.ilike.%${escaped}%,barcode.ilike.%${escaped}%`
      );
    }

    const from = (page - 1) * limit;
    query = query.order('name', { ascending: true }).range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const itemRows = (data ?? []) as unknown as {
      id: string;
      name: string;
      sku: string | null;
      barcode: string | null;
      unit_of_measure: string;
      category_id: string | null;
      categories: { id: string; name: string } | null;
      inventory: { quantity: number | string; warehouse_id: string }[] | null;
      item_prices: { price: number | string; price_tier: string }[] | null;
    }[];

    const layerCosts = await this.getLatestLayerCosts(
      warehouseId,
      itemRows.map((i) => i.id)
    );

    const rows: CountSheetRow[] = itemRows.map((item) => {
      const inv = (item.inventory ?? []).find((r) => r.warehouse_id === warehouseId);
      const costTier = (item.item_prices ?? []).find((p) => p.price_tier === 'cost');

      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        barcode: item.barcode,
        unitOfMeasure: item.unit_of_measure,
        categoryId: item.category_id,
        categoryName: item.categories?.name ?? null,
        systemQuantity: round3(Number(inv?.quantity ?? 0)),
        suggestedUnitCost: round2(
          layerCosts.get(item.id) ?? Number(costTier?.price ?? 0)
        ),
      };
    });

    const filtered = onlyWithStock ? rows.filter((r) => r.systemQuantity > EPS) : rows;

    return {
      data: filtered,
      meta: {
        page,
        limit,
        total: count ?? filtered.length,
        total_pages: Math.ceil((count ?? filtered.length) / limit),
      },
    };
  }

  /**
   * Newest still-remaining FIFO layer cost per item for a warehouse. Newest
   * rather than oldest: it is the best estimate of what found stock is worth
   * today, which is what an overage line needs.
   */
  private async getLatestLayerCosts(
    warehouseId: string,
    itemIds: string[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (itemIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('item_id, unit_cost, layer_date')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId)
      .in('item_id', itemIds)
      .gt('qty_remaining', 0)
      .order('layer_date', { ascending: false });

    if (error) throw error;

    for (const row of (data ?? []) as unknown as {
      item_id: string;
      unit_cost: number | string;
    }[]) {
      // Ordered newest-first, so the first hit per item wins.
      if (!result.has(row.item_id)) {
        result.set(row.item_id, Number(row.unit_cost));
      }
    }

    return result;
  }

  // ==========================================================================
  // READS
  // ==========================================================================

  async getSettlements(params: SettlementQueryParams) {
    return this.repo.findWithFilters(this.tenantId, params);
  }

  async getSettlement(id: string): Promise<SettlementWithDetails> {
    const settlement = await this.repo.findByIdWithItems(this.tenantId, id);
    if (!settlement) {
      throw new SettlementError('Settlement not found', 'SETTLEMENT_NOT_FOUND', 404);
    }
    return settlement;
  }

  // ==========================================================================
  // DRAFT LIFECYCLE
  // ==========================================================================

  async createSettlement(
    input: CreateSettlementInput,
    userId?: string
  ): Promise<SettlementWithDetails> {
    const warehouse = await this.warehouseRepo.getById(
      this.tenantId,
      input.warehouseId
    );
    if (!warehouse) {
      throw new SettlementError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }

    await this.assertItemsExist(input.items);

    const systemQuantities = await this.getSystemQuantities(
      input.warehouseId,
      input.items.map((i) => i.itemId)
    );

    const settlementNumber = await this.repo.generateSettlementNumber(this.tenantId);

    const id = await this.repo.createWithItems(
      this.tenantId,
      {
        settlementNumber,
        warehouseId: input.warehouseId,
        settlementDate: input.settlementDate ?? new Date().toISOString().split('T')[0],
        reason: input.reason ?? 'count_correction',
        notes: input.notes,
        createdBy: userId ?? null,
      },
      input.items,
      systemQuantities
    );

    return this.getSettlement(id);
  }

  async updateSettlement(
    id: string,
    input: UpdateSettlementInput
  ): Promise<SettlementWithDetails> {
    const settlement = await this.getSettlement(id);
    this.assertDraft(settlement, 'update');

    if (input.items) {
      await this.assertItemsExist(input.items);
      const systemQuantities = await this.getSystemQuantities(
        settlement.warehouseId,
        input.items.map((i) => i.itemId)
      );
      await this.repo.replaceItems(this.tenantId, id, input.items, systemQuantities);
    }

    await this.repo.updateHeader(this.tenantId, id, {
      settlementDate: input.settlementDate,
      reason: input.reason,
      notes: input.notes,
    });

    return this.getSettlement(id);
  }

  async deleteSettlement(id: string): Promise<void> {
    const settlement = await this.getSettlement(id);
    this.assertDraft(settlement, 'delete');
    await this.repo.delete(this.tenantId, id);
  }

  // ==========================================================================
  // POSTING
  // ==========================================================================

  /**
   * Apply the document. Stock and valuation move atomically inside the RPC; the
   * journal entry is posted afterwards and, following the house pattern
   * (expense.service.ts, invoice.service.ts), a JE failure is logged and
   * surfaced as a warning rather than failing the stock correction — the
   * physical count is the fact, the ledger entry is a consequence.
   */
  async postSettlement(id: string, userId?: string): Promise<PostSettlementResult> {
    const settlement = await this.getSettlement(id);
    this.assertDraft(settlement, 'post');

    if (settlement.items.length === 0) {
      throw new SettlementError(
        'Settlement has no lines',
        'SETTLEMENT_NO_LINES',
        400
      );
    }

    const cogsEnabled = await this.accountingService.isCogsEnabled(this.tenantId);

    const { data, error } = await this.supabase.rpc('post_settlement' as any, {
      p_settlement_id: id,
      p_tenant_id: this.tenantId,
      p_user_id: userId ?? null,
      p_cogs_enabled: cogsEnabled,
    });

    if (error) throw this.translateRpcError(error);

    const rpcRow = (Array.isArray(data) ? data[0] : data) as
      | PostSettlementRpcRow
      | undefined;
    if (!rpcRow) {
      throw new SettlementError(
        'Settlement posting returned no result',
        'SETTLEMENT_POST_FAILED',
        500
      );
    }

    const netValueDelta = Number(rpcRow.net_value_delta);

    let journalEntryId: string | null = null;
    let accountingWarning: string | null = null;

    if (await this.accountingService.isEnabled(this.tenantId)) {
      try {
        const entry = await this.accountingService.generateJournalEntryFromSettlement(
          this.tenantId,
          userId ?? null,
          id,
          netValueDelta,
          settlement.settlementDate,
          `Stock settlement ${settlement.settlementNumber} — ${settlement.warehouseName}`
        );
        if (entry) {
          journalEntryId = entry.id;
          await this.repo.updateHeader(this.tenantId, id, {
            journalEntryId: entry.id,
          });
        } else if (Math.abs(netValueDelta) >= 0.01) {
          accountingWarning =
            'Stock was corrected but no journal entry was posted — the Inventory Asset account is not mapped in Accounting settings.';
        }
      } catch (e) {
        console.error(`[settlement] JE failed for settlement ${id}:`, e);
        accountingWarning =
          e instanceof Error
            ? `Stock was corrected but the journal entry failed: ${e.message}`
            : 'Stock was corrected but the journal entry failed.';
      }
    }

    return {
      settlement: await this.getSettlement(id),
      linesApplied: rpcRow.lines_applied,
      increaseValue: round2(Number(rpcRow.increase_value)),
      decreaseValue: round2(Number(rpcRow.decrease_value)),
      netValueDelta: round2(netValueDelta),
      journalEntryId,
      accountingWarning,
    };
  }

  /**
   * Reverse a posted settlement by creating and posting a mirror document that
   * counts each item back to what it was before, then reversing the original's
   * journal entry.
   *
   * Unlike the forward path this CAN fail on stock grounds: if a shortage
   * settlement was posted and the remaining stock has since been sold, undoing
   * an increase could imply negative on-hand. That is checked up front so the
   * caller gets a clear message instead of a constraint violation.
   */
  async reverseSettlement(
    id: string,
    userId?: string
  ): Promise<ReverseSettlementResult> {
    const original = await this.getSettlement(id);

    if (original.status !== 'posted') {
      throw new SettlementError(
        'Only posted settlements can be reversed',
        'SETTLEMENT_NOT_POSTED',
        400
      );
    }
    if (original.reversalOfId) {
      throw new SettlementError(
        'A reversal cannot itself be reversed',
        'SETTLEMENT_IS_REVERSAL',
        400
      );
    }

    const existingReversal = await this.repo.findReversalOf(this.tenantId, id);
    if (existingReversal) {
      throw new SettlementError(
        `This settlement has already been reversed by ${existingReversal.settlementNumber}`,
        'SETTLEMENT_ALREADY_REVERSED',
        400
      );
    }

    const current = await this.getSystemQuantities(
      original.warehouseId,
      original.items.map((i) => i.itemId)
    );

    // Target = current on-hand minus the difference this document applied.
    const items: SettlementItemInput[] = [];
    for (const line of original.items) {
      const applied = line.differenceQuantity ?? 0;
      if (Math.abs(applied) < EPS) continue;

      const target = round3((current.get(line.itemId) ?? 0) - applied);
      if (target < -EPS) {
        throw new SettlementError(
          `Cannot reverse: item ${line.itemName} would fall to ${target}. Stock has moved since this settlement was posted.`,
          'SETTLEMENT_REVERSAL_NEGATIVE',
          400
        );
      }

      items.push({
        itemId: line.itemId,
        countedQuantity: Math.max(0, target),
        unitCost: line.unitCost,
        notes: `Reversal of ${original.settlementNumber}`,
      });
    }

    if (items.length === 0) {
      throw new SettlementError(
        'Nothing to reverse — this settlement changed no quantities',
        'SETTLEMENT_NO_CHANGES',
        400
      );
    }

    const settlementNumber = await this.repo.generateSettlementNumber(this.tenantId);
    const systemQuantities = await this.getSystemQuantities(
      original.warehouseId,
      items.map((i) => i.itemId)
    );

    const reversalId = await this.repo.createWithItems(
      this.tenantId,
      {
        settlementNumber,
        warehouseId: original.warehouseId,
        settlementDate: new Date().toISOString().split('T')[0],
        reason: original.reason,
        notes: `Reversal of ${original.settlementNumber}`,
        reversalOfId: id,
        createdBy: userId ?? null,
      },
      items,
      systemQuantities
    );

    const posted = await this.postSettlement(reversalId, userId);

    // Mirror the original's JE so the ledger unwinds too.
    let journalEntryId: string | null = posted.journalEntryId;
    try {
      const reversalEntry = await this.accountingService.reverseEntry(
        this.tenantId,
        userId ?? null,
        'settlement',
        id,
        `Reversal of settlement ${original.settlementNumber}`
      );
      if (reversalEntry) journalEntryId = reversalEntry.id;
    } catch (e) {
      console.error(`[settlement] JE reversal failed for settlement ${id}:`, e);
    }

    await this.repo.updateHeader(this.tenantId, id, { status: 'canceled' });

    return {
      original: (await this.getSettlement(id)) as SettlementWithDetails,
      reversal: posted.settlement,
      journalEntryId,
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private assertDraft(settlement: SettlementWithDetails, action: string): void {
    if (settlement.status !== 'draft') {
      throw new SettlementError(
        `Cannot ${action} a ${settlement.status} settlement`,
        'SETTLEMENT_NOT_DRAFT',
        400
      );
    }
  }

  private async assertItemsExist(items: SettlementItemInput[]): Promise<void> {
    const ids = [...new Set(items.map((i) => i.itemId))];
    if (ids.length === 0) return;

    const { data, error } = await this.supabase
      .from('items')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .in('id', ids);

    if (error) throw error;

    const found = new Set((data ?? []).map((r) => (r as { id: string }).id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new SettlementError(
        `Item(s) not found: ${missing.join(', ')}`,
        'ITEM_NOT_FOUND',
        404
      );
    }
  }

  /** Current on-hand per item for a warehouse (missing rows read as 0). */
  private async getSystemQuantities(
    warehouseId: string,
    itemIds: string[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (itemIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('inventory')
      .select('item_id, quantity')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId)
      .in('item_id', itemIds);

    if (error) throw error;

    for (const row of (data ?? []) as unknown as {
      item_id: string;
      quantity: number | string;
    }[]) {
      result.set(row.item_id, Number(row.quantity));
    }

    for (const id of itemIds) {
      if (!result.has(id)) result.set(id, 0);
    }

    return result;
  }

  /** Turn the RPC's RAISE messages into typed, user-facing errors. */
  private translateRpcError(error: { message?: string }): Error {
    const message = error?.message ?? '';

    if (message.includes('SETTLEMENT_NOT_FOUND')) {
      return new SettlementError('Settlement not found', 'SETTLEMENT_NOT_FOUND', 404);
    }
    if (message.includes('SETTLEMENT_NOT_DRAFT')) {
      return new SettlementError(
        'This settlement has already been posted',
        'SETTLEMENT_NOT_DRAFT',
        400
      );
    }
    if (message.includes('SETTLEMENT_NO_CHANGES')) {
      return new SettlementError(
        'No line differs from the system quantity — nothing to post',
        'SETTLEMENT_NO_CHANGES',
        400
      );
    }
    if (message.includes('SETTLEMENT_NEGATIVE_STOCK')) {
      return new SettlementError(
        'Settlement would drive stock negative',
        'SETTLEMENT_NEGATIVE_STOCK',
        400
      );
    }
    return error as Error;
  }
}
