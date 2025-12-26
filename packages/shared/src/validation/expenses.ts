/**
 * Expense Validation Schemas
 * User Story 7: Track Business Expenses
 */

import { z } from 'zod';

/**
 * Create Expense Validation Schema
 */
export const createExpenseSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3).toUpperCase().optional().default('USD'),
  exchange_rate: z.number().positive().optional().default(1.0),
  description: z.string().max(1000).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Update Expense Validation Schema
 */
export const updateExpenseSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  exchange_rate: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD').optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * Create Expense Category Validation Schema
 */
export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255),
  parent_id: z.string().uuid().nullable().optional(),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

/**
 * Update Expense Category Validation Schema
 */
export const updateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

/**
 * Expense Filters Validation Schema
 */
export const expenseFiltersSchema = z.object({
  category_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  min_amount: z.coerce.number().positive().optional(),
  max_amount: z.coerce.number().positive().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  'Start date must be before or equal to end date'
).refine(
  (data) => {
    if (data.min_amount !== undefined && data.max_amount !== undefined) {
      return data.min_amount <= data.max_amount;
    }
    return true;
  },
  'Minimum amount must be less than or equal to maximum amount'
);

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;

/**
 * Expense Report Filters Validation Schema
 */
export const expenseReportFiltersSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  category_id: z.string().uuid().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  group_by: z.enum(['category', 'date', 'month']).optional().default('category'),
}).refine(
  (data) => new Date(data.start_date) <= new Date(data.end_date),
  'Start date must be before or equal to end date'
);

export type ExpenseReportFiltersInput = z.infer<typeof expenseReportFiltersSchema>;

/**
 * UUID Parameter Validation
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export type UuidParamInput = z.infer<typeof uuidParamSchema>;
