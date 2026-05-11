/**
 * Expense entity types for the ERP system
 * @module types/expenses
 */

import type { SortDirection } from './items';

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Default expense categories. Tenants may use any string; these are suggestions.
 */
export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'office_supplies'
  | 'travel'
  | 'marketing'
  | 'maintenance'
  | 'taxes'
  | 'insurance'
  | 'professional_services'
  | 'software'
  | 'meals'
  | 'transportation'
  | 'other';

export const EXPENSE_CATEGORY_VALUES = [
  'rent',
  'utilities',
  'salaries',
  'office_supplies',
  'travel',
  'marketing',
  'maintenance',
  'taxes',
  'insurance',
  'professional_services',
  'software',
  'meals',
  'transportation',
  'other',
] as const;

// =============================================================================
// EXPENSE ENTITY
// =============================================================================

export interface Expense {
  id: string;
  tenantId: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  expenseDate: string;
  description: string | null;
  reference: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseWithCreator extends Expense {
  creator: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface CreateExpenseInput {
  category: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  expenseDate?: string;
  description?: string | null;
  reference?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

export interface UpdateExpenseInput {
  category?: string;
  amount?: number;
  currency?: string;
  exchangeRate?: number;
  expenseDate?: string;
  description?: string | null;
  reference?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

export type ExpenseSortField =
  | 'expenseDate'
  | 'amount'
  | 'category'
  | 'createdAt';

export interface ExpenseQueryParams {
  category?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
  sortBy?: ExpenseSortField;
  sortDir?: SortDirection;
}

// =============================================================================
// REPORT TYPES
// =============================================================================

export interface ExpenseReportEntry {
  id: string;
  category: string;
  amount: number;
  currency: string;
  expenseDate: string;
  description: string | null;
  reference: string | null;
  paymentMethod: string | null;
}

export interface ExpenseReportSummary {
  totalCount: number;
  totalAmount: number;
  byCategory: Record<string, { count: number; total: number }>;
  byMethod: Record<string, { count: number; total: number }>;
}

export interface ExpenseReportParams {
  category?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  includeSummary?: boolean;
}

export interface ExpenseReportResponse {
  entries: ExpenseReportEntry[];
  summary?: ExpenseReportSummary;
  generatedAt: string;
}
