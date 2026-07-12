/**
 * Zod validation schemas for Invoice entities
 * @module validation/invoices
 */

import { z } from 'zod';
import { currencySchema, sortDirectionSchema, qsBool } from './items';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Invoice type validation
 */
export const invoiceTypeSchema = z.enum(['sale', 'purchase']);

/**
 * Invoice status validation
 */
export const invoiceStatusSchema = z.enum(['draft', 'final', 'returned', 'canceled']);

/**
 * Invoice sort field validation
 */
export const invoiceSortFieldSchema = z.enum([
  'invoiceNumber',
  'createdAt',
  'finalizedAt',
  'total',
  'status',
]).default('createdAt');

/**
 * Exchange rate validation
 */
export const exchangeRateSchema = z.coerce.number()
  .positive('Exchange rate must be positive')
  .max(1000000, 'Exchange rate too high')
  .default(1);

// =============================================================================
// INVOICE ITEM SCHEMAS
// =============================================================================

/**
 * Schema for creating an invoice line item
 */
export const createInvoiceItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  quantity: z.coerce.number()
    .positive('Quantity must be greater than 0')
    .multipleOf(0.001, 'Quantity can have at most 3 decimal places'),
  unitPrice: z.coerce.number()
    .min(0, 'Unit price cannot be negative')
    .multipleOf(0.01, 'Unit price can have at most 2 decimal places'),
  discountPercent: z.coerce.number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .default(0),
  taxRate: z.coerce.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for updating an invoice line item
 */
export const updateInvoiceItemSchema = z.object({
  id: z.string().uuid('Invalid item ID').optional(), // If present, update; if not, create
  itemId: z.string().uuid('Invalid item ID'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  quantity: z.coerce.number()
    .positive('Quantity must be greater than 0')
    .multipleOf(0.001, 'Quantity can have at most 3 decimal places'),
  unitPrice: z.coerce.number()
    .min(0, 'Unit price cannot be negative')
    .multipleOf(0.01, 'Unit price can have at most 2 decimal places'),
  discountPercent: z.coerce.number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .default(0),
  taxRate: z.coerce.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// INVOICE SCHEMAS
// =============================================================================

/**
 * Schema for creating a new invoice
 */
export const createInvoiceSchema = z.object({
  type: invoiceTypeSchema,
  partyId: z.string().uuid('Invalid party ID').nullable().optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  currency: currencySchema,
  exchangeRate: exchangeRateSchema,
  discountAmount: z.coerce.number()
    .min(0, 'Discount cannot be negative')
    .default(0),
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
  invoiceDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be in YYYY-MM-DD format')
    .optional(),
  items: z.array(createInvoiceItemSchema)
    .min(1, 'Invoice must have at least one item'),
});

/**
 * Schema for updating an invoice (draft only)
 */
export const updateInvoiceSchema = z.object({
  partyId: z.string().uuid('Invalid party ID').nullable().optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  currency: z.string()
    .length(3, 'Currency code must be 3 characters')
    .toUpperCase()
    .optional(),
  exchangeRate: z.coerce.number()
    .positive('Exchange rate must be positive')
    .optional(),
  discountAmount: z.coerce.number()
    .min(0, 'Discount cannot be negative')
    .optional(),
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
  invoiceDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be in YYYY-MM-DD format')
    .optional(),
  items: z.array(updateInvoiceItemSchema).optional(),
});

/**
 * Schema for finalizing an invoice
 */
export const finalizeInvoiceSchema = z.object({
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .optional(),
});

/**
 * Schema for return item specification
 */
export const returnInvoiceItemSchema = z.object({
  invoiceItemId: z.string().uuid('Invalid invoice item ID'),
  returnQuantity: z.coerce.number()
    .positive('Return quantity must be greater than 0')
    .multipleOf(0.001, 'Return quantity can have at most 3 decimal places'),
});

/**
 * Schema for creating a return invoice
 */
export const returnInvoiceSchema = z.object({
  items: z.array(returnInvoiceItemSchema)
    .min(1, 'Must return at least one item'),
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/**
 * Schema for invoice query parameters
 */
export const invoiceQuerySchema = z.object({
  type: invoiceTypeSchema.optional(),
  status: z.union([
    invoiceStatusSchema,
    z.array(invoiceStatusSchema),
  ]).optional(),
  partyId: z.string().uuid('Invalid party ID').optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  createdBy: z.string().uuid('Invalid user ID').optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: invoiceSortFieldSchema,
  sortDir: sortDirectionSchema,
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'Date from must be before or equal to date to' }
);

/**
 * Schema for sales report parameters
 */
export const salesReportParamsSchema = z.object({
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  partyId: z.string().uuid('Invalid party ID').optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  status: z.union([
    invoiceStatusSchema,
    z.array(invoiceStatusSchema),
  ]).optional(),
  includeSummary: qsBool.default(true),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'Date from must be before or equal to date to' }
);

/**
 * Schema for purchase report parameters
 */
export const purchaseReportParamsSchema = z.object({
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  partyId: z.string().uuid('Invalid party ID').optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  status: z.union([
    invoiceStatusSchema,
    z.array(invoiceStatusSchema),
  ]).optional(),
  includeSummary: qsBool.default(true),
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
// DRAFT SCHEMAS (for local autosave)
// =============================================================================

/**
 * Schema for a draft invoice item (local storage)
 */
export const draftInvoiceItemSchema = z.object({
  localId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  itemSku: z.string().nullable(),
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  taxRate: z.number().min(0).max(100),
  lineTotal: z.number().min(0),
  sortOrder: z.number().int().min(0),
});

/**
 * Schema for a draft invoice (local storage)
 */
export const draftInvoiceSchema = z.object({
  id: z.string().uuid(),
  type: invoiceTypeSchema,
  partyId: z.string().uuid().nullable(),
  warehouseId: z.string().uuid().nullable(),
  currency: z.string().length(3),
  exchangeRate: z.number().positive(),
  discountAmount: z.number().min(0),
  notes: z.string(),
  items: z.array(draftInvoiceItemSchema),
  lastSavedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

// Type aliases removed — authoritative types live in types/invoices.ts
