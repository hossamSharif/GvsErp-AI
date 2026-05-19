/**
 * Role Service
 *
 * Business logic for role and permission management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import type { Role, Permission } from '@erp/shared';
import { RoleRepository } from '../repositories/role.repository';
import type { QueryResult } from '../repositories/base.repository';
import { syncUserAuthMetadata } from './auth-admin';

type RoleRow = { id: string; tenant_id: string; name: string; permissions: unknown; is_system: boolean; created_at: string };

/**
 * Application error for role-related operations
 */
export class RoleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RoleError';
  }
}

/**
 * Service for Role business logic
 */
export class RoleService {
  private readonly repository: RoleRepository;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.repository = new RoleRepository(supabase);
    this.tenantId = tenantId;
  }

  private mapRow(row: RoleRow): Role {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      permissions: (Array.isArray(row.permissions) ? row.permissions : []) as Permission[],
      is_system: row.is_system,
      created_at: row.created_at,
    };
  }

  /**
   * List roles with pagination and filters
   */
  async getRoles(params: {
    page?: number;
    limit?: number;
    is_system?: boolean;
  }): Promise<QueryResult<Role>> {
    const result = await this.repository.findAllRoles({
      tenantId: this.tenantId,
      page: params.page || 1,
      limit: params.limit || 50,
      is_system: params.is_system,
    });
    return { ...result, data: result.data.map((row) => this.mapRow(row)) };
  }

  /**
   * Get a single role by ID
   */
  async getRole(id: string): Promise<Role> {
    const role = await this.repository.findById(this.tenantId, id);
    if (!role) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
    return this.mapRow(role);
  }

  /**
   * Create a new role
   */
  async createRole(input: { name: string; permissions: string[] }): Promise<Role> {
    const nameExists = await this.repository.nameExists(this.tenantId, input.name);
    if (nameExists) {
      throw new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
    }

    const created = await this.repository.create(this.tenantId, {
      name: input.name,
      permissions: input.permissions,
      is_system: false,
    });
    return this.mapRow(created);
  }

  /**
   * Update a role
   */
  async updateRole(id: string, input: { name?: string; permissions?: string[] }): Promise<Role> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }

    if (existing.is_system) {
      throw new RoleError('Cannot modify system roles', 'SYSTEM_ROLE');
    }

    if (input.name && input.name !== existing.name) {
      const nameExists = await this.repository.nameExists(this.tenantId, input.name, id);
      if (nameExists) {
        throw new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.permissions !== undefined) updates.permissions = input.permissions;

    const role = await this.repository.update(this.tenantId, id, updates);
    if (!role) {
      throw new RoleError('Failed to update role', 'UPDATE_FAILED', 500);
    }

    const mapped = this.mapRow(role);
    await this.fanoutMetadata(mapped);
    return mapped;
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    const { canDelete, reason } = await this.repository.canDelete(this.tenantId, id);
    if (!canDelete) {
      throw new RoleError(reason || 'Cannot delete role', 'CANNOT_DELETE');
    }

    const deleted = await this.repository.delete(this.tenantId, id);
    if (!deleted) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
  }

  /**
   * Update role permissions
   */
  async updatePermissions(id: string, permissions: string[]): Promise<Role> {
    const role = await this.repository.updatePermissions(this.tenantId, id, permissions);
    if (!role) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
    const mapped = this.mapRow(role);
    await this.fanoutMetadata(mapped);
    return mapped;
  }

  /**
   * After a role's name or permissions change, refresh user_metadata for every
   * user assigned to it so JWT claims stay aligned with the DB. Best-effort —
   * the auth middleware reads from the DB anyway.
   */
  private async fanoutMetadata(role: Role): Promise<void> {
    try {
      const { data: users } = await this.supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', this.tenantId)
        .eq('role_id', role.id);
      if (!users || users.length === 0) return;
      await Promise.all(
        users.map((u) =>
          syncUserAuthMetadata(u.id, {
            tenant_id: this.tenantId,
            role: role.name,
            permissions: role.permissions,
            full_name: u.full_name ?? null,
          })
        )
      );
    } catch (err) {
      console.error('Failed to fan-out metadata for role', role.id, err);
    }
  }

  /**
   * Get all system roles
   */
  async getSystemRoles(): Promise<Role[]> {
    const rows = await this.repository.getSystemRoles(this.tenantId);
    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get all custom (non-system) roles
   */
  async getCustomRoles(): Promise<Role[]> {
    const rows = await this.repository.getCustomRoles(this.tenantId);
    return rows.map((row) => this.mapRow(row));
  }
}
