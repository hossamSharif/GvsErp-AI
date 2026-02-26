/**
 * Base Repository
 *
 * Provides common CRUD operations with automatic tenant filtering.
 *
 * Note: Supabase's TypeScript types cannot resolve table schemas through
 * generic type parameters (TName). The .from() method requires a string
 * literal to infer the correct Row/Insert/Update types. We use the
 * query() helper with explicit casts to maintain type safety at the
 * repository boundary while allowing generic CRUD operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { PaginationParams, PaginationMeta, SortParams } from '@erp/shared';

export type TableName = keyof Database['public']['Tables'];

export interface QueryOptions extends PaginationParams, SortParams {
  tenantId: string;
  includeInactive?: boolean;
}

export interface QueryResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Base repository class with tenant-scoped operations
 */
export abstract class BaseRepository<
  TName extends TableName,
  TRow = Database['public']['Tables'][TName]['Row'],
  TInsert = Database['public']['Tables'][TName]['Insert'],
  TUpdate = Database['public']['Tables'][TName]['Update']
> {
  protected readonly tableName: TName;
  protected readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tableName: TName) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  /**
   * Helper to get a typed query builder for this table.
   * Uses 'as any' to work around Supabase's inability to resolve
   * table types through generic parameters.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected query() {
    return this.supabase.from(this.tableName as any);
  }

  /**
   * Find all records with pagination
   */
  async findAll(options: QueryOptions): Promise<QueryResult<TRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
      includeInactive = false,
    } = options;

    const offset = (page - 1) * limit;

    // Build query
    let query = this.query()
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    // Filter inactive if table has is_active column
    if (!includeInactive && this.hasIsActiveColumn()) {
      query = query.eq('is_active', true);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as TRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find a single record by ID
   */
  async findById(tenantId: string, id: string): Promise<TRow | null> {
    const { data, error } = await this.query()
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as TRow;
  }

  /**
   * Create a new record
   */
  async create(tenantId: string, data: Omit<TInsert, 'tenant_id' | 'id'>): Promise<TRow> {
    const { data: created, error } = await this.query()
      .insert({
        ...data,
        tenant_id: tenantId,
      } as any)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return created as TRow;
  }

  /**
   * Update an existing record
   */
  async update(
    tenantId: string,
    id: string,
    data: Partial<TUpdate>
  ): Promise<TRow | null> {
    const { data: updated, error } = await this.query()
      .update(data as any)
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

    return updated as TRow;
  }

  /**
   * Soft delete (set is_active = false) or hard delete
   */
  async delete(tenantId: string, id: string, soft: boolean = true): Promise<boolean> {
    if (soft && this.hasIsActiveColumn()) {
      const { error } = await this.query()
        .update({ is_active: false } as any)
        .eq('tenant_id', tenantId)
        .eq('id', id);

      if (error) {
        throw error;
      }
      return true;
    }

    const { error } = await this.query()
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }
    return true;
  }

  /**
   * Count records
   */
  async count(tenantId: string, includeInactive: boolean = false): Promise<number> {
    let query = this.query()
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (!includeInactive && this.hasIsActiveColumn()) {
      query = query.eq('is_active', true);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(tenantId: string, id: string): Promise<boolean> {
    const { count, error } = await this.query()
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Override in subclasses if table has is_active column
   */
  protected hasIsActiveColumn(): boolean {
    return false;
  }
}
