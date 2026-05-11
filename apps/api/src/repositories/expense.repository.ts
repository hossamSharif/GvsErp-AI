/**
 * Expense Repository
 *
 * Handles data access for expenses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type { Expense, ExpenseWithCreator } from '@erp/shared';

type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

export interface ExpenseQueryOptions extends QueryOptions {
  category?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export class ExpenseRepository extends BaseRepository<'expenses', ExpenseRow, ExpenseInsert, ExpenseUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'expenses');
  }

  protected hasIsActiveColumn(): boolean {
    return false;
  }

  async findAllWithFilters(options: ExpenseQueryOptions): Promise<QueryResult<ExpenseWithCreator>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'expense_date',
      sort_order = 'desc',
      category,
      paymentMethod,
      search,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('expenses')
      .select(
        `*, creator:users!created_by(id, full_name, email)`,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId);

    if (category) {
      query = query.eq('category', category);
    }
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }
    if (search) {
      const s = BaseRepository.escapeILike(search);
      query = query.or(
        `description.ilike.%${s}%,notes.ilike.%${s}%,reference.ilike.%${s}%,category.ilike.%${s}%`
      );
    }
    if (dateFrom) {
      query = query.gte('expense_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('expense_date', dateTo);
    }
    if (minAmount !== undefined) {
      query = query.gte('amount', minAmount);
    }
    if (maxAmount !== undefined) {
      query = query.lte('amount', maxAmount);
    }

    const sortField = this.mapSortField(sort_by);
    query = query
      .order(sortField, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const expenses = (data || []).map(this.mapWithCreator);

    return {
      data: expenses,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async findByIdWithCreator(tenantId: string, id: string): Promise<ExpenseWithCreator | null> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select(`*, creator:users!created_by(id, full_name, email)`)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapWithCreator(data as any);
  }

  async getDistinctCategories(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('expenses')
      .select('category')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const set = new Set<string>();
    for (const row of data || []) {
      if (row.category) set.add(row.category);
    }
    return Array.from(set).sort();
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      expenseDate: 'expense_date',
      expense_date: 'expense_date',
      amount: 'amount',
      category: 'category',
      createdAt: 'created_at',
      created_at: 'created_at',
    };
    return fieldMap[sortBy] || 'expense_date';
  }

  mapRow = (row: ExpenseRow): Expense => ({
    id: row.id,
    tenantId: row.tenant_id,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    exchangeRate: Number(row.exchange_rate),
    expenseDate: row.expense_date,
    description: row.description,
    reference: row.reference,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  private mapWithCreator = (
    row: ExpenseRow & {
      creator: { id: string; full_name: string | null; email: string } | null;
    }
  ): ExpenseWithCreator => ({
    ...this.mapRow(row),
    creator: row.creator
      ? {
          id: row.creator.id,
          fullName: row.creator.full_name,
          email: row.creator.email,
        }
      : null,
  });
}
