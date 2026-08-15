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
  tracksExpiry: boolean;
  expiryDate: string | null;
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
  tracksExpiry?: boolean;
  expiryDate?: string | null;
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
  tracksExpiry?: boolean;
  expiryDate?: string | null;
  prices?: CreateItemPriceInput[];
  packagings?: CreateItemPackagingInput[];
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
  /** Filter to items expiring within this many days */
  expiringWithinDays?: number;
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

// =============================================================================
// ITEM MOVEMENT REPORT TYPES
// =============================================================================

/**
 * Kind of movement affecting an item's stock.
 *
 * Returns are separate invoice rows sharing the parent's `type` and linked via
 * `returned_from_id`, so direction is decided by the pair (type, isReturn) —
 * a returned sale puts stock BACK IN.
 */
export type ItemMovementType =
  | 'opening'
  | 'purchase'
  | 'purchase_return'
  | 'sale'
  | 'sale_return'
  | 'transfer_in'
  | 'transfer_out'
  /** Posted stock settlement (physical-count correction), either direction. */
  | 'adjustment';

/**
 * A single row in the item movement ledger.
 *
 * `invoiceId` is null for opening-stock and transfer rows — those have no
 * invoice to navigate to, so the UI renders them as non-clickable.
 */
export interface ItemMovementRow {
  /** Stable key for React — invoice_items.id, transfer_items.id or layer id */
  id: string;
  movementType: ItemMovementType;
  /** Business date (invoices.invoice_date / transfers.completed_at / layer_date) */
  date: string;
  /** Set for invoice-backed rows only; drives row click-through */
  invoiceId: string | null;
  /** 'sale' | 'purchase' — which route to open. Null for non-invoice rows. */
  invoiceType: 'sale' | 'purchase' | null;
  invoiceNumber: string | null;
  partyId: string | null;
  partyName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  /** Quantity added to stock (0 for outgoing rows) */
  quantityIn: number;
  /** Quantity removed from stock (0 for incoming rows) */
  quantityOut: number;
  /** Running on-hand balance after this row is applied */
  runningBalance: number;
  /** Null for transfers (no price) and for opening rows without a cost */
  unitPrice: number | null;
  discountPercent: number | null;
  /** Line value net of discount, excluding tax. Null when not priced. */
  lineNet: number | null;
  currency: string | null;
  notes: string | null;
}

/**
 * Headline metrics for the item movement report.
 */
export interface ItemMovementKpis {
  // --- Stock ---
  /** Gross purchased quantity, before purchase returns */
  purchasedQty: number;
  purchaseReturnedQty: number;
  /** Gross sold quantity, before sales returns */
  soldQty: number;
  salesReturnedQty: number;
  /** Sum of all incoming quantity in the period (incl. opening entries, transfers in) */
  totalIn: number;
  /** Sum of all outgoing quantity in the period */
  totalOut: number;

  // --- Money ---
  /** Sales value net of line discount, excluding tax, minus sales returns */
  revenue: number;
  /** Purchase spend net of line discount, excluding tax, minus purchase returns */
  purchaseCost: number;
  /** Exact FIFO COGS when available, otherwise estimated — see cogsIsEstimated */
  cogs: number;
  /**
   * True when COGS was derived from the weighted-average purchase cost rather
   * than `invoice_items.cogs_amount` (tenant has cogs_enabled off, or the rows
   * predate COGS tracking). The UI badges the profit KPIs accordingly.
   */
  cogsIsEstimated: boolean;
  grossProfit: number;
  /** Gross profit as a percentage of revenue; null when revenue is 0 */
  marginPercent: number | null;

  // --- Prices ---
  /** Quantity-weighted average selling price; null when nothing was sold */
  avgSellPrice: number | null;
  /** Quantity-weighted average purchase cost; null when nothing was bought */
  avgPurchaseCost: number | null;
  minSellPrice: number | null;
  maxSellPrice: number | null;

  // --- Activity ---
  salesInvoiceCount: number;
  purchaseInvoiceCount: number;
  distinctCustomers: number;
  distinctSuppliers: number;
  lastSoldAt: string | null;
  lastPurchasedAt: string | null;

  // --- Derived insight ---
  /** Current qty ÷ average daily sold qty; null when nothing sold */
  daysOfStock: number | null;
  /** Qty sold ÷ average stock over the period; null when average stock is 0 */
  turnover: number | null;
}

/**
 * Full item movement report payload.
 */
export interface ItemMovementReport {
  item: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    brand: string | null;
    categoryName: string | null;
    unitOfMeasure: string;
    isActive: boolean;
  };
  /** Null when the report covers all warehouses */
  warehouseId: string | null;
  warehouseName: string | null;
  dateFrom: string;
  dateTo: string;
  opening: {
    /**
     * On-hand quantity at the start of the period, derived backwards as
     * `onHand − totalIn + totalOut` so the ledger always reconciles.
     */
    quantity: number;
  };
  closing: {
    /** Opening + totalIn − totalOut, i.e. what the ledger says */
    quantity: number;
    /** What `inventory.quantity` actually says right now */
    onHandQuantity: number;
    /** False when the two disagree, signalling data drift */
    reconciles: boolean;
    /** Current stock value from remaining FIFO layers */
    stockValue: number;
  };
  movements: ItemMovementRow[];
  kpis: ItemMovementKpis;
  generatedAt: string;
}

/**
 * Query parameters for the item movement report.
 */
export interface ItemMovementParams {
  /** Inclusive start date (YYYY-MM-DD) */
  dateFrom: string;
  /** Inclusive end date (YYYY-MM-DD) */
  dateTo: string;
  /** Scope to one warehouse; transfers only appear when this is set */
  warehouseId?: string;
}

// =============================================================================
// ITEM GRID (BULK-EDIT) TYPES
// =============================================================================

/**
 * One row of the items bulk-edit grid: item main info + the effective retail and
 * cost prices + the opening-stock position in the selected warehouse, merged by
 * the `get_item_grid` RPC so the page needs a single round-trip per page.
 *
 * Price ids are null when the item has no price row of that tier yet — the save
 * endpoint uses that to decide between INSERT and UPDATE.
 */
export interface ItemGridRow {
  itemId: string;
  name: string;
  nameAlias: string | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitOfMeasure: string;
  tracksExpiry: boolean;
  expiryDate: string | null;
  isActive: boolean;

  retailPriceId: string | null;
  retailPrice: number | null;
  retailCurrency: string | null;
  costPriceId: string | null;
  costPrice: number | null;
  costCurrency: string | null;

  /** On-hand quantity in the selected warehouse (0 when no warehouse selected) */
  currentQuantity: number;
  hasOpeningEntry: boolean;
  openingQuantity: number;
  openingRemaining: number;
  /** Units of the opening layer already consumed — the floor for any qty edit */
  openingSoldQuantity: number;
  openingUnitCost: number;
}

/**
 * Query parameters for GET /items/grid.
 *
 * The `missing*` flags are the "advanced filters": they surface catalogue gaps
 * (no barcode, no or zero price, no opening quantity/cost) and are ANDed.
 */
export interface ItemGridQueryParams {
  /** Scopes the opening-stock columns; required for the opening-* filters */
  warehouseId?: string;
  search?: string;
  categoryId?: string;
  /** Barcode is null or blank */
  missingBarcode?: boolean;
  /** No retail price row, or the price is 0 */
  missingRetail?: boolean;
  /** No cost price row, or the price is 0 */
  missingCost?: boolean;
  /** Opening quantity is 0 in this warehouse */
  zeroOpeningQty?: boolean;
  /** No opening layer, or its unit cost is 0 */
  missingOpeningCost?: boolean;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'sku' | 'barcode';
  sortDir?: SortDirection;
}

/**
 * Which part of a grid row a result refers to. One row save touches up to four
 * independent subsystems, and the UI reports each one separately.
 */
export type ItemGridSection = 'item' | 'retailPrice' | 'costPrice' | 'opening';

/**
 * Outcome of one section of a row save.
 *
 * `skipped` means the section had nothing to write (the caller did not send it).
 * A `failed` section never prevents the others from being attempted.
 */
export interface ItemGridSectionResult {
  section: ItemGridSection;
  status: 'ok' | 'skipped' | 'failed';
  /** Machine-readable reason on failure, e.g. DUPLICATE_BARCODE, OPENING_BELOW_SOLD */
  code?: string;
  /** Human-readable detail for both success ("created in SDG") and failure */
  message?: string;
}

/**
 * Body of POST /items/:id/grid-row — only the sections the user actually changed.
 */
export interface SaveItemGridRowInput {
  item?: {
    name?: string;
    nameAlias?: string | null;
    barcode?: string | null;
    /** Setting a date turns tracks_expiry on; null turns it off */
    expiryDate?: string | null;
  };
  /** Creates the 'retail' price row in the tenant default currency when absent */
  retailPrice?: number;
  /** Creates the 'cost' price row in the tenant default currency when absent */
  costPrice?: number;
  opening?: {
    warehouseId: string;
    quantity: number;
    unitCost: number;
    asOfDate: string;
  };
}

/**
 * Response of POST /items/:id/grid-row.
 *
 * Always HTTP 200 — partial success is normal here, so the per-section results
 * carry the outcome and `row` carries the refreshed values for cache patching.
 */
export interface SaveItemGridRowResult {
  ok: boolean;
  sections: ItemGridSectionResult[];
  row: ItemGridRow | null;
}

// =============================================================================
// EXPIRY TYPES
// =============================================================================

/**
 * Expiry alert severity bucket
 */
export type ExpirySeverity = 'expired' | 'critical' | 'warning';

/**
 * A single item expiring within the requested threshold
 */
export interface ExpiringItemAlert {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: ExpirySeverity;
}

/**
 * Summary counts for the expiry dashboard widget
 */
export interface ExpirySummary {
  totalAlerts: number;
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
}

/**
 * Parameters for the expiry report/alerts endpoints
 */
export interface ExpiryReportParams {
  /** Days threshold (default: 30) */
  daysThreshold?: number;
  /** Filter to a specific severity bucket */
  severity?: ExpirySeverity;
}
