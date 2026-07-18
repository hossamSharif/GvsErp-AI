/**
 * Zod validation schemas for Warehouse entities
 * @module validation/warehouse
 */

import { z } from 'zod';
import { sortDirectionSchema, qsBool } from './items';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Transfer status validation
 */
export const transferStatusSchema = z.enum(['pending', 'in_transit', 'completed', 'canceled']);

// =============================================================================
// WAREHOUSE SCHEMAS
// =============================================================================

/**
 * Warehouse sort field validation
 */
export const warehouseSortFieldSchema = z.enum([
  'name',
  'createdAt',
  'updatedAt',
]).default('name');

/**
 * Schema for creating a warehouse
 */
export const createWarehouseSchema = z.object({
  name: z.string()
    .min(1, 'Warehouse name is required')
    .max(255, 'Warehouse name must be 255 characters or less')
    .trim(),
  address: z.string()
    .max(500, 'Address must be 500 characters or less')
    .trim()
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});

/**
 * Schema for updating a warehouse
 */
export const updateWarehouseSchema = z.object({
  name: z.string()
    .min(1, 'Warehouse name is required')
    .max(255, 'Warehouse name must be 255 characters or less')
    .trim()
    .optional(),
  address: z.string()
    .max(500, 'Address must be 500 characters or less')
    .trim()
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for warehouse query parameters
 */
export const warehouseQuerySchema = z.object({
  search: z.string().max(255).optional(),
  isActive: qsBool.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: warehouseSortFieldSchema,
  sortDir: sortDirectionSchema,
});

// =============================================================================
// INVENTORY SCHEMAS
// =============================================================================

/**
 * Inventory sort field validation
 */
export const inventorySortFieldSchema = z.enum([
  'itemName',
  'quantity',
  'updatedAt',
]).default('itemName');

/**
 * Schema for updating inventory threshold
 */
export const updateInventoryThresholdSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  lowStockThreshold: z.coerce.number()
    .min(0, 'Threshold cannot be negative')
    .nullable(),
});

/**
 * Schema for bulk updating inventory thresholds
 */
export const bulkUpdateInventoryThresholdSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  thresholds: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      lowStockThreshold: z.coerce.number()
        .min(0, 'Threshold cannot be negative')
        .nullable(),
    })
  ).min(1, 'At least one threshold is required')
   .max(500, 'Cannot update more than 500 thresholds at once'),
});

/**
 * Schema for inventory query parameters
 */
export const inventoryQuerySchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  itemId: z.string().uuid('Invalid item ID').optional(),
  search: z.string().max(255).optional(),
  lowStockOnly: qsBool.default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: inventorySortFieldSchema,
  sortDir: sortDirectionSchema,
});

// =============================================================================
// TRANSFER SCHEMAS
// =============================================================================

/**
 * Transfer sort field validation
 */
export const transferSortFieldSchema = z.enum([
  'transferNumber',
  'status',
  'createdAt',
  'completedAt',
]).default('createdAt');

/**
 * Schema for creating a transfer item
 */
export const createTransferItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  quantity: z.coerce.number()
    .positive('Quantity must be greater than 0')
    .multipleOf(0.001, 'Quantity can have at most 3 decimal places'),
});

/**
 * Schema for creating a transfer
 */
export const createTransferSchema = z.object({
  fromWarehouseId: z.string().uuid('Invalid source warehouse ID'),
  toWarehouseId: z.string().uuid('Invalid destination warehouse ID'),
  notes: z.string()
    .max(1000, 'Notes must be 1000 characters or less')
    .trim()
    .nullable()
    .optional(),
  items: z.array(createTransferItemSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Cannot transfer more than 100 items at once'),
}).refine(
  (data) => data.fromWarehouseId !== data.toWarehouseId,
  { message: 'Source and destination warehouses must be different' }
);

/**
 * Schema for updating a transfer (only pending transfers)
 */
export const updateTransferSchema = z.object({
  notes: z.string()
    .max(1000, 'Notes must be 1000 characters or less')
    .trim()
    .nullable()
    .optional(),
  items: z.array(createTransferItemSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Cannot transfer more than 100 items at once')
    .optional(),
});

/**
 * Schema for transfer query parameters
 */
export const transferQuerySchema = z.object({
  status: transferStatusSchema.optional(),
  fromWarehouseId: z.string().uuid('Invalid source warehouse ID').optional(),
  toWarehouseId: z.string().uuid('Invalid destination warehouse ID').optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: transferSortFieldSchema,
  sortDir: z.enum(['asc', 'desc']).default('desc'),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'Date from must be before or equal to date to' }
);

// =============================================================================
// INVENTORY REPORT SCHEMAS
// =============================================================================

/**
 * Schema for inventory report parameters
 */
export const inventoryReportParamsSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  lowStockOnly: qsBool.default(false),
  includeZeroQuantity: qsBool.default(false),
  currency: z.string()
    .min(3, 'Currency code must be 3 characters')
    .max(3, 'Currency code must be 3 characters')
    .toUpperCase()
    .default('USD'),
});

// =============================================================================
// LOW STOCK ALERT SCHEMAS
// =============================================================================

/**
 * Schema for low stock alert query parameters
 */
export const lowStockAlertQuerySchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  severity: z.enum(['critical', 'warning', 'low']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Duplicate type aliases removed — authoritative types live in types/warehouse.ts
// LowStockAlertQueryParams is unique to validation (no type equivalent)
export type LowStockAlertQueryParams = z.infer<typeof lowStockAlertQuerySchema>;

// =============================================================================
// OPENING STOCK SCHEMAS
// =============================================================================

export const openingStockItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  // Set/replace semantics: 0 is allowed (clears opening stock when nothing has
  // been sold from it). The service enforces the "not below already-sold" floor.
  quantity: z.coerce.number()
    .min(0, 'Quantity cannot be negative')
    .multipleOf(0.001, 'Quantity can have at most 3 decimal places'),
  unitCost: z.coerce.number()
    .min(0, 'Unit cost cannot be negative')
    .multipleOf(0.0001, 'Unit cost can have at most 4 decimal places'),
});

export const setOpeningStockSchema = z.object({
  asOfDate: z.string().date('Invalid date format'),
  items: z.array(openingStockItemSchema)
    .min(1, 'At least one item is required')
    .max(500, 'Cannot set opening stock for more than 500 items at once'),
});
