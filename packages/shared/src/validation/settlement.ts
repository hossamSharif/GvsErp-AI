/**
 * Inventory Settlement Validation Schemas
 */

import { z } from 'zod';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

export const settlementStatusSchema = z.enum(['draft', 'posted', 'canceled']);

export const settlementReasonSchema = z.enum([
  'count_correction',
  'damage',
  'theft',
  'expiry',
  'other',
]);

export const settlementSortFieldSchema = z
  .enum(['settlementNumber', 'settlementDate', 'status', 'createdAt'])
  .default('createdAt');

// =============================================================================
// LINE SCHEMA
// =============================================================================

/**
 * A line carries the ABSOLUTE counted quantity. Because on-hand is set to this
 * value, and it cannot be negative, a settlement can never drive stock below
 * zero — the guardrail is structural rather than a runtime check.
 */
export const settlementItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  countedQuantity: z.coerce
    .number()
    .min(0, 'Counted quantity cannot be negative')
    .multipleOf(0.001, 'Quantity can have at most 3 decimal places'),
  unitCost: z.coerce
    .number()
    .min(0, 'Unit cost cannot be negative')
    .multipleOf(0.0001, 'Unit cost can have at most 4 decimal places')
    .default(0),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or less')
    .trim()
    .nullable()
    .optional(),
});

/** One line per item — a document counting the same item twice is ambiguous. */
const uniqueItems = <T extends { items?: { itemId: string }[] }>(data: T) => {
  if (!data.items) return true;
  return new Set(data.items.map((i) => i.itemId)).size === data.items.length;
};

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

export const createSettlementSchema = z
  .object({
    warehouseId: z.string().uuid('Invalid warehouse ID'),
    settlementDate: z.string().date('Invalid date format').optional(),
    reason: settlementReasonSchema.default('count_correction'),
    notes: z
      .string()
      .max(1000, 'Notes must be 1000 characters or less')
      .trim()
      .nullable()
      .optional(),
    items: z
      .array(settlementItemSchema)
      .min(1, 'At least one item is required')
      .max(500, 'Cannot settle more than 500 items at once'),
  })
  .refine(uniqueItems, { message: 'Each item can appear only once', path: ['items'] });

export const updateSettlementSchema = z
  .object({
    settlementDate: z.string().date('Invalid date format').optional(),
    reason: settlementReasonSchema.optional(),
    notes: z
      .string()
      .max(1000, 'Notes must be 1000 characters or less')
      .trim()
      .nullable()
      .optional(),
    items: z
      .array(settlementItemSchema)
      .min(1, 'At least one item is required')
      .max(500, 'Cannot settle more than 500 items at once')
      .optional(),
  })
  .refine(uniqueItems, { message: 'Each item can appear only once', path: ['items'] });

export const settlementQuerySchema = z
  .object({
    status: settlementStatusSchema.optional(),
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
    reason: settlementReasonSchema.optional(),
    search: z.string().max(255).optional(),
    dateFrom: z.string().date('Invalid date format').optional(),
    dateTo: z.string().date('Invalid date format').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: settlementSortFieldSchema,
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    { message: 'Date from must be before or equal to date to' }
  );

export const countSheetQuerySchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  search: z.string().max(255).optional(),
  onlyWithStock: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
