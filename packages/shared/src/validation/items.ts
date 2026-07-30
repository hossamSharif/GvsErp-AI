/**
 * Zod validation schemas for Item entities
 * @module validation/items
 */

import { z } from 'zod';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Parse a querystring value as a boolean. z.coerce.boolean() uses JS Boolean(),
 * which treats the string "false" as truthy — use this helper instead.
 */
export const qsBool = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (v === undefined) return undefined;
    return v === 'true' || v === '1';
  });

/**
 * Unit of measure validation
 */
export const unitOfMeasureSchema = z.enum([
  'piece',
  'kg',
  'gram',
  'liter',
  'ml',
  'meter',
  'cm',
  'box',
  'carton',
  'pack',
  'dozen',
]).default('piece');

/**
 * Price tier validation
 */
export const priceTierSchema = z.enum(['retail', 'wholesale', 'vip', 'cost']).default('retail');

/**
 * Currency code validation (ISO 4217)
 */
export const currencySchema = z.string()
  .min(3, 'Currency code must be 3 characters')
  .max(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .default('USD');

/**
 * Sort direction validation
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');

/**
 * Item sort field validation
 */
export const itemSortFieldSchema = z.enum([
  'name',
  'sku',
  'barcode',
  'brand',
  'createdAt',
  'updatedAt',
]).default('name');

// =============================================================================
// CATEGORY SCHEMAS
// =============================================================================

/**
 * Schema for creating a category
 */
export const createCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(255, 'Category name must be 255 characters or less')
    .trim(),
  parentId: z.string().uuid('Invalid parent category ID').nullable().optional(),
});

/**
 * Schema for updating a category
 */
export const updateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(255, 'Category name must be 255 characters or less')
    .trim()
    .optional(),
  parentId: z.string().uuid('Invalid parent category ID').nullable().optional(),
});

/**
 * Schema for category query parameters
 */
export const categoryQuerySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  includeTree: qsBool.default(false),
});

// =============================================================================
// ITEM PRICE SCHEMAS
// =============================================================================

/**
 * Schema for creating an item price
 */
export const createItemPriceSchema = z.object({
  priceTier: z.string()
    .min(1, 'Price tier is required')
    .max(50, 'Price tier must be 50 characters or less')
    .default('retail'),
  price: z.coerce.number()
    .min(0, 'Price cannot be negative')
    .multipleOf(0.01, 'Price can have at most 2 decimal places'),
  currency: currencySchema,
  effectiveFrom: z.string().date('Invalid date format').nullable().optional(),
  effectiveTo: z.string().date('Invalid date format').nullable().optional(),
}).refine(
  (data) => {
    if (data.effectiveFrom && data.effectiveTo) {
      return new Date(data.effectiveFrom) <= new Date(data.effectiveTo);
    }
    return true;
  },
  { message: 'Effective from date must be before or equal to effective to date' }
);

/**
 * Schema for updating an item price
 */
export const updateItemPriceSchema = z.object({
  priceTier: z.string()
    .min(1, 'Price tier is required')
    .max(50, 'Price tier must be 50 characters or less')
    .optional(),
  price: z.coerce.number()
    .min(0, 'Price cannot be negative')
    .multipleOf(0.01, 'Price can have at most 2 decimal places')
    .optional(),
  currency: z.string()
    .length(3, 'Currency code must be 3 characters')
    .toUpperCase()
    .optional(),
  effectiveFrom: z.string().date('Invalid date format').nullable().optional(),
  effectiveTo: z.string().date('Invalid date format').nullable().optional(),
}).refine(
  (data) => {
    if (data.effectiveFrom && data.effectiveTo) {
      return new Date(data.effectiveFrom) <= new Date(data.effectiveTo);
    }
    return true;
  },
  { message: 'Effective from date must be before or equal to effective to date' }
);

// =============================================================================
// ITEM PACKAGING SCHEMAS
// =============================================================================

/**
 * Schema for creating an item packaging
 */
export const createItemPackagingSchema = z.object({
  name: z.string()
    .min(1, 'Packaging name is required')
    .max(100, 'Packaging name must be 100 characters or less')
    .trim(),
  quantity: z.coerce.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  barcode: z.string()
    .max(100, 'Barcode must be 100 characters or less')
    .nullable()
    .optional(),
});

/**
 * Schema for updating an item packaging
 */
export const updateItemPackagingSchema = z.object({
  name: z.string()
    .min(1, 'Packaging name is required')
    .max(100, 'Packaging name must be 100 characters or less')
    .trim()
    .optional(),
  quantity: z.coerce.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .optional(),
  barcode: z.string()
    .max(100, 'Barcode must be 100 characters or less')
    .nullable()
    .optional(),
});

// =============================================================================
// ITEM SCHEMAS
// =============================================================================

/**
 * Schema for creating an item
 */
export const createItemSchema = z.object({
  name: z.string()
    .min(1, 'Item name is required')
    .max(255, 'Item name must be 255 characters or less')
    .trim(),
  nameAlias: z.string()
    .max(255, 'Name alias must be 255 characters or less')
    .trim()
    .nullable()
    .optional(),
  sku: z.string()
    .max(100, 'SKU must be 100 characters or less')
    .trim()
    .nullable()
    .optional(),
  barcode: z.string()
    .max(100, 'Barcode must be 100 characters or less')
    .trim()
    .nullable()
    .optional(),
  brand: z.string()
    .max(255, 'Brand must be 255 characters or less')
    .trim()
    .nullable()
    .optional(),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  unitOfMeasure: z.string()
    .min(1, 'Unit of measure is required')
    .max(50, 'Unit of measure must be 50 characters or less')
    .default('piece'),
  taxRate: z.coerce.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  isActive: z.boolean().default(true),
  images: z.array(z.string().url('Invalid image URL')).default([]),
  tracksExpiry: z.boolean().default(false),
  expiryDate: z.string().date('Invalid date format').nullable().optional(),
  prices: z.array(createItemPriceSchema).optional(),
  packagings: z.array(createItemPackagingSchema).optional(),
}).refine(
  (data) => !data.tracksExpiry || !!data.expiryDate,
  { message: 'Expiry date is required when expiry tracking is enabled', path: ['expiryDate'] }
);

/**
 * Schema for updating an item
 */
export const updateItemSchemaBase = z.object({
  name: z.string()
    .min(1, 'Item name is required')
    .max(255, 'Item name must be 255 characters or less')
    .trim()
    .optional(),
  nameAlias: z.string()
    .max(255, 'Name alias must be 255 characters or less')
    .trim()
    .nullable()
    .optional(),
  sku: z.string()
    .max(100, 'SKU must be 100 characters or less')
    .trim()
    .nullable()
    .optional(),
  barcode: z.string()
    .max(100, 'Barcode must be 100 characters or less')
    .trim()
    .nullable()
    .optional(),
  brand: z.string()
    .max(255, 'Brand must be 255 characters or less')
    .trim()
    .nullable()
    .optional(),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  unitOfMeasure: z.string()
    .min(1, 'Unit of measure is required')
    .max(50, 'Unit of measure must be 50 characters or less')
    .optional(),
  taxRate: z.coerce.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .optional(),
  isActive: z.boolean().optional(),
  images: z.array(z.string().url('Invalid image URL')).optional(),
  tracksExpiry: z.boolean().optional(),
  expiryDate: z.string().date('Invalid date format').nullable().optional(),
  prices: z.array(createItemPriceSchema).optional(),
  packagings: z.array(createItemPackagingSchema).optional(),
});

/**
 * Schema for updating an item
 */
export const updateItemSchema = updateItemSchemaBase.refine(
  (data) => !data.tracksExpiry || !!data.expiryDate,
  { message: 'Expiry date is required when expiry tracking is enabled', path: ['expiryDate'] }
);

/**
 * Schema for item query parameters
 */
export const itemQuerySchema = z.object({
  search: z.string().max(255).optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  isActive: qsBool.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: itemSortFieldSchema,
  sortDir: sortDirectionSchema,
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
});

// =============================================================================
// EXPIRY SCHEMAS
// =============================================================================

/**
 * Schema for expiry alert/report query parameters
 */
export const expiryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
  severity: z.enum(['expired', 'critical', 'warning']).optional(),
});

// =============================================================================
// BULK OPERATION SCHEMAS
// =============================================================================

/**
 * Schema for bulk price update
 */
export const bulkPriceUpdateSchema = z.object({
  itemIds: z.array(z.string().uuid('Invalid item ID'))
    .min(1, 'At least one item ID is required')
    .max(500, 'Cannot update more than 500 items at once'),
  adjustmentType: z.enum(['percentage', 'fixed'], {
    errorMap: () => ({ message: 'Adjustment type must be "percentage" or "fixed"' }),
  }),
  adjustmentValue: z.number({
    required_error: 'Adjustment value is required',
  }),
  priceTier: z.string()
    .min(1, 'Price tier is required')
    .default('retail'),
  currency: currencySchema,
}).refine(
  (data) => {
    if (data.adjustmentType === 'percentage') {
      return data.adjustmentValue >= -100 && data.adjustmentValue <= 1000;
    }
    return true;
  },
  { message: 'Percentage adjustment must be between -100% and 1000%' }
);

/**
 * Schema for item report parameters
 */
export const itemReportParamsSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').optional(),
  isActive: qsBool.optional(),
  includePrices: qsBool.default(true),
  priceTier: z.string().default('retail'),
  currency: currencySchema,
});

/**
 * Schema for the item movement report query parameters
 */
export const itemMovementParamsSchema = z.object({
  dateFrom: z.string().date('Invalid date format'),
  dateTo: z.string().date('Invalid date format'),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
}).refine(
  (data) => new Date(data.dateFrom) <= new Date(data.dateTo),
  { message: 'Start date must be before or equal to end date', path: ['dateTo'] }
);

// Type aliases removed — authoritative types live in types/items.ts
