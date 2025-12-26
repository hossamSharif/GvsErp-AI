/**
 * Expense Category Repository
 * Handles database operations for expense categories
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
} from '@erp-saas/shared/types/expenses';

export class ExpenseCategoryRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find all expense categories for a tenant
   */
  async findAll(tenantId: string): Promise<ExpenseCategory[]> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch expense categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find expense category by ID
   */
  async findById(id: string, tenantId: string): Promise<ExpenseCategory | null> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch expense category: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new expense category
   */
  async create(
    tenantId: string,
    category: CreateExpenseCategoryRequest
  ): Promise<ExpenseCategory> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .insert({
        tenant_id: tenantId,
        ...category,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create expense category: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing expense category
   */
  async update(
    id: string,
    tenantId: string,
    updates: UpdateExpenseCategoryRequest
  ): Promise<ExpenseCategory> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update expense category: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete an expense category
   */
  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('expense_categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete expense category: ${error.message}`);
    }
  }

  /**
   * Find child categories of a parent category
   */
  async findChildren(parentId: string, tenantId: string): Promise<ExpenseCategory[]> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch child categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find root categories (categories without parent)
   */
  async findRootCategories(tenantId: string): Promise<ExpenseCategory[]> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('parent_id', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch root categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check if a category has children
   */
  async hasChildren(id: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('parent_id', id)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check for child categories: ${error.message}`);
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Check if a category is used by any expenses
   */
  async isUsedByExpenses(id: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('category_id', id)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check category usage: ${error.message}`);
    }

    return (data?.length || 0) > 0;
  }
}
