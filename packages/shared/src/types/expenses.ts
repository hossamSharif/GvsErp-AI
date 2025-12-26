/**
 * Expense Types
 * User Story 7: Track Business Expenses
 */

/**
 * Expense Category Entity
 */
export interface ExpenseCategory {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Expense Entity
 */
export interface Expense {
  id: string;
  tenant_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  exchange_rate: number;
  description: string | null;
  expense_date: string; // ISO date string (YYYY-MM-DD)
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Expense with related data (for display)
 */
export interface ExpenseWithDetails extends Expense {
  category?: ExpenseCategory;
  created_by_name?: string;
}

/**
 * Create Expense Request
 */
export interface CreateExpenseRequest {
  category_id?: string | null;
  amount: number;
  currency?: string;
  exchange_rate?: number;
  description?: string;
  expense_date: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Update Expense Request
 */
export interface UpdateExpenseRequest {
  category_id?: string | null;
  amount?: number;
  currency?: string;
  exchange_rate?: number;
  description?: string;
  expense_date?: string;
}

/**
 * Create Expense Category Request
 */
export interface CreateExpenseCategoryRequest {
  name: string;
  parent_id?: string | null;
}

/**
 * Update Expense Category Request
 */
export interface UpdateExpenseCategoryRequest {
  name?: string;
  parent_id?: string | null;
}

/**
 * Expense Filters
 */
export interface ExpenseFilters {
  category_id?: string;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  search?: string; // Search in description
}

/**
 * Expense Summary (for reporting)
 */
export interface ExpenseSummary {
  total_amount: number;
  currency: string;
  total_count: number;
  by_category: {
    category_id: string | null;
    category_name: string | null;
    amount: number;
    count: number;
  }[];
  by_date: {
    date: string; // ISO date string
    amount: number;
    count: number;
  }[];
}

/**
 * Expense Report Filters
 */
export interface ExpenseReportFilters {
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  category_id?: string;
  currency?: string;
  group_by?: 'category' | 'date' | 'month';
}
