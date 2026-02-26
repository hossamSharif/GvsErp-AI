/**
 * User Repository
 *
 * Handles user management operations with role relationships
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

export interface UserWithRole extends UserRow {
  role?: Database['public']['Tables']['roles']['Row'];
}

export interface UserQueryOptions extends QueryOptions {
  role_id?: string;
  search?: string;
}

export class UserRepository extends BaseRepository<'users'> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'users');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Find all users with role information
   */
  async findAllWithRoles(options: UserQueryOptions): Promise<QueryResult<UserWithRole>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
      includeInactive = false,
      role_id,
      search,
    } = options;

    const offset = (page - 1) * limit;

    // Build query with role join
    let query = this.supabase
      .from('users')
      .select('*, role:roles(*)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    // Filter inactive users
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Filter by role
    if (role_id) {
      query = query.eq('role_id', role_id);
    }

    // Search by name or email
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as UserWithRole[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find user by ID with role information
   */
  async findByIdWithRole(tenantId: string, id: string): Promise<UserWithRole | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*, role:roles(*)')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as UserWithRole;
  }

  /**
   * Find user by email
   */
  async findByEmail(tenantId: string, email: string): Promise<UserRow | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as UserRow;
  }

  /**
   * Check if email exists for tenant
   */
  async emailExists(tenantId: string, email: string, excludeUserId?: string): Promise<boolean> {
    let query = this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase());

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Count users by role
   */
  async countByRole(tenantId: string, roleId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role_id', roleId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  /**
   * Update user role
   */
  async updateRole(tenantId: string, userId: string, roleId: string): Promise<UserRow | null> {
    return this.update(tenantId, userId, { role_id: roleId } as UserUpdate);
  }

  /**
   * Activate/deactivate user
   */
  async setActive(tenantId: string, userId: string, isActive: boolean): Promise<UserRow | null> {
    return this.update(tenantId, userId, { is_active: isActive } as UserUpdate);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    tenantId: string,
    userId: string,
    preferences: Record<string, any>
  ): Promise<UserRow | null> {
    return this.update(tenantId, userId, { preferences } as UserUpdate);
  }
}
