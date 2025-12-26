/**
 * Expense Service
 * Business logic for expense management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ExpenseRepository } from '../repositories/expense.repository';
import { ExpenseCategoryRepository } from '../repositories/expense-category.repository';
import {
  Expense,
  ExpenseWithDetails,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseFilters,
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
  ExpenseSummary,
} from '@erp-saas/shared/types/expenses';
import { PaginatedResponse } from '@erp-saas/shared/types/api';

export class ExpenseService {
  private expenseRepo: ExpenseRepository;
  private categoryRepo: ExpenseCategoryRepository;

  constructor(supabase: SupabaseClient) {
    this.expenseRepo = new ExpenseRepository(supabase);
    this.categoryRepo = new ExpenseCategoryRepository(supabase);
  }

  // ===== Expense Operations =====

  /**
   * Get all expenses with filters
   */
  async getExpenses(
    tenantId: string,
    filters: ExpenseFilters = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<ExpenseWithDetails>> {
    return this.expenseRepo.findAll(tenantId, filters, page, limit);
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(id: string, tenantId: string): Promise<ExpenseWithDetails> {
    const expense = await this.expenseRepo.findById(id, tenantId);

    if (!expense) {
      throw new Error('Expense not found');
    }

    return expense;
  }

  /**
   * Create a new expense
   */
  async createExpense(
    tenantId: string,
    userId: string,
    data: CreateExpenseRequest
  ): Promise<Expense> {
    // Validate category if provided
    if (data.category_id) {
      const category = await this.categoryRepo.findById(data.category_id, tenantId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Validate expense date is not in the future
    // Compare date strings directly to avoid timezone issues
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    if (data.expense_date > todayStr) {
      throw new Error('Expense date cannot be in the future');
    }

    return this.expenseRepo.create(tenantId, userId, data);
  }

  /**
   * Update an existing expense
   */
  async updateExpense(
    id: string,
    tenantId: string,
    updates: UpdateExpenseRequest
  ): Promise<Expense> {
    // Check if expense exists
    const existing = await this.expenseRepo.findById(id, tenantId);
    if (!existing) {
      throw new Error('Expense not found');
    }

    // Validate category if provided
    if (updates.category_id) {
      const category = await this.categoryRepo.findById(updates.category_id, tenantId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // Validate expense date if provided
    if (updates.expense_date) {
      // Compare date strings directly to avoid timezone issues
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      if (updates.expense_date > todayStr) {
        throw new Error('Expense date cannot be in the future');
      }
    }

    return this.expenseRepo.update(id, tenantId, updates);
  }

  /**
   * Delete an expense
   */
  async deleteExpense(id: string, tenantId: string): Promise<void> {
    const existing = await this.expenseRepo.findById(id, tenantId);
    if (!existing) {
      throw new Error('Expense not found');
    }

    return this.expenseRepo.delete(id, tenantId);
  }

  /**
   * Get expense summary for reporting
   */
  async getExpenseSummary(
    tenantId: string,
    startDate: string,
    endDate: string,
    currency?: string
  ): Promise<any> {
    return this.expenseRepo.getSummary(tenantId, startDate, endDate, currency);
  }

  // ===== Category Operations =====

  /**
   * Get all expense categories
   */
  async getCategories(tenantId: string): Promise<ExpenseCategory[]> {
    return this.categoryRepo.findAll(tenantId);
  }

  /**
   * Get expense category by ID
   */
  async getCategoryById(id: string, tenantId: string): Promise<ExpenseCategory> {
    const category = await this.categoryRepo.findById(id, tenantId);

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  /**
   * Create a new expense category
   */
  async createCategory(
    tenantId: string,
    data: CreateExpenseCategoryRequest
  ): Promise<ExpenseCategory> {
    // Validate parent category if provided
    if (data.parent_id) {
      const parent = await this.categoryRepo.findById(data.parent_id, tenantId);
      if (!parent) {
        throw new Error('Parent category not found');
      }
    }

    return this.categoryRepo.create(tenantId, data);
  }

  /**
   * Update an existing expense category
   */
  async updateCategory(
    id: string,
    tenantId: string,
    updates: UpdateExpenseCategoryRequest
  ): Promise<ExpenseCategory> {
    // Check if category exists
    const existing = await this.categoryRepo.findById(id, tenantId);
    if (!existing) {
      throw new Error('Category not found');
    }

    // Validate parent category if provided
    if (updates.parent_id) {
      // Prevent circular reference
      if (updates.parent_id === id) {
        throw new Error('Category cannot be its own parent');
      }

      const parent = await this.categoryRepo.findById(updates.parent_id, tenantId);
      if (!parent) {
        throw new Error('Parent category not found');
      }
    }

    return this.categoryRepo.update(id, tenantId, updates);
  }

  /**
   * Delete an expense category
   */
  async deleteCategory(id: string, tenantId: string): Promise<void> {
    const existing = await this.categoryRepo.findById(id, tenantId);
    if (!existing) {
      throw new Error('Category not found');
    }

    // Check if category has children
    const hasChildren = await this.categoryRepo.hasChildren(id, tenantId);
    if (hasChildren) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check if category is used by expenses
    const isUsed = await this.categoryRepo.isUsedByExpenses(id, tenantId);
    if (isUsed) {
      throw new Error('Cannot delete category that is used by expenses');
    }

    return this.categoryRepo.delete(id, tenantId);
  }

  /**
   * Get root categories (categories without parent)
   */
  async getRootCategories(tenantId: string): Promise<ExpenseCategory[]> {
    return this.categoryRepo.findRootCategories(tenantId);
  }

  /**
   * Get child categories of a parent
   */
  async getChildCategories(
    parentId: string,
    tenantId: string
  ): Promise<ExpenseCategory[]> {
    return this.categoryRepo.findChildren(parentId, tenantId);
  }
}
