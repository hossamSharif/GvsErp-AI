/**
 * Expense Repository
 * Handles database operations for expenses
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Expense,
  ExpenseWithDetails,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseFilters,
} from '@erp-saas/shared/types/expenses';
import { PaginatedResponse } from '@erp-saas/shared/types/api';

export class ExpenseRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find all expenses with filters and pagination
   */
  async findAll(
    tenantId: string,
    filters: ExpenseFilters = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<ExpenseWithDetails>> {
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('expenses')
      .select(
        `
        *,
        category:expense_categories(id, name),
        created_by_user:users!created_by(full_name)
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters.start_date) {
      query = query.gte('expense_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('expense_date', filters.end_date);
    }

    if (filters.min_amount !== undefined) {
      query = query.gte('amount', filters.min_amount);
    }

    if (filters.max_amount !== undefined) {
      query = query.lte('amount', filters.max_amount);
    }

    if (filters.currency) {
      query = query.eq('currency', filters.currency);
    }

    if (filters.search) {
      query = query.ilike('description', `%${filters.search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    // Transform the response to include category and created_by_name
    const expenses: ExpenseWithDetails[] = (data || []).map((expense: any) => ({
      ...expense,
      category: expense.category,
      created_by_name: expense.created_by_user?.full_name,
    }));

    return {
      data: expenses,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find expense by ID
   */
  async findById(id: string, tenantId: string): Promise<ExpenseWithDetails | null> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select(
        `
        *,
        category:expense_categories(id, name),
        created_by_user:users!created_by(full_name)
      `
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch expense: ${error.message}`);
    }

    return {
      ...data,
      category: data.category,
      created_by_name: data.created_by_user?.full_name,
    };
  }

  /**
   * Create a new expense
   */
  async create(
    tenantId: string,
    userId: string,
    expense: CreateExpenseRequest
  ): Promise<Expense> {
    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        ...expense,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create expense: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing expense
   */
  async update(
    id: string,
    tenantId: string,
    updates: UpdateExpenseRequest
  ): Promise<Expense> {
    const { data, error } = await this.supabase
      .from('expenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update expense: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete an expense (hard delete)
   */
  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete expense: ${error.message}`);
    }
  }

  /**
   * Get expense summary for reporting
   */
  async getSummary(
    tenantId: string,
    startDate: string,
    endDate: string,
    currency?: string
  ): Promise<{
    total_amount: number;
    total_count: number;
    by_category: Array<{
      category_id: string | null;
      category_name: string | null;
      amount: number;
      count: number;
    }>;
  }> {
    let query = this.supabase
      .from('expenses')
      .select(
        `
        amount,
        category_id,
        category:expense_categories(name)
      `
      )
      .eq('tenant_id', tenantId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (currency) {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch expense summary: ${error.message}`);
    }

    // Calculate totals
    const total_amount = (data || []).reduce(
      (sum, expense) => sum + Number(expense.amount),
      0
    );
    const total_count = data?.length || 0;

    // Group by category
    const categoryMap = new Map<
      string | null,
      { category_name: string | null; amount: number; count: number }
    >();

    (data || []).forEach((expense: any) => {
      const catId = expense.category_id || null;
      const existing = categoryMap.get(catId) || {
        category_name: expense.category?.name || null,
        amount: 0,
        count: 0,
      };

      categoryMap.set(catId, {
        category_name: existing.category_name,
        amount: existing.amount + Number(expense.amount),
        count: existing.count + 1,
      });
    });

    const by_category = Array.from(categoryMap.entries()).map(([catId, stats]) => ({
      category_id: catId,
      category_name: stats.category_name,
      amount: stats.amount,
      count: stats.count,
    }));

    return {
      total_amount,
      total_count,
      by_category,
    };
  }
}
