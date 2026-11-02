/**
 * Item Service
 *
 * Business logic for item management including validation, pricing, and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ItemRepository } from '../repositories/item.repository';
import { CategoryRepository } from '../repositories/category.repository';
import type {
  Item,
  ItemWithCategory,
  ItemWithRelations,
  ItemPrice,
  ItemPackaging,
  ItemQueryParams,
  CreateItemInput,
  UpdateItemInput,
  CreateItemPriceInput,
  UpdateItemPriceInput,
  CreateItemPackagingInput,
  UpdateItemPackagingInput,
  BulkPriceUpdateInput,
  BulkPriceUpdateResult,
  BulkPriceUpdateAllInput,
  BulkPriceUpdateAllResult,
  ItemReportEntry,
  ItemReportParams,
} from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for item-related operations
 */
export class ItemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ItemError';
  }
}

/**
 * Service for Item business logic
 */
export class ItemService {
  private readonly itemRepository: ItemRepository;
  private readonly categoryRepository: CategoryRepository;
  private readonly tenantId: string;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ) {
    this.itemRepository = new ItemRepository(supabase);
    this.categoryRepository = new CategoryRepository(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // ITEM CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of items with filters
   */
  async getItems(params: ItemQueryParams): Promise<QueryResult<ItemWithCategory>> {
    return this.itemRepository.findAllWithFilters({
      tenantId: this.tenantId,
      page: params.page,
      limit: params.limit,
      sort_by: this.mapSortField(params.sortBy),
      sort_order: params.sortDir,
      search: params.search,
      categoryId: params.categoryId,
      includeInactive: params.isActive === false ? true : !params.isActive,
      expiringWithinDays: params.expiringWithinDays,
    });
  }

  /**
   * Get a single item by ID
   */
  async getItem(id: string): Promise<ItemWithRelations> {
    const item = await this.itemRepository.findByIdWithRelations(this.tenantId, id);

    if (!item) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    return item;
  }

  /**
   * Get item by SKU
   */
  async getItemBySku(sku: string): Promise<Item | null> {
    const item = await this.itemRepository.findBySku(this.tenantId, sku);
    if (!item) return null;

    return {
      id: item.id,
      tenantId: item.tenant_id,
      name: item.name,
      nameAlias: item.name_alias,
      sku: item.sku,
      barcode: item.barcode,
      brand: item.brand,
      categoryId: item.category_id,
      unitOfMeasure: item.unit_of_measure,
      taxRate: Number(item.tax_rate),
      isActive: item.is_active,
      images: item.images || [],
      tracksExpiry: item.tracks_expiry,
      expiryDate: item.expiry_date,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  /**
   * Get item by barcode
   */
  async getItemByBarcode(barcode: string): Promise<Item | null> {
    const item = await this.itemRepository.findByBarcode(this.tenantId, barcode);
    if (!item) return null;

    return {
      id: item.id,
      tenantId: item.tenant_id,
      name: item.name,
      nameAlias: item.name_alias,
      sku: item.sku,
      barcode: item.barcode,
      brand: item.brand,
      categoryId: item.category_id,
      unitOfMeasure: item.unit_of_measure,
      taxRate: Number(item.tax_rate),
      isActive: item.is_active,
      images: item.images || [],
      tracksExpiry: item.tracks_expiry,
      expiryDate: item.expiry_date,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  /**
   * Create a new item
   */
  async createItem(input: CreateItemInput): Promise<ItemWithRelations> {
    // Validate unique constraints
    await this.validateUniqueConstraints(input);

    // Validate category exists if provided
    if (input.categoryId) {
      const categoryExists = await this.categoryRepository.exists(this.tenantId, input.categoryId);
      if (!categoryExists) {
        throw new ItemError('Category not found', 'CATEGORY_NOT_FOUND', 400);
      }
    }

    // Map input to database format
    const itemData = {
      name: input.name,
      name_alias: input.nameAlias || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      brand: input.brand || null,
      category_id: input.categoryId || null,
      unit_of_measure: input.unitOfMeasure || 'piece',
      tax_rate: input.taxRate || 0,
      is_active: input.isActive ?? true,
      images: input.images || [],
      tracks_expiry: input.tracksExpiry ?? false,
      expiry_date: input.tracksExpiry ? input.expiryDate || null : null,
    };

    // Map prices if provided
    const prices = input.prices?.map((p) => ({
      price_tier: p.priceTier,
      price: p.price,
      currency: p.currency || 'USD',
      effective_from: p.effectiveFrom || null,
      effective_to: p.effectiveTo || null,
    }));

    // Map packagings if provided
    const packagings = input.packagings?.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      barcode: p.barcode || null,
    }));

    return this.itemRepository.createWithRelations(
      this.tenantId,
      itemData,
      prices,
      packagings
    );
  }

  /**
   * Update an existing item
   */
  async updateItem(id: string, input: UpdateItemInput): Promise<ItemWithRelations> {
    // Check item exists
    const existing = await this.itemRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    // Validate unique constraints (excluding current item)
    await this.validateUniqueConstraints(input, id);

    // Validate category exists if provided
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const categoryExists = await this.categoryRepository.exists(this.tenantId, input.categoryId);
      if (!categoryExists) {
        throw new ItemError('Category not found', 'CATEGORY_NOT_FOUND', 400);
      }
    }

    // Map input to database format
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.nameAlias !== undefined) updateData.name_alias = input.nameAlias;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;
    if (input.brand !== undefined) updateData.brand = input.brand;
    if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
    if (input.unitOfMeasure !== undefined) updateData.unit_of_measure = input.unitOfMeasure;
    if (input.taxRate !== undefined) updateData.tax_rate = input.taxRate;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.tracksExpiry !== undefined) {
      updateData.tracks_expiry = input.tracksExpiry;
      updateData.expiry_date = input.tracksExpiry ? (input.expiryDate ?? existing.expiry_date ?? null) : null;
    } else if (input.expiryDate !== undefined) {
      updateData.expiry_date = input.expiryDate;
    }

    await this.itemRepository.update(this.tenantId, id, updateData);

    // Replace prices/packagings if provided (client submits the full desired set)
    if (input.prices !== undefined || input.packagings !== undefined) {
      const prices = input.prices?.map((p) => ({
        price_tier: p.priceTier,
        price: p.price,
        currency: p.currency || 'USD',
        effective_from: p.effectiveFrom || null,
        effective_to: p.effectiveTo || null,
      }));

      const packagings = input.packagings?.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        barcode: p.barcode || null,
      }));

      await this.itemRepository.replaceRelations(this.tenantId, id, prices, packagings);
    }

    // Return updated item with relations
    const updated = await this.itemRepository.findByIdWithRelations(this.tenantId, id);
    if (!updated) {
      throw new ItemError('Failed to retrieve updated item', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Soft delete an item
   */
  async deleteItem(id: string): Promise<void> {
    const existing = await this.itemRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    await this.itemRepository.delete(this.tenantId, id, true);
  }

  /**
   * Hard delete an item
   */
  async hardDeleteItem(id: string): Promise<void> {
    const existing = await this.itemRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    await this.itemRepository.delete(this.tenantId, id, false);
  }

  // ==========================================================================
  // PRICE OPERATIONS
  // ==========================================================================

  /**
   * Get all prices for an item
   */
  async getItemPrices(itemId: string): Promise<ItemPrice[]> {
    const item = await this.itemRepository.findById(this.tenantId, itemId);
    if (!item) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    return this.itemRepository.getPrices(this.tenantId, itemId);
  }

  /**
   * Get current effective price for an item
   */
  async getCurrentPrice(
    itemId: string,
    priceTier: string = 'retail',
    currency: string = 'USD'
  ): Promise<number | null> {
    return this.itemRepository.getCurrentPrice(this.tenantId, itemId, priceTier, currency);
  }

  /**
   * Add a price to an item
   */
  async addItemPrice(itemId: string, input: CreateItemPriceInput): Promise<ItemPrice> {
    const item = await this.itemRepository.findById(this.tenantId, itemId);
    if (!item) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    return this.itemRepository.addPrice(this.tenantId, itemId, {
      price_tier: input.priceTier,
      price: input.price,
      currency: input.currency || 'USD',
      effective_from: input.effectiveFrom || null,
      effective_to: input.effectiveTo || null,
    });
  }

  /**
   * Update an item price
   */
  async updateItemPrice(priceId: string, input: UpdateItemPriceInput): Promise<ItemPrice> {
    const updateData: Record<string, unknown> = {};
    if (input.priceTier !== undefined) updateData.price_tier = input.priceTier;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.effectiveFrom !== undefined) updateData.effective_from = input.effectiveFrom;
    if (input.effectiveTo !== undefined) updateData.effective_to = input.effectiveTo;

    const updated = await this.itemRepository.updatePrice(this.tenantId, priceId, updateData);
    if (!updated) {
      throw new ItemError('Price not found', 'PRICE_NOT_FOUND', 404);
    }

    return updated;
  }

  /**
   * Delete an item price
   */
  async deleteItemPrice(priceId: string): Promise<void> {
    await this.itemRepository.deletePrice(this.tenantId, priceId);
  }

  /**
   * Bulk update prices for multiple items
   */
  async bulkUpdatePrices(input: BulkPriceUpdateInput): Promise<BulkPriceUpdateResult> {
    return this.itemRepository.bulkUpdatePrices(
      this.tenantId,
      input.itemIds,
      input.adjustmentType,
      input.adjustmentValue,
      input.priceTier,
      input.currency || 'USD'
    );
  }

  /**
   * Bulk update prices for all items (optionally one category)
   */
  async bulkUpdateAllPrices(input: BulkPriceUpdateAllInput): Promise<BulkPriceUpdateAllResult> {
    return this.itemRepository.bulkAdjustAllPrices(
      this.tenantId,
      input.adjustmentType,
      input.adjustmentValue,
      input.priceTier,
      input.currency || 'USD',
      input.categoryId
    );
  }

  // ==========================================================================
  // PACKAGING OPERATIONS
  // ==========================================================================

  /**
   * Get all packagings for an item
   */
  async getItemPackagings(itemId: string): Promise<ItemPackaging[]> {
    const item = await this.itemRepository.findById(this.tenantId, itemId);
    if (!item) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    return this.itemRepository.getPackagings(this.tenantId, itemId);
  }

  /**
   * Add a packaging to an item
   */
  async addItemPackaging(itemId: string, input: CreateItemPackagingInput): Promise<ItemPackaging> {
    const item = await this.itemRepository.findById(this.tenantId, itemId);
    if (!item) {
      throw new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    }

    return this.itemRepository.addPackaging(this.tenantId, itemId, {
      name: input.name,
      quantity: input.quantity,
      barcode: input.barcode || null,
    });
  }

  /**
   * Update an item packaging
   */
  async updateItemPackaging(packagingId: string, input: UpdateItemPackagingInput): Promise<ItemPackaging> {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;

    const updated = await this.itemRepository.updatePackaging(this.tenantId, packagingId, updateData);
    if (!updated) {
      throw new ItemError('Packaging not found', 'PACKAGING_NOT_FOUND', 404);
    }

    return updated;
  }

  /**
   * Delete an item packaging
   */
  async deleteItemPackaging(packagingId: string): Promise<void> {
    await this.itemRepository.deletePackaging(this.tenantId, packagingId);
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get items for report generation
   */
  async getItemsForReport(params: ItemReportParams): Promise<ItemReportEntry[]> {
    const queryResult = await this.itemRepository.findAllWithFilters({
      tenantId: this.tenantId,
      page: 1,
      limit: 10000, // Max items for report
      sort_by: 'name',
      sort_order: 'asc',
      categoryId: params.categoryId,
      // When isActive is explicitly set, narrow to exactly that value.
      // Otherwise include everything (active + inactive).
      isActive: typeof params.isActive === 'boolean' ? params.isActive : undefined,
      includeInactive: true,
    });

    // Batch-fetch current prices to avoid N+1 — one query instead of items × tiers.
    let priceMap = new Map<string, Record<string, number>>();
    if (params.includePrices !== false && queryResult.data.length > 0) {
      const currency = params.currency || 'USD';
      priceMap = await this.itemRepository.getCurrentPricesForItems(
        this.tenantId,
        queryResult.data.map((i) => i.id),
        currency
      );
    }

    return queryResult.data.map((item) => {
      const tiers = priceMap.get(item.id) || {};
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        brand: item.brand,
        category: item.category?.name || null,
        unitOfMeasure: item.unitOfMeasure,
        retailPrice: tiers.retail ?? null,
        wholesalePrice: tiers.wholesale ?? null,
        costPrice: tiers.cost ?? null,
        isActive: item.isActive,
      };
    });
  }

  // ==========================================================================
  // EXPIRY
  // ==========================================================================

  /**
   * Get active items expiring within N days (default 30)
   */
  async getExpiringItems(daysThreshold: number = 30) {
    return this.itemRepository.getExpiringItems(this.tenantId, daysThreshold);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Validate unique constraints for SKU and barcode
   */
  private async validateUniqueConstraints(
    input: CreateItemInput | UpdateItemInput,
    excludeId?: string
  ): Promise<void> {
    // Check SKU uniqueness
    if (input.sku) {
      const existing = await this.itemRepository.findBySku(this.tenantId, input.sku);
      if (existing && existing.id !== excludeId) {
        throw new ItemError('An item with this SKU already exists', 'DUPLICATE_SKU', 409);
      }
    }

    // Check barcode uniqueness
    if (input.barcode) {
      const existing = await this.itemRepository.findByBarcode(this.tenantId, input.barcode);
      if (existing && existing.id !== excludeId) {
        throw new ItemError('An item with this barcode already exists', 'DUPLICATE_BARCODE', 409);
      }
    }
  }

  /**
   * Map frontend sort field to database column
   */
  private mapSortField(sortBy?: string): string {
    const fieldMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      barcode: 'barcode',
      brand: 'brand',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    return fieldMap[sortBy || 'name'] || 'name';
  }
}
