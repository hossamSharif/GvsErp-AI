/**
 * Zod validation schemas for Expense entity
 * @module validation/expenses
 */

import { z } from 'zod';
import { currencySchema } from './items';
import { exchangeRateSchema } from './invoices';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

const expenseSortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

export const expenseSortFieldSchema = z.enum([
  'expenseDate',
  'amount',
  'category',
  'createdAt',
]).default('expenseDate');

const categorySchema = z.string()
  .min(1, 'Category is required')
  .max(100, 'Category must be 100 characters or less')
  .trim();

const paymentMethodSchema = z.string()
  .max(50, 'Payment method must be 50 characters or less')
  .nullable()
  .optional();

const referenceSchema = z.string()
  .max(100, 'Reference must be 100 characters or less')
  .nullable()
  .optional();

const descriptionSchema = z.string()
  .max(500, 'Description must be 500 characters or less')
  .nullable()
  .optional();

const notesSchema = z.string()
  .max(2000, 'Notes must be 2000 characters or less')
  .nullable()
  .optional();

// =============================================================================
// CRUD SCHEMAS
// =============================================================================

export const createExpenseSchema = z.object({
  category: categorySchema,
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  currency: currencySchema,
  exchangeRate: exchangeRateSchema,
  expenseDate: z.string().date('Invalid date format').optional(),
  description: descriptionSchema,
  reference: referenceSchema,
  paymentMethod: paymentMethodSchema,
  notes: notesSchema,
});

export const updateExpenseSchema = z.object({
  category: categorySchema.optional(),
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places')
    .optional(),
  currency: currencySchema.optional(),
  exchangeRate: exchangeRateSchema.optional(),
  expenseDate: z.string().date('Invalid date format').optional(),
  description: descriptionSchema,
  reference: referenceSchema,
  paymentMethod: paymentMethodSchema,
  notes: notesSchema,
});

// =============================================================================
// CATEGORY SCHEMAS
// =============================================================================

const categoryNameSchema = z.string()
  .trim()
  .min(1, 'Category name is required')
  .max(100, 'Category name must be 100 characters or less');

export const createExpenseCategorySchema = z.object({
  name: categoryNameSchema,
});

export const updateExpenseCategorySchema = z.object({
  name: categoryNameSchema.optional(),
  isActive: z.boolean().optional(),
});

export const expenseCategoryQuerySchema = z.object({
  includeInactive: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean().default(false)
  ),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const expenseQuerySchema = z.object({
  category: z.string().max(100).optional(),
  paymentMethod: z.string().max(50).optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: expenseSortFieldSchema,
  sortDir: expenseSortDirectionSchema,
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return new Date(data.dateFrom) <= new Date(data.dateTo);
    }
    return true;
  },
  { message: 'Date from must be before or equal to date to' }
).refine(
  (data) => {
    if (data.minAmount !== undefined && data.maxAmount !== undefined) {
      return data.minAmount <= data.maxAmount;
    }
    return true;
  },
  { message: 'Min amount must be less than or equal to max amount' }
);

// =============================================================================
// REPORT SCHEMAS
// =============================================================================

export const expenseReportParamsSchema = z.object({
  category: z.string().max(100).optional(),
  paymentMethod: z.string().max(50).optional(),
  dateFrom: z.string().date('Invalid date format').optional(),
  dateTo: z.string().date('Invalid date format').optional(),
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
