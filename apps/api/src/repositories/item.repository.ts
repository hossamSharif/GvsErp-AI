/**
 * Item Repository
 *
 * Handles data access for items, item prices, and item packagings.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type {
  Item,
  ItemWithCategory,
  ItemWithRelations,
  ItemPrice,
  ItemPackaging,
  BulkPriceUpdateResult,
  BulkPriceUpdateAllResult,
} from '@erp/shared';

type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];

type ItemPriceRow = Database['public']['Tables']['item_prices']['Row'];
type ItemPriceInsert = Database['public']['Tables']['item_prices']['Insert'];

type ItemPackagingRow = Database['public']['Tables']['item_packagings']['Row'];
type ItemPackagingInsert = Database['public']['Tables']['item_packagings']['Insert'];

/**
 * Extended query options for items
 */
interface ItemQueryOptions extends QueryOptions {
  search?: string;
  categoryId?: string;
  /** If set, filter to exactly this is_active value. Overrides includeInactive. */
  isActive?: boolean;
  /** If set, filter to tracked items expiring within this many days */
  expiringWithinDays?: number;
}

/**
 * Repository for Item entity
 */
export class ItemRepository extends BaseRepository<'items', ItemRow, ItemInsert, ItemUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'items');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Find all items with search and filters
   */
  async findAllWithFilters(options: ItemQueryOptions): Promise<QueryResult<ItemWithCategory>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'name',
      sort_order = 'asc',
      includeInactive = false,
      isActive,
      search,
      categoryId,
      expiringWithinDays,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('items')
      .select(`
        *,
        category:categories(*),
        prices:item_prices(*)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters — precise isActive wins over the includeInactive toggle.
    if (typeof isActive === 'boolean') {
      query = query.eq('is_active', isActive);
    } else if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (typeof expiringWithinDays === 'number') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + expiringWithinDays);
      const cutoffDate = cutoff.toISOString().split('T')[0];
      query = query
        .eq('tracks_expiry', true)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', cutoffDate);
    }

    // Apply search using full-text search or ILIKE
    if (search) {
      const s = BaseRepository.escapeILike(search);
      const searchPattern = `%${s}%`;
      query = query.or(
        `name.ilike.${searchPattern},name_alias.ilike.${searchPattern},sku.ilike.${searchPattern},barcode.ilike.${searchPattern},brand.ilike.${searchPattern}`
      );
    }

    // Apply sorting and pagination
    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const items = (data || []).map(this.mapItemWithCategory);

    return {
      data: items,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find item by ID with all relations
   */
  async findByIdWithRelations(tenantId: string, id: string): Promise<ItemWithRelations | null> {
    const { data, error } = await this.supabase
      .from('items')
      .select(`
        *,
        category:categories(*),
        prices:item_prices(*),
        packagings:item_packagings(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapItemWithRelations(data);
  }

  /**
   * Get active items expiring within N days (default 30), via get_expiring_items()
   */
  async getExpiringItems(
    tenantId: string,
    daysThreshold: number = 30
  ): Promise<Array<{
    itemId: string;
    itemName: string;
    itemSku: string | null;
    expiryDate: string;
    daysUntilExpiry: number;
  }>> {
    const { data, error } = await this.supabase.rpc('get_expiring_items', {
      p_tenant_id: tenantId,
      p_days_threshold: daysThreshold,
    });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      itemSku: row.item_sku,
      expiryDate: row.expiry_date,
      daysUntilExpiry: row.days_until_expiry,
    }));
  }

  /**
   * Find item by SKU
   */
  async findBySku(tenantId: string, sku: string): Promise<ItemRow | null> {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('sku', sku)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Find item by barcode
   */
  async findByBarcode(tenantId: string, barcode: string): Promise<ItemRow | null> {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('barcode', barcode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Create item with prices and packagings
   */
  async createWithRelations(
    tenantId: string,
    item: Omit<ItemInsert, 'tenant_id' | 'id'>,
    prices?: Omit<ItemPriceInsert, 'tenant_id' | 'id' | 'item_id'>[],
    packagings?: Omit<ItemPackagingInsert, 'tenant_id' | 'id' | 'item_id'>[]
  ): Promise<ItemWithRelations> {
    // Create item
    const createdItem = await this.create(tenantId, item);

    // Create prices if provided
    let createdPrices: ItemPriceRow[] = [];
    if (prices && prices.length > 0) {
      const priceInserts = prices.map((price) => ({
        ...price,
        tenant_id: tenantId,
        item_id: createdItem.id,
      }));

      const { data: pricesData, error: pricesError } = await this.supabase
        .from('item_prices')
        .insert(priceInserts)
        .select();

      if (pricesError) {
        throw pricesError;
      }

      createdPrices = pricesData || [];
    }

    // Create packagings if provided
    let createdPackagings: ItemPackagingRow[] = [];
    if (packagings && packagings.length > 0) {
      const packagingInserts = packagings.map((packaging) => ({
        ...packaging,
        tenant_id: tenantId,
        item_id: createdItem.id,
      }));

      const { data: packagingsData, error: packagingsError } = await this.supabase
        .from('item_packagings')
        .insert(packagingInserts)
        .select();

      if (packagingsError) {
        throw packagingsError;
      }

      createdPackagings = packagingsData || [];
    }

    // Fetch category if present
    let category = null;
    if (createdItem.category_id) {
      const { data: categoryData } = await this.supabase
        .from('categories')
        .select('*')
        .eq('id', createdItem.category_id)
        .single();
      category = categoryData;
    }

    return {
      ...this.mapItem(createdItem),
      category: category ? this.mapCategory(category) : null,
      prices: createdPrices.map(this.mapItemPrice),
      packagings: createdPackagings.map(this.mapItemPackaging),
    };
  }

  /**
   * Replace all prices and/or packagings for an existing item.
   * Used by update flows where the client submits the full desired set of
   * prices/packagings rather than incremental add/update/delete operations.
   */
  async replaceRelations(
    tenantId: string,
    itemId: string,
    prices?: Omit<ItemPriceInsert, 'tenant_id' | 'id' | 'item_id'>[],
    packagings?: Omit<ItemPackagingInsert, 'tenant_id' | 'id' | 'item_id'>[]
  ): Promise<{ prices: ItemPriceRow[]; packagings: ItemPackagingRow[] }> {
    let resultPrices: ItemPriceRow[] = [];
    let resultPackagings: ItemPackagingRow[] = [];

    if (prices !== undefined) {
      const { error: deleteError } = await this.supabase
        .from('item_prices')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId);

      if (deleteError) {
        throw deleteError;
      }

      if (prices.length > 0) {
        const priceInserts = prices.map((price) => ({
          ...price,
          tenant_id: tenantId,
          item_id: itemId,
        }));

        const { data, error } = await this.supabase
          .from('item_prices')
          .insert(priceInserts)
          .select();

        if (error) {
          throw error;
        }

        resultPrices = data || [];
      }
    }

    if (packagings !== undefined) {
      const { error: deleteError } = await this.supabase
        .from('item_packagings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId);

      if (deleteError) {
        throw deleteError;
      }

      if (packagings.length > 0) {
        const packagingInserts = packagings.map((packaging) => ({
          ...packaging,
          tenant_id: tenantId,
          item_id: itemId,
        }));

        const { data, error } = await this.supabase
          .from('item_packagings')
          .insert(packagingInserts)
          .select();

        if (error) {
          throw error;
        }

        resultPackagings = data || [];
      }
    }

    return { prices: resultPrices, packagings: resultPackagings };
  }

  // ==========================================================================
  // ITEM PRICES
  // ==========================================================================

  /**
   * Get all prices for an item
   */
  async getPrices(tenantId: string, itemId: string): Promise<ItemPrice[]> {
    const { data, error } = await this.supabase
      .from('item_prices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .order('price_tier');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapItemPrice);
  }

  /**
   * Batch-fetch current effective prices for all items of a tenant in one query.
   * Returns a map of itemId → tier → price for the given currency.
   * Used by the items report to avoid N+1 queries.
   * We fetch by tenant (not IN (...ids)) to avoid PostgREST URL-length limits,
   * then narrow to the requested item set in memory.
   */
  async getCurrentPricesForItems(
    tenantId: string,
    itemIds: string[],
    currency: string = 'USD'
  ): Promise<Map<string, Record<string, number>>> {
    const result = new Map<string, Record<string, number>>();
    if (itemIds.length === 0) return result;

    const today = new Date().toISOString().split('T')[0];
    const idSet = new Set(itemIds);

    const { data, error } = await this.supabase
      .from('item_prices')
      .select('item_id, price_tier, price, effective_from, effective_to')
      .eq('tenant_id', tenantId)
      .eq('currency', currency)
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    if (error) throw error;

    // For each (item, tier), keep the latest effective_from (nulls treated as earliest).
    const best = new Map<string, { price: number; from: string | null }>();
    for (const row of data || []) {
      if (!idSet.has(row.item_id)) continue;
      const key = `${row.item_id}::${row.price_tier}`;
      const prev = best.get(key);
      const priceNum = typeof row.price === 'string' ? Number(row.price) : row.price;
      if (
        !prev ||
        (row.effective_from !== null &&
          (prev.from === null || row.effective_from > prev.from))
      ) {
        best.set(key, { price: priceNum, from: row.effective_from });
      }
    }

    for (const [key, { price }] of best) {
      const [itemId, tier] = key.split('::');
      const tiers = result.get(itemId) || {};
      tiers[tier] = price;
      result.set(itemId, tiers);
    }

    return result;
  }

  /**
   * Get current effective price for an item
   */
  async getCurrentPrice(
    tenantId: string,
    itemId: string,
    priceTier: string = 'retail',
    currency: string = 'USD'
  ): Promise<number | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('item_prices')
      .select('price')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .eq('price_tier', priceTier)
      .eq('currency', currency)
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('effective_from', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data?.price || null;
  }

  /**
   * Add a price to an item
   */
  async addPrice(
    tenantId: string,
    itemId: string,
    price: Omit<ItemPriceInsert, 'tenant_id' | 'id' | 'item_id'>
  ): Promise<ItemPrice> {
    const { data, error } = await this.supabase
      .from('item_prices')
      .insert({
        ...price,
        tenant_id: tenantId,
        item_id: itemId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapItemPrice(data);
  }

  /**
   * Update a price
   */
  async updatePrice(
    tenantId: string,
    priceId: string,
    update: Partial<ItemPriceInsert>
  ): Promise<ItemPrice | null> {
    const { data, error } = await this.supabase
      .from('item_prices')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', priceId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapItemPrice(data);
  }

  /**
   * Delete a price
   */
  async deletePrice(tenantId: string, priceId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('item_prices')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', priceId);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Bulk update prices for multiple items
   */
  async bulkUpdatePrices(
    tenantId: string,
    itemIds: string[],
    adjustmentType: 'percentage' | 'fixed',
    adjustmentValue: number,
    priceTier: string,
    currency: string
  ): Promise<BulkPriceUpdateResult> {
    const result: BulkPriceUpdateResult = {
      updatedCount: 0,
      updatedIds: [],
      errors: [],
    };

    for (const itemId of itemIds) {
      try {
        // Get current price
        const currentPrice = await this.getCurrentPrice(tenantId, itemId, priceTier, currency);

        if (currentPrice === null) {
          result.errors.push({
            itemId,
            error: `No ${priceTier} price found for item`,
          });
          continue;
        }

        // Calculate new price
        let newPrice: number;
        if (adjustmentType === 'percentage') {
          newPrice = currentPrice * (1 + adjustmentValue / 100);
        } else {
          newPrice = currentPrice + adjustmentValue;
        }

        // Ensure price is not negative
        newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

        // Update or create price record
        const today = new Date().toISOString().split('T')[0];

        // Find current price record
        const { data: priceRecord } = await this.supabase
          .from('item_prices')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('item_id', itemId)
          .eq('price_tier', priceTier)
          .eq('currency', currency)
          .or(`effective_from.is.null,effective_from.lte.${today}`)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .limit(1)
          .single();

        if (priceRecord) {
          await this.supabase
            .from('item_prices')
            .update({ price: newPrice })
            .eq('id', priceRecord.id);
        } else {
          await this.addPrice(tenantId, itemId, {
            price_tier: priceTier,
            price: newPrice,
            currency,
          });
        }

        result.updatedCount++;
        result.updatedIds.push(itemId);
      } catch (error) {
        result.errors.push({
          itemId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk update prices for all items in the tenant (optionally one category)
   * in a single atomic statement
   */
  async bulkAdjustAllPrices(
    tenantId: string,
    adjustmentType: 'percentage' | 'fixed',
    adjustmentValue: number,
    priceTier: string,
    currency: string,
    categoryId?: string
  ): Promise<BulkPriceUpdateAllResult> {
    const { data, error } = await this.supabase.rpc('bulk_adjust_item_prices' as never, {
      p_tenant_id: tenantId,
      p_adjustment_type: adjustmentType,
      p_adjustment_value: adjustmentValue,
      p_price_tier: priceTier,
      p_currency: currency,
      p_category_id: categoryId ?? null,
    } as never);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as unknown as Array<{ updated_count: number; skipped_count: number }>;
    const row = rows[0];
    return {
      updatedCount: Number(row?.updated_count ?? 0),
      skippedCount: Number(row?.skipped_count ?? 0),
    };
  }

  // ==========================================================================
  // ITEM PACKAGINGS
  // ==========================================================================

  /**
   * Get all packagings for an item
   */
  async getPackagings(tenantId: string, itemId: string): Promise<ItemPackaging[]> {
    const { data, error } = await this.supabase
      .from('item_packagings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .order('quantity');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapItemPackaging);
  }

  /**
   * Add a packaging to an item
   */
  async addPackaging(
    tenantId: string,
    itemId: string,
    packaging: Omit<ItemPackagingInsert, 'tenant_id' | 'id' | 'item_id'>
  ): Promise<ItemPackaging> {
    const { data, error } = await this.supabase
      .from('item_packagings')
      .insert({
        ...packaging,
        tenant_id: tenantId,
        item_id: itemId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapItemPackaging(data);
  }

  /**
   * Update a packaging
   */
  async updatePackaging(
    tenantId: string,
    packagingId: string,
    update: Partial<ItemPackagingInsert>
  ): Promise<ItemPackaging | null> {
    const { data, error } = await this.supabase
      .from('item_packagings')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', packagingId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapItemPackaging(data);
  }

  /**
   * Delete a packaging
   */
  async deletePackaging(tenantId: string, packagingId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('item_packagings')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', packagingId);

    if (error) {
      throw error;
    }

    return true;
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapItem(row: ItemRow): Item {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      nameAlias: row.name_alias,
      sku: row.sku,
      barcode: row.barcode,
      brand: row.brand,
      categoryId: row.category_id,
      unitOfMeasure: row.unit_of_measure,
      taxRate: Number(row.tax_rate),
      isActive: row.is_active,
      images: row.images || [],
      tracksExpiry: row.tracks_expiry,
      expiryDate: row.expiry_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCategory(row: Database['public']['Tables']['categories']['Row']): {
    id: string;
    tenantId: string;
    name: string;
    parentId: string | null;
    createdAt: string;
  } {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      parentId: row.parent_id,
      createdAt: row.created_at,
    };
  }

  private mapItemWithCategory = (
    row: ItemRow & {
      category: Database['public']['Tables']['categories']['Row'] | null;
      prices?: ItemPriceRow[] | null;
    },
  ): ItemWithCategory & { prices?: ItemPrice[] } => {
    return {
      ...this.mapItem(row),
      category: row.category ? this.mapCategory(row.category) : null,
      prices: (row.prices || []).map(this.mapItemPrice),
    };
  };

  private mapItemWithRelations = (row: ItemRow & {
    category: Database['public']['Tables']['categories']['Row'] | null;
    prices: ItemPriceRow[];
    packagings: ItemPackagingRow[];
  }): ItemWithRelations => {
    return {
      ...this.mapItem(row),
      category: row.category ? this.mapCategory(row.category) : null,
      prices: (row.prices || []).map(this.mapItemPrice),
      packagings: (row.packagings || []).map(this.mapItemPackaging),
    };
  };

  private mapItemPrice = (row: ItemPriceRow): ItemPrice => {
    return {
      id: row.id,
      itemId: row.item_id,
      tenantId: row.tenant_id,
      priceTier: row.price_tier,
      price: Number(row.price),
      currency: row.currency,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      createdAt: row.created_at,
    };
  };

  private mapItemPackaging = (row: ItemPackagingRow): ItemPackaging => {
    return {
      id: row.id,
      itemId: row.item_id,
      tenantId: row.tenant_id,
      name: row.name,
      quantity: row.quantity,
      barcode: row.barcode,
      createdAt: row.created_at,
    };
  };
}
