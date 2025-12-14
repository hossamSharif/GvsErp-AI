/**
 * Role Repository
 *
 * Handles role and permission management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type RoleRow = Database['public']['Tables']['roles']['Row'];
type RoleInsert = Database['public']['Tables']['roles']['Insert'];
type RoleUpdate = Database['public']['Tables']['roles']['Update'];

export interface RoleQueryOptions extends QueryOptions {
  is_system?: boolean;
}

export class RoleRepository extends BaseRepository<'roles'> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'roles');
  }

  /**
   * Find all roles with optional system filter
   */
  async findAllRoles(options: RoleQueryOptions): Promise<QueryResult<RoleRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
      is_system,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('roles')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    // Filter by system flag
    if (is_system !== undefined) {
      query = query.eq('is_system', is_system);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as RoleRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find role by name
   */
  async findByName(tenantId: string, name: string): Promise<RoleRow | null> {
    const { data, error } = await this.supabase
      .from('roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as RoleRow;
  }

  /**
   * Check if role name exists
   */
  async nameExists(tenantId: string, name: string, excludeRoleId?: string): Promise<boolean> {
    let query = this.supabase
      .from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('name', name);

    if (excludeRoleId) {
      query = query.neq('id', excludeRoleId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  /**
   * Get system roles
   */
  async getSystemRoles(tenantId: string): Promise<RoleRow[]> {
    const { data, error } = await this.supabase
      .from('roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_system', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as RoleRow[];
  }

  /**
   * Get custom (non-system) roles
   */
  async getCustomRoles(tenantId: string): Promise<RoleRow[]> {
    const { data, error } = await this.supabase
      .from('roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_system', false)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as RoleRow[];
  }

  /**
   * Check if role can be deleted (not system role and no users assigned)
   */
  async canDelete(tenantId: string, roleId: string): Promise<{ canDelete: boolean; reason?: string }> {
    // Check if system role
    const role = await this.findById(tenantId, roleId);
    if (!role) {
      return { canDelete: false, reason: 'Role not found' };
    }

    if (role.is_system) {
      return { canDelete: false, reason: 'Cannot delete system roles' };
    }

    // Check if users are assigned to this role
    const { count, error } = await this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role_id', roleId);

    if (error) {
      throw error;
    }

    if ((count || 0) > 0) {
      return { canDelete: false, reason: `Cannot delete role with ${count} assigned user(s)` };
    }

    return { canDelete: true };
  }

  /**
   * Update role permissions
   */
  async updatePermissions(
    tenantId: string,
    roleId: string,
    permissions: string[]
  ): Promise<RoleRow | null> {
    // Verify role is not system role
    const role = await this.findById(tenantId, roleId);
    if (!role) {
      return null;
    }

    if (role.is_system) {
      throw new Error('Cannot modify permissions of system roles');
    }

    return this.update(tenantId, roleId, { permissions } as RoleUpdate);
  }

  /**
   * Create system role (used during tenant initialization)
   */
  async createSystemRole(
    tenantId: string,
    data: Omit<RoleInsert, 'tenant_id' | 'id' | 'is_system'>
  ): Promise<RoleRow> {
    const { data: created, error } = await this.supabase
      .from('roles')
      .insert({
        ...data,
        tenant_id: tenantId,
        is_system: true,
      } as RoleInsert)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return created as RoleRow;
  }
}
