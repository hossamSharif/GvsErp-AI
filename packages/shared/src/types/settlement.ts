/**
 * Inventory Settlement Types
 *
 * A settlement is a stock-adjustment document: it records a physical count
 * against system on-hand for a warehouse and, on posting, corrects
 * `inventory.quantity`, maintains the FIFO valuation layers, and books the net
 * value change to the `inventory_adjustment` account.
 *
 * Lines carry an ABSOLUTE counted quantity, not a delta — `difference_quantity`
 * is derived at post time from the live on-hand under a row lock.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type SettlementStatus = 'draft' | 'posted' | 'canceled';

export type SettlementReason =
  | 'count_correction'
  | 'damage'
  | 'theft'
  | 'expiry'
  | 'other';

export type SettlementSortField =
  | 'settlementNumber'
  | 'settlementDate'
  | 'status'
  | 'createdAt';

// =============================================================================
// ENTITIES
// =============================================================================

export interface Settlement {
  id: string;
  tenantId: string;
  settlementNumber: string;
  warehouseId: string;
  settlementDate: string;
  status: SettlementStatus;
  reason: SettlementReason;
  notes: string | null;
  journalEntryId: string | null;
  totalIncreaseValue: number;
  totalDecreaseValue: number;
  /** Set when this document is the mirror that reverses another. */
  reversalOfId: string | null;
  createdBy: string | null;
  postedBy: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  tenantId: string;
  itemId: string;
  /** On-hand snapshot. Overwritten at post time with the live locked value. */
  systemQuantity: number;
  countedQuantity: number;
  /** Written at post time; null while the document is a draft. */
  differenceQuantity: number | null;
  valueDelta: number | null;
  /** Valuation for an increase; fallback cost when FIFO layers run short. */
  unitCost: number;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SettlementItemWithDetails extends SettlementItem {
  itemName: string;
  itemSku: string | null;
  itemBarcode: string | null;
  unitOfMeasure: string;
}

export interface SettlementWithDetails extends Settlement {
  warehouseName: string;
  items: SettlementItemWithDetails[];
  itemCount: number;
}

// =============================================================================
// COUNT SHEET
// =============================================================================

/** One row of the physical-count worksheet for a warehouse. */
export interface CountSheetRow {
  itemId: string;
  itemName: string;
  sku: string | null;
  barcode: string | null;
  unitOfMeasure: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Current `inventory.quantity`. */
  systemQuantity: number;
  /** Latest remaining FIFO layer cost, falling back to the `cost` price tier. */
  suggestedUnitCost: number;
}

export interface CountSheetParams {
  warehouseId: string;
  categoryId?: string;
  search?: string;
  /** Omit items whose on-hand is zero and which have no cost history. */
  onlyWithStock?: boolean;
  page?: number;
  limit?: number;
}

// =============================================================================
// INPUTS
// =============================================================================

export interface SettlementItemInput {
  itemId: string;
  countedQuantity: number;
  unitCost: number;
  notes?: string | null;
}

export interface CreateSettlementInput {
  warehouseId: string;
  settlementDate?: string;
  reason?: SettlementReason;
  notes?: string | null;
  items: SettlementItemInput[];
}

export interface UpdateSettlementInput {
  settlementDate?: string;
  reason?: SettlementReason;
  notes?: string | null;
  items?: SettlementItemInput[];
}

export interface SettlementQueryParams {
  status?: SettlementStatus;
  warehouseId?: string;
  reason?: SettlementReason;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: SettlementSortField;
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// RESULTS
// =============================================================================

export interface PostSettlementResult {
  settlement: SettlementWithDetails;
  linesApplied: number;
  increaseValue: number;
  decreaseValue: number;
  netValueDelta: number;
  journalEntryId: string | null;
  /** Set when stock moved but the JE could not be posted (unmapped accounts). */
  accountingWarning: string | null;
}

export interface ReverseSettlementResult {
  original: Settlement;
  reversal: SettlementWithDetails;
  journalEntryId: string | null;
}
