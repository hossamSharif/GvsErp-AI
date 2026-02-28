/**
 * Item entity types for the ERP system
 * @module types/items
 */

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Common units of measure for items
 */
export type UnitOfMeasure =
  | 'piece'
  | 'kg'
  | 'gram'
  | 'liter'
  | 'ml'
  | 'meter'
  | 'cm'
  | 'box'
  | 'carton'
  | 'pack'
  | 'dozen';

/**
 * Price tier levels
 */
export type PriceTier = 'retail' | 'wholesale' | 'vip' | 'cost';

// =============================================================================
// CATEGORY ENTITY
// =============================================================================

/**
 * Category entity for organizing items
 */
export interface Category {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

/**
 * Category with nested children for tree display
 */
export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

/**
 * Input for creating a new category
 */
export interface CreateCategoryInput {
  name: string;
  parentId?: string | null;
}

/**
 * Input for updating a category
 */
export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
}

// =============================================================================
// ITEM ENTITY
// =============================================================================

/**
 * Core Item entity
 */
export interface Item {
  id: string;
  tenantId: string;
  name: string;
  nameAlias: string | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  categoryId: string | null;
  unitOfMeasure: string;
  taxRate: number;
  isActive: boolean;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Item with related category
 */
export interface ItemWithCategory extends Item {
  category: Category | null;
  prices?: ItemPrice[];
}

/**
 * Item with all related data (category, prices, packagings)
 */
export interface ItemWithRelations extends ItemWithCategory {
  prices: ItemPrice[];
  packagings: ItemPackaging[];
}

/**
 * Item list response with pagination
 */
export interface ItemListResponse {
  items: ItemWithCategory[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Input for creating a new item
 */
export interface CreateItemInput {
  name: string;
  nameAlias?: string | null;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  unitOfMeasure?: string;
  taxRate?: number;
  isActive?: boolean;
  images?: string[];
  prices?: CreateItemPriceInput[];
  packagings?: CreateItemPackagingInput[];
}

/**
 * Input for updating an item
 */
export interface UpdateItemInput {
  name?: string;
  nameAlias?: string | null;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  categoryId?: string | null;
  unitOfMeasure?: string;
  taxRate?: number;
  isActive?: boolean;
  images?: string[];
}

// =============================================================================
// ITEM PRICE ENTITY
// =============================================================================

/**
 * Item price entity for multi-tier pricing
 */
export interface ItemPrice {
  id: string;
  itemId: string;
  tenantId: string;
  priceTier: string;
  price: number;
  currency: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
}

/**
 * Input for creating an item price
 */
export interface CreateItemPriceInput {
  priceTier: string;
  price: number;
  currency?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

/**
 * Input for updating an item price
 */
export interface UpdateItemPriceInput {
  priceTier?: string;
  price?: number;
  currency?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

// =============================================================================
// ITEM PACKAGING ENTITY
// =============================================================================

/**
 * Item packaging entity for multi-unit packaging
 */
export interface ItemPackaging {
  id: string;
  itemId: string;
  tenantId: string;
  name: string;
  quantity: number;
  barcode: string | null;
  createdAt: string;
}

/**
 * Input for creating an item packaging
 */
export interface CreateItemPackagingInput {
  name: string;
  quantity: number;
  barcode?: string | null;
}

/**
 * Input for updating an item packaging
 */
export interface UpdateItemPackagingInput {
  name?: string;
  quantity?: number;
  barcode?: string | null;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Sort options for item list
 */
export type ItemSortField = 'name' | 'sku' | 'barcode' | 'brand' | 'createdAt' | 'updatedAt';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Query parameters for fetching items
 */
export interface ItemQueryParams {
  /** Search term for name, alias, SKU, barcode, brand */
  search?: string;
  /** Filter by category ID */
  categoryId?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: ItemSortField;
  /** Sort direction */
  sortDir?: SortDirection;
}

/**
 * Query parameters for fetching categories
 */
export interface CategoryQueryParams {
  /** Filter by parent ID (null for root categories) */
  parentId?: string | null;
  /** Include all descendants in tree structure */
  includeTree?: boolean;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Bulk price update input
 */
export interface BulkPriceUpdateInput {
  /** Item IDs to update */
  itemIds: string[];
  /** Price adjustment type */
  adjustmentType: 'percentage' | 'fixed';
  /** Adjustment value (percentage or fixed amount) */
  adjustmentValue: number;
  /** Price tier to update */
  priceTier: string;
  /** Optional: currency to update (default: USD) */
  currency?: string;
}

/**
 * Bulk price update result
 */
export interface BulkPriceUpdateResult {
  /** Number of items updated */
  updatedCount: number;
  /** IDs of items that were updated */
  updatedIds: string[];
  /** Errors for items that failed to update */
  errors: Array<{
    itemId: string;
    error: string;
  }>;
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Item report entry with aggregated data
 */
export interface ItemReportEntry {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  unitOfMeasure: string;
  retailPrice: number | null;
  wholesalePrice: number | null;
  costPrice: number | null;
  isActive: boolean;
}

/**
 * Parameters for generating item report
 */
export interface ItemReportParams {
  /** Filter by category */
  categoryId?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Include prices in report */
  includePrices?: boolean;
  /** Price tier to include (default: retail) */
  priceTier?: string;
  /** Currency for prices (default: USD) */
  currency?: string;
}
