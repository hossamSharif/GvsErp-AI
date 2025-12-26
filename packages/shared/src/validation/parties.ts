/**
 * Zod validation schemas for Party and Payment entities
 * @module validation/parties
 */

import { z } from 'zod';
import { uuidSchema, sortDirectionSchema, currencySchema } from './items';
import { exchangeRateSchema } from './invoices';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Party type validation
 */
export const partyTypeSchema = z.enum(['customer', 'supplier']);

/**
 * Payment type validation
 */
export const paymentTypeSchema = z.enum(['received', 'made']);

/**
 * Payment method validation
 */
export const paymentMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'check',
  'credit_card',
  'other',
]);

/**
 * Party sort field validation
 */
export const partySortFieldSchema = z.enum([
  'name',
  'balance',
  'createdAt',
  'updatedAt',
]).default('name');

/**
 * Payment sort field validation
 */
export const paymentSortFieldSchema = z.enum([
  'paymentDate',
  'amount',
  'createdAt',
]).default('paymentDate');

// =============================================================================
// PARTY SCHEMAS
// =============================================================================

/**
 * Email validation with proper format check (nullable for parties)
 */
const partyEmailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be 255 characters or less')
  .nullable()
  .optional();

/**
 * Phone validation
 */
const partyPhoneSchema = z.string()
  .max(50, 'Phone must be 50 characters or less')
  .nullable()
  .optional();

/**
 * Schema for creating a new party
 */
export const createPartySchema = z.object({
  type: partyTypeSchema,
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .trim(),
  email: partyEmailSchema,
  phone: partyPhoneSchema,
  address: z.string()
    .max(500, 'Address must be 500 characters or less')
    .nullable()
    .optional(),
  taxNumber: z.string()
    .max(50, 'Tax number must be 50 characters or less')
    .nullable()
    .optional(),
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
});

/**
 * Schema for updating a party
 */
export const updatePartySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .trim()
    .optional(),
  email: partyEmailSchema,
  phone: partyPhoneSchema,
  address: z.string()
    .max(500, 'Address must be 500 characters or less')
    .nullable()
    .optional(),
  taxNumber: z.string()
    .max(50, 'Tax number must be 50 characters or less')
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
});

// =============================================================================
// PAYMENT SCHEMAS
// =============================================================================

/**
 * Schema for creating a new payment
 */
export const createPaymentSchema = z.object({
  partyId: uuidSchema,
  type: paymentTypeSchema,
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  currency: currencySchema,
  exchangeRate: exchangeRateSchema,
  paymentMethod: z.string()
    .max(50, 'Payment method must be 50 characters or less')
    .nullable()
    .optional(),
  reference: z.string()
    .max(100, 'Reference must be 100 characters or less')
    .nullable()
    .optional(),
  invoiceId: uuidSchema.nullable().optional(),
  notes: z.string()
    .max(500, 'Notes must be 500 characters or less')
    .nullable()
    .optional(),
  paymentDate: z.string()
    .date('Invalid date format')
    .optional(),
});

/**
 * Schema for updating a payment
 */
export const updatePaymentSchema = z.object({
  paymentMethod: z.string()
    .max(50, 'Payment method must be 50 characters or less')
    .nullable()
    .optional(),
  reference: z.string()
    .max(100, 'Reference must be 100 characters or less')
    .nullable()
    .optional(),
  notes: z.string()
    .max(500, 'Notes must be 500 characters or less')
    .nullable()
    .optional(),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/**
 * Schema for party query parameters
 */
export const partyQuerySchema = z.object({
  type: partyTypeSchema.optional(),
  search: z.string().max(255).optional(),
  isActive: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().optional()
  ),
  hasBalance: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().optional()
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: partySortFieldSchema,
  sortDir: sortDirectionSchema,
});

/**
 * Schema for payment query parameters
 */
export const paymentQuerySchema = z.object({
  type: paymentTypeSchema.optional(),
  partyId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  paymentMethod: z.string().max(50).optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: paymentSortFieldSchema,
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

// =============================================================================
// REPORT SCHEMAS
// =============================================================================

/**
 * Schema for customer balance report parameters
 */
export const customerBalanceReportParamsSchema = z.object({
  hasBalance: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().optional()
  ),
  minBalance: z.coerce.number().optional(),
  maxBalance: z.coerce.number().optional(),
  includeInactive: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().default(false)
  ),
});

/**
 * Schema for payment report parameters
 */
export const paymentReportParamsSchema = z.object({
  type: paymentTypeSchema.optional(),
  partyId: uuidSchema.optional(),
  partyType: partyTypeSchema.optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  paymentMethod: z.string().max(50).optional(),
  includeSummary: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().default(true)
  ),
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
 * Schema for party statement parameters
 */
export const partyStatementParamsSchema = z.object({
  partyId: uuidSchema,
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'Date from must be before or equal to date to' }
);

// Type exports are in types/parties.ts to avoid duplicate exports
