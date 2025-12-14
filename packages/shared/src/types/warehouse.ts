/**
 * Warehouse entity types for the ERP system
 * @module types/warehouse
 */

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Transfer status enum
 */
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'canceled';

// =============================================================================
// WAREHOUSE ENTITY
// =============================================================================

/**
 * Core Warehouse entity
 */
export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Warehouse with inventory summary
 */
export interface WarehouseWithSummary extends Warehouse {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
}

/**
 * Input for creating a new warehouse
 */
export interface CreateWarehouseInput {
  name: string;
  address?: string | null;
  isActive?: boolean;
}

/**
 * Input for updating a warehouse
 */
export interface UpdateWarehouseInput {
  name?: string;
  address?: string | null;
  isActive?: boolean;
}

/**
 * Query parameters for fetching warehouses
 */
export interface WarehouseQueryParams {
  /** Search term for name or address */
  search?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// INVENTORY ENTITY
// =============================================================================

/**
 * Core Inventory entity - stock levels per item per warehouse
 */
export interface Inventory {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number | null;
  updatedAt: string;
}

/**
 * Inventory with item and warehouse details
 */
export interface InventoryWithDetails extends Inventory {
  item: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unitOfMeasure: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
  isLowStock: boolean;
  availableQuantity: number;
}

/**
 * Inventory entry for a specific warehouse
 */
export interface WarehouseInventoryEntry {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  itemBarcode: string | null;
  unitOfMeasure: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  estimatedValue: number;
}

/**
 * Input for updating inventory threshold
 */
export interface UpdateInventoryThresholdInput {
  itemId: string;
  warehouseId: string;
  lowStockThreshold: number | null;
}

/**
 * Input for bulk updating inventory thresholds
 */
export interface BulkUpdateInventoryThresholdInput {
  warehouseId: string;
  thresholds: Array<{
    itemId: string;
    lowStockThreshold: number | null;
  }>;
}

/**
 * Query parameters for fetching inventory
 */
export interface InventoryQueryParams {
  /** Filter by warehouse ID */
  warehouseId?: string;
  /** Filter by item ID */
  itemId?: string;
  /** Search term for item name, SKU, barcode */
  search?: string;
  /** Filter to only show low stock items */
  lowStockOnly?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: 'itemName' | 'quantity' | 'updatedAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// TRANSFER ENTITY
// =============================================================================

/**
 * Core Transfer entity
 */
export interface Transfer {
  id: string;
  tenantId: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: TransferStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * Transfer with warehouse and item details
 */
export interface TransferWithDetails extends Transfer {
  fromWarehouse: {
    id: string;
    name: string;
  };
  toWarehouse: {
    id: string;
    name: string;
  };
  items: TransferItemWithDetails[];
  totalItems: number;
  totalQuantity: number;
}

/**
 * Input for creating a new transfer
 */
export interface CreateTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string | null;
  items: CreateTransferItemInput[];
}

/**
 * Input for updating a transfer (only pending transfers)
 */
export interface UpdateTransferInput {
  notes?: string | null;
  items?: CreateTransferItemInput[];
}

/**
 * Query parameters for fetching transfers
 */
export interface TransferQueryParams {
  /** Filter by status */
  status?: TransferStatus;
  /** Filter by source warehouse */
  fromWarehouseId?: string;
  /** Filter by destination warehouse */
  toWarehouseId?: string;
  /** Search term for transfer number */
  search?: string;
  /** Filter by date range start */
  dateFrom?: string;
  /** Filter by date range end */
  dateTo?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: 'transferNumber' | 'status' | 'createdAt' | 'completedAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}

// =============================================================================
// TRANSFER ITEM ENTITY
// =============================================================================

/**
 * Core TransferItem entity
 */
export interface TransferItem {
  id: string;
  transferId: string;
  tenantId: string;
  itemId: string;
  quantity: number;
  createdAt: string;
}

/**
 * TransferItem with item details
 */
export interface TransferItemWithDetails extends TransferItem {
  item: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unitOfMeasure: string;
  };
  sourceAvailable: number;
}

/**
 * Input for creating a transfer item
 */
export interface CreateTransferItemInput {
  itemId: string;
  quantity: number;
}

// =============================================================================
// LOW STOCK ALERT TYPES
// =============================================================================

/**
 * Low stock alert entry
 */
export interface LowStockAlert {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  lowStockThreshold: number;
  deficit: number;
  percentOfThreshold: number;
}

/**
 * Low stock alert configuration
 */
export interface LowStockAlertConfig {
  warehouseId: string;
  emailNotifications: boolean;
  notificationEmails: string[];
  checkInterval: number; // in hours
}

/**
 * Low stock summary for dashboard
 */
export interface LowStockSummary {
  totalAlerts: number;
  criticalCount: number; // < 25% of threshold
  warningCount: number; // < 50% of threshold
  lowCount: number; // <= threshold
  byWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    alertCount: number;
  }>;
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Inventory report entry
 */
export interface InventoryReportEntry {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  itemBarcode: string | null;
  category: string | null;
  unitOfMeasure: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  unitCost: number | null;
  totalValue: number | null;
}

/**
 * Inventory report summary
 */
export interface InventoryReportSummary {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  byWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
  }>;
  byCategory: Array<{
    categoryId: string | null;
    categoryName: string | null;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
  }>;
}

/**
 * Parameters for generating inventory report
 */
export interface InventoryReportParams {
  /** Filter by warehouse */
  warehouseId?: string;
  /** Filter by category */
  categoryId?: string;
  /** Filter to only show low stock items */
  lowStockOnly?: boolean;
  /** Include items with zero quantity */
  includeZeroQuantity?: boolean;
  /** Currency for value calculations */
  currency?: string;
}

/**
 * Transfer history report entry
 */
export interface TransferHistoryEntry {
  transferId: string;
  transferNumber: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  status: TransferStatus;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  completedAt: string | null;
  createdByName: string | null;
}

// =============================================================================
// STOCK MOVEMENT TYPES
// =============================================================================

/**
 * Stock movement record for audit trail
 */
export interface StockMovement {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  movementType: 'sale' | 'purchase' | 'transfer_out' | 'transfer_in' | 'adjustment';
  quantity: number;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}
