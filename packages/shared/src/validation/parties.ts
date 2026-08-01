/**
 * Zod validation schemas for Party and Payment entities
 * @module validation/parties
 */

import { z } from 'zod';
import { uuidSchema, currencySchema } from './items';
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
 * Sort direction for party/payment queries (defaults to desc)
 */
const partySortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

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
 * Email validation with proper format check
 */
const partyEmailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be 255 characters or less')
  .nullable()
  .optional();

/**
 * Phone validation
 */
export const phoneSchema = z.string()
  .max(50, 'Phone must be 50 characters or less')
  .nullable()
  .optional();

// =============================================================================
// OPENING BALANCE
// =============================================================================

/**
 * Opening balance amount — always a positive magnitude. The Debit/Credit
 * direction carries the sign, because which side is "positive" flips between
 * customers and suppliers. The API converts the pair into a signed value via
 * `toSignedOpeningBalance`.
 */
export const openingBalanceAmountSchema = z.coerce.number()
  .min(0, 'Opening balance cannot be negative')
  .max(999999999999.99, 'Opening balance is too large')
  .multipleOf(0.01, 'Opening balance can have at most 2 decimal places')
  .nullable()
  .optional();

export const openingBalanceDirectionSchema = z.enum(['debit', 'credit']).optional();

export const openingBalanceDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Opening balance date must be in YYYY-MM-DD format')
  .nullable()
  .optional();

const openingBalanceFields = {
  openingBalance: openingBalanceAmountSchema,
  openingBalanceDirection: openingBalanceDirectionSchema,
  openingBalanceDate: openingBalanceDateSchema,
};

/**
 * A non-zero opening balance needs both a direction and an as-of date, and the
 * date cannot be in the future (a future-dated opening balance would show in the
 * running balance but be invisible to aging and to statements ending earlier).
 */
function refineOpeningBalance(
  value: {
    openingBalance?: number | null;
    openingBalanceDirection?: 'debit' | 'credit';
    openingBalanceDate?: string | null;
  },
  ctx: z.RefinementCtx
): void {
  const amount = value.openingBalance;
  if (amount === undefined || amount === null || amount === 0) return;

  if (!value.openingBalanceDirection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['openingBalanceDirection'],
      message: 'Direction is required when an opening balance is entered',
    });
  }

  if (!value.openingBalanceDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['openingBalanceDate'],
      message: 'As-of date is required when an opening balance is entered',
    });
    return;
  }

  // Compare as plain YYYY-MM-DD strings; both sides are calendar dates, so this
  // avoids dragging timezones into the comparison.
  const today = new Date().toISOString().slice(0, 10);
  if (value.openingBalanceDate > today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['openingBalanceDate'],
      message: 'Opening balance date cannot be in the future',
    });
  }
}

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
  phone: phoneSchema,
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
  ...openingBalanceFields,
}).superRefine(refineOpeningBalance);

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
  phone: phoneSchema,
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
  ...openingBalanceFields,
}).superRefine(refineOpeningBalance);

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
  // Phase 3: bank routing + bill-wise allocations.
  bankAccountId: uuidSchema.nullable().optional(),
  allocations: z
    .array(
      z.object({
        invoice_id: uuidSchema,
        amount: z.coerce
          .number()
          .positive('Allocation amount must be greater than 0')
          .multipleOf(0.01, 'Allocation amount can have at most 2 decimal places'),
      })
    )
    .optional(),
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
  sortDir: partySortDirectionSchema,
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
  sortDir: partySortDirectionSchema,
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

// Type aliases removed — authoritative types live in types/parties.ts
