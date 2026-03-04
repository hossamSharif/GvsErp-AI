/**
 * Employee Repository
 *
 * Handles employee data access operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];
type EmployeeUpdate = Database['public']['Tables']['employees']['Update'];

export interface EmployeeFilters {
  department?: string;
  position?: string;
  is_active?: boolean;
  search?: string;
}

export class EmployeeRepository extends BaseRepository<
  'employees',
  EmployeeRow,
  EmployeeInsert,
  EmployeeUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'employees');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Find employees with filtering
   */
  async findWithFilters(
    options: QueryOptions,
    filters?: EmployeeFilters
  ): Promise<QueryResult<EmployeeRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
      includeInactive = false,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from(this.tableName)
      .select('*, users(full_name, email)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters) {
      if (filters.department) {
        query = query.eq('department', filters.department);
      }

      if (filters.position) {
        query = query.eq('position', filters.position);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      } else if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (filters.search) {
        const s = BaseRepository.escapeILike(filters.search);
        query = query.or(
          `full_name.ilike.%${s}%,employee_number.ilike.%${s}%`
        );
      }
    } else if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as EmployeeRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find employee by employee number
   */
  async findByEmployeeNumber(
    tenantId: string,
    employeeNumber: string
  ): Promise<EmployeeRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_number', employeeNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as EmployeeRow;
  }

  /**
   * Find employee by user ID
   */
  async findByUserId(tenantId: string, userId: string): Promise<EmployeeRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as EmployeeRow;
  }

  /**
   * Get all active employees for payroll
   */
  async findActiveEmployees(tenantId: string): Promise<EmployeeRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('employee_number');

    if (error) {
      throw error;
    }

    return (data || []) as EmployeeRow[];
  }

  /**
   * Get unique departments
   */
  async getDepartments(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('department')
      .eq('tenant_id', tenantId)
      .not('department', 'is', null);

    if (error) {
      throw error;
    }

    const departments = data?.map((row) => row.department).filter(Boolean) || [];
    return Array.from(new Set(departments)) as string[];
  }

  /**
   * Get unique positions
   */
  async getPositions(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('position')
      .eq('tenant_id', tenantId)
      .not('position', 'is', null);

    if (error) {
      throw error;
    }

    const positions = data?.map((row) => row.position).filter(Boolean) || [];
    return Array.from(new Set(positions)) as string[];
  }
}
