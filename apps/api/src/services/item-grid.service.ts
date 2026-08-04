/**
 * Item Grid Service
 *
 * Backs the items bulk-edit grid, which lets a user correct item main info,
 * retail/cost prices and warehouse opening stock from a single spreadsheet-like
 * screen.
 *
 * Two responsibilities:
 *   - READ:  one merged, filterable, paginated row set via the get_item_grid RPC
 *            (items + item_prices + inventory + opening valuation layers).
 *   - WRITE: a per-row save that fans out to up to four independent subsystems
 *            and reports each one separately. Sections are deliberately
 *            independent: a rejected barcode must not stop the price or the
 *            opening-stock write, because the user edited them in one gesture
 *            and needs to know exactly which part landed.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ItemRepository } from '../repositories/item.repository';
import { ItemService } from './item.service';
import { OpeningStockService } from './opening-stock.service';
import type {
  ItemGridRow,
  ItemGridQueryParams,
  ItemGridSection,
  ItemGridSectionResult,
  SaveItemGridRowInput,
  SaveItemGridRowResult,
} from '@erp/shared';

/** Shape returned by the get_item_grid RPC (snake_case, numerics as strings) */
interface ItemGridRpcRow {
  item_id: string;
  name: string;
  name_alias: string | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  unit_of_measure: string;
  tracks_expiry: boolean;
  expiry_date: string | null;
  is_active: boolean;
  retail_price_id: string | null;
  retail_price: string | number | null;
  retail_currency: string | null;
  cost_price_id: string | null;
  cost_price: string | number | null;
  cost_currency: string | null;
  current_qty: string | number;
  has_opening_entry: boolean;
  opening_qty: string | number;
  opening_remaining: string | number;
  opening_sold_qty: string | number;
  opening_unit_cost: string | number;
  total_count: string | number;
}

const num = (v: string | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

const nullableNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export class ItemGridService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly itemRepository: ItemRepository;
  private readonly itemService: ItemService;
  private readonly tenantId: string;
  /** Memoised per request — the default currency can't change mid-save */
  private defaultCurrency: string | null = null;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.itemRepository = new ItemRepository(supabase);
    this.itemService = new ItemService(supabase, tenantId);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  async getGridRows(
    params: ItemGridQueryParams
  ): Promise<{ data: ItemGridRow[]; meta: { page: number; limit: number; total: number; total_pages: number } }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const rows = await this.callRpc({
      warehouseId: params.warehouseId ?? null,
      search: params.search?.trim() || null,
      categoryId: params.categoryId ?? null,
      missingBarcode: params.missingBarcode ?? false,
      missingRetail: params.missingRetail ?? false,
      missingCost: params.missingCost ?? false,
      zeroOpeningQty: params.zeroOpeningQty ?? false,
      missingOpeningCost: params.missingOpeningCost ?? false,
      includeInactive: params.includeInactive ?? false,
      itemId: null,
      sortBy: params.sortBy ?? 'name',
      sortDir: params.sortDir ?? 'asc',
      limit,
      offset: (page - 1) * limit,
    });

    // total_count is a window over the filtered set, so it is identical on every
    // row; an empty page means zero matches.
    const total = rows.length > 0 ? num(rows[0].total_count) : 0;

    return {
      data: rows.map(this.mapRow),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /** Re-read a single row so the client can patch its cache without a refetch */
  async getGridRow(itemId: string, warehouseId?: string): Promise<ItemGridRow | null> {
    const rows = await this.callRpc({
      warehouseId: warehouseId ?? null,
      search: null,
      categoryId: null,
      missingBarcode: false,
      missingRetail: false,
      missingCost: false,
      zeroOpeningQty: false,
      missingOpeningCost: false,
      // The item may have just been deactivated elsewhere; still return it so
      // the row can render its result instead of vanishing mid-edit.
      includeInactive: true,
      itemId,
      sortBy: 'name',
      sortDir: 'asc',
      limit: 1,
      offset: 0,
    });

    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  // ==========================================================================
  // WRITE
  // ==========================================================================

  /**
   * Save one grid row.
   *
   * Every section is attempted independently and contributes exactly one result.
   * The overall call succeeds (HTTP 200) even when sections fail — `ok` and the
   * per-section codes carry the outcome, because partial success is the normal
   * case here and a 4xx would collapse that detail.
   */
  async saveRow(
    itemId: string,
    input: SaveItemGridRowInput,
    userId?: string,
    options: { canWriteOpening?: boolean } = {}
  ): Promise<SaveItemGridRowResult> {
    const sections: ItemGridSectionResult[] = [];

    // --- Item main info -----------------------------------------------------
    if (input.item && Object.keys(input.item).length > 0) {
      sections.push(await this.saveItemSection(itemId, input.item));
    } else {
      sections.push({ section: 'item', status: 'skipped' });
    }

    // --- Prices -------------------------------------------------------------
    sections.push(
      input.retailPrice !== undefined
        ? await this.savePriceSection(itemId, 'retail', 'retailPrice', input.retailPrice)
        : { section: 'retailPrice', status: 'skipped' }
    );

    sections.push(
      input.costPrice !== undefined
        ? await this.savePriceSection(itemId, 'cost', 'costPrice', input.costPrice)
        : { section: 'costPrice', status: 'skipped' }
    );

    // --- Opening stock ------------------------------------------------------
    if (input.opening) {
      sections.push(
        options.canWriteOpening === false
          ? {
              section: 'opening',
              status: 'failed',
              code: 'FORBIDDEN',
              message: 'You do not have permission to change opening stock',
            }
          : await this.saveOpeningSection(itemId, input.opening, userId)
      );
    } else {
      sections.push({ section: 'opening', status: 'skipped' });
    }

    // Re-read the row so the grid reconciles against the database, not against
    // what it hoped it wrote — partially-failed rows must show real values.
    let row: ItemGridRow | null = null;
    try {
      row = await this.getGridRow(itemId, input.opening?.warehouseId);
    } catch {
      row = null;
    }

    return {
      ok: sections.every((s) => s.status !== 'failed'),
      sections,
      row,
    };
  }

  // ==========================================================================
  // SECTION HANDLERS
  // ==========================================================================

  private async saveItemSection(
    itemId: string,
    item: NonNullable<SaveItemGridRowInput['item']>
  ): Promise<ItemGridSectionResult> {
    try {
      const update: Record<string, unknown> = {};
      if (item.name !== undefined) update.name = item.name;
      if (item.nameAlias !== undefined) update.nameAlias = item.nameAlias || null;
      // Blank barcode is stored as NULL so the unique partial index doesn't
      // collide across every barcode-less item.
      if (item.barcode !== undefined) update.barcode = item.barcode?.trim() || null;
      // items_expiry_requires_flag (migration 034) ties the two columns
      // together; the grid only ever sends a date, so derive the flag here.
      if (item.expiryDate !== undefined) {
        update.expiryDate = item.expiryDate || null;
        update.tracksExpiry = !!item.expiryDate;
      }

      await this.itemService.updateItem(itemId, update);

      return {
        section: 'item',
        status: 'ok',
        message: `Updated ${Object.keys(item).join(', ')}`,
      };
    } catch (error) {
      return { section: 'item', status: 'failed', ...describeError(error) };
    }
  }

  private async savePriceSection(
    itemId: string,
    tier: 'retail' | 'cost',
    section: Extract<ItemGridSection, 'retailPrice' | 'costPrice'>,
    price: number
  ): Promise<ItemGridSectionResult> {
    try {
      const currency = await this.getDefaultCurrency();
      const existing = await this.findEffectivePrice(itemId, tier);

      if (existing) {
        const updated = await this.itemRepository.updatePrice(this.tenantId, existing.id, {
          price,
        });
        if (!updated) {
          return {
            section,
            status: 'failed',
            code: 'PRICE_NOT_FOUND',
            message: 'The price row disappeared before it could be updated',
          };
        }
        return {
          section,
          status: 'ok',
          message: `Updated to ${price} ${existing.currency}`,
        };
      }

      // No price of this tier yet — create it in the tenant's default currency.
      await this.itemRepository.addPrice(this.tenantId, itemId, {
        price_tier: tier,
        price,
        currency,
        effective_from: null,
        effective_to: null,
      });

      return {
        section,
        status: 'ok',
        message: `Created at ${price} ${currency}`,
      };
    } catch (error) {
      return { section, status: 'failed', ...describeError(error) };
    }
  }

  private async saveOpeningSection(
    itemId: string,
    opening: NonNullable<SaveItemGridRowInput['opening']>,
    userId?: string
  ): Promise<ItemGridSectionResult> {
    try {
      const service = new OpeningStockService(this.supabase, this.tenantId);
      const result = await service.setOpeningStock(
        opening.warehouseId,
        {
          asOfDate: opening.asOfDate,
          items: [
            { itemId, quantity: opening.quantity, unitCost: opening.unitCost },
          ],
        },
        userId
      );

      // updated === 0 means the service found nothing to change; report that
      // honestly rather than claiming a write happened.
      return {
        section: 'opening',
        status: 'ok',
        message:
          result.updated === 0
            ? 'Already up to date'
            : `Set to ${opening.quantity} @ ${opening.unitCost}` +
              (result.journalEntryId ? ' (journal entry posted)' : ''),
      };
    } catch (error) {
      return { section: 'opening', status: 'failed', ...describeError(error) };
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * The currently effective price row of a tier, chosen the same way
   * get_item_price() and the grid RPC choose it, so an update always lands on
   * the row the user was looking at.
   */
  private async findEffectivePrice(
    itemId: string,
    tier: 'retail' | 'cost'
  ): Promise<{ id: string; currency: string } | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('item_prices')
      .select('id, currency, effective_from')
      .eq('tenant_id', this.tenantId)
      .eq('item_id', itemId)
      .eq('price_tier', tier)
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('effective_from', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return { id: data[0].id, currency: data[0].currency };
  }

  /**
   * Tenant default currency, resolved server-side so the grid never has to send
   * one: the `currencies` default row wins, then tenants.settings, then USD.
   */
  private async getDefaultCurrency(): Promise<string> {
    if (this.defaultCurrency) return this.defaultCurrency;

    const { data: currency } = await this.supabase
      .from('currencies')
      .select('code')
      .eq('tenant_id', this.tenantId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (currency?.code) {
      this.defaultCurrency = currency.code;
      return this.defaultCurrency;
    }

    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('settings')
      .eq('id', this.tenantId)
      .maybeSingle();

    const fromSettings = (tenant?.settings as { default_currency?: string } | null)
      ?.default_currency;

    this.defaultCurrency = fromSettings || 'USD';
    return this.defaultCurrency;
  }

  private async callRpc(args: {
    warehouseId: string | null;
    search: string | null;
    categoryId: string | null;
    missingBarcode: boolean;
    missingRetail: boolean;
    missingCost: boolean;
    zeroOpeningQty: boolean;
    missingOpeningCost: boolean;
    includeInactive: boolean;
    itemId: string | null;
    sortBy: string;
    sortDir: string;
    limit: number;
    offset: number;
  }): Promise<ItemGridRpcRow[]> {
    const { data, error } = await this.supabase.rpc('get_item_grid' as never, {
      p_tenant_id: this.tenantId,
      p_warehouse_id: args.warehouseId,
      p_search: args.search,
      p_category_id: args.categoryId,
      p_missing_barcode: args.missingBarcode,
      p_missing_retail: args.missingRetail,
      p_missing_cost: args.missingCost,
      p_zero_opening_qty: args.zeroOpeningQty,
      p_missing_opening_cost: args.missingOpeningCost,
      p_include_inactive: args.includeInactive,
      p_item_id: args.itemId,
      p_sort_by: args.sortBy,
      p_sort_dir: args.sortDir,
      p_limit: args.limit,
      p_offset: args.offset,
    } as never);

    if (error) throw error;

    return (data ?? []) as unknown as ItemGridRpcRow[];
  }

  private mapRow = (row: ItemGridRpcRow): ItemGridRow => ({
    itemId: row.item_id,
    name: row.name,
    nameAlias: row.name_alias,
    sku: row.sku,
    barcode: row.barcode,
    brand: row.brand,
    categoryId: row.category_id,
    categoryName: row.category_name,
    unitOfMeasure: row.unit_of_measure,
    tracksExpiry: row.tracks_expiry,
    expiryDate: row.expiry_date,
    isActive: row.is_active,
    retailPriceId: row.retail_price_id,
    retailPrice: nullableNum(row.retail_price),
    retailCurrency: row.retail_currency,
    costPriceId: row.cost_price_id,
    costPrice: nullableNum(row.cost_price),
    costCurrency: row.cost_currency,
    currentQuantity: num(row.current_qty),
    hasOpeningEntry: row.has_opening_entry,
    openingQuantity: num(row.opening_qty),
    openingRemaining: num(row.opening_remaining),
    openingSoldQuantity: num(row.opening_sold_qty),
    openingUnitCost: num(row.opening_unit_cost),
  });
}

/**
 * Normalise anything thrown by a section into a code + message the grid can
 * show verbatim. ItemError and OpeningStockError both carry a `code`; raw
 * Postgres errors carry one too, so the user sees the real reason rather than
 * a generic failure.
 */
function describeError(error: unknown): { code: string; message: string } {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string; details?: string };
    return {
      code: e.code || 'SAVE_FAILED',
      message: e.message || e.details || 'Save failed',
    };
  }
  return { code: 'SAVE_FAILED', message: String(error) };
}
