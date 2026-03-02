/**
 * Payroll Repository
 *
 * Handles payroll run data access operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type PayrollRunRow = Database['public']['Tables']['payroll_runs']['Row'];
type PayrollRunInsert = Database['public']['Tables']['payroll_runs']['Insert'];
type PayrollRunUpdate = Database['public']['Tables']['payroll_runs']['Update'];

export interface PayrollFilters {
  status?: 'draft' | 'processing' | 'completed';
  period_start?: string;
  period_end?: string;
}

export class PayrollRepository extends BaseRepository<
  'payroll_runs',
  PayrollRunRow,
  PayrollRunInsert,
  PayrollRunUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'payroll_runs');
  }

  /**
   * Find payroll runs with filtering
   */
  async findWithFilters(
    options: QueryOptions,
    filters?: PayrollFilters
  ): Promise<QueryResult<PayrollRunRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from(this.tableName)
      .select('*, users!payroll_runs_created_by_fkey(full_name)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters) {
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.period_start) {
        query = query.gte('period_start', filters.period_start);
      }

      if (filters.period_end) {
        query = query.lte('period_end', filters.period_end);
      }
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as PayrollRunRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find payroll run by period
   */
  async findByPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<PayrollRunRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PayrollRunRow;
  }

  /**
   * Check if payroll exists for a period
   */
  async existsForPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<boolean> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Get latest completed payroll run
   */
  async getLatestCompleted(tenantId: string): Promise<PayrollRunRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PayrollRunRow;
  }

  /**
   * Get all draft payroll runs
   */
  async findDrafts(tenantId: string): Promise<PayrollRunRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .order('period_start', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as PayrollRunRow[];
  }

  /**
   * Update payroll run status
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: 'draft' | 'processing' | 'completed'
  ): Promise<PayrollRunRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ status })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PayrollRunRow;
  }

  /**
   * Update payroll run totals
   */
  async updateTotals(
    tenantId: string,
    id: string,
    totals: {
      total_gross: number;
      total_deductions: number;
      total_net: number;
    }
  ): Promise<PayrollRunRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ total_amount: totals.total_net } as any)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PayrollRunRow;
  }
}
