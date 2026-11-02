/**
 * Expense Category Repository
 *
 * Handles data access for tenant-managed expense categories.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository } from './base.repository';
import type { ExpenseCategoryRecord } from '@erp/shared';

type ExpenseCategoryRow = Database['public']['Tables']['expense_categories']['Row'];
type ExpenseCategoryInsert = Database['public']['Tables']['expense_categories']['Insert'];
type ExpenseCategoryUpdate = Database['public']['Tables']['expense_categories']['Update'];

export class ExpenseCategoryRepository extends BaseRepository<
  'expense_categories',
  ExpenseCategoryRow,
  ExpenseCategoryInsert,
  ExpenseCategoryUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'expense_categories');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  async list(tenantId: string, includeInactive: boolean): Promise<ExpenseCategoryRow[]> {
    let query = this.supabase
      .from('expense_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /** Case-insensitive lookup by name */
  async findByName(tenantId: string, name: string): Promise<ExpenseCategoryRow | null> {
    const { data, error } = await this.supabase
      .from('expense_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('name', BaseRepository.escapeILike(name))
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Insert the given names for a tenant that has no categories yet.
   * A concurrent seed hitting the unique index (23505) is ignored.
   */
  async seed(tenantId: string, names: readonly string[]): Promise<void> {
    const { error } = await this.supabase
      .from('expense_categories')
      .insert(names.map((name) => ({ tenant_id: tenantId, name })));
    if (error && error.code !== '23505') throw error;
  }

  /** Expense count per category name */
  async countUsage(tenantId: string): Promise<Map<string, number>> {
    const { data, error } = await this.supabase.rpc('expense_category_usage' as never, {
      p_tenant_id: tenantId,
    } as never);

    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{ category: string; expense_count: number }>;
    return new Map(rows.map((r) => [r.category, Number(r.expense_count)]));
  }

  async countUsageForName(tenantId: string, name: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('category', name);

    if (error) throw error;
    return count || 0;
  }

  /** Rename the category and every expense using it, atomically */
  async rename(tenantId: string, id: string, newName: string): Promise<ExpenseCategoryRow | null> {
    const { data, error } = await this.supabase.rpc('rename_expense_category' as never, {
      p_tenant_id: tenantId,
      p_id: id,
      p_new_name: newName,
    } as never);

    if (error) throw error;

    const rows = (data ?? []) as unknown as ExpenseCategoryRow[];
    return rows[0] ?? null;
  }

  mapRow = (row: ExpenseCategoryRow, expenseCount = 0): ExpenseCategoryRecord => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    isActive: row.is_active,
    expenseCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
