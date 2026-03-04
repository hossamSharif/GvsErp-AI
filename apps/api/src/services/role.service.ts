/**
 * Role Service
 *
 * Business logic for role and permission management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { RoleRepository } from '../repositories/role.repository';
import type { QueryResult } from '../repositories/base.repository';

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

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repository = new RoleRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * List roles with pagination and filters
   */
  async getRoles(params: {
    page?: number;
    limit?: number;
    is_system?: boolean;
  }): Promise<QueryResult<any>> {
    return this.repository.findAllRoles({
      tenantId: this.tenantId,
      page: params.page || 1,
      limit: params.limit || 50,
      is_system: params.is_system,
    });
  }

  /**
   * Get a single role by ID
   */
  async getRole(id: string): Promise<any> {
    const role = await this.repository.findById(this.tenantId, id);
    if (!role) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
    return role;
  }

  /**
   * Create a new role
   */
  async createRole(input: { name: string; permissions: string[] }): Promise<any> {
    const nameExists = await this.repository.nameExists(this.tenantId, input.name);
    if (nameExists) {
      throw new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
    }

    return this.repository.create(this.tenantId, {
      name: input.name,
      permissions: input.permissions,
      is_system: false,
    });
  }

  /**
   * Update a role
   */
  async updateRole(id: string, input: { name?: string; permissions?: string[] }): Promise<any> {
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

    return role;
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
  async updatePermissions(id: string, permissions: string[]): Promise<any> {
    const role = await this.repository.updatePermissions(this.tenantId, id, permissions);
    if (!role) {
      throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    }
    return role;
  }

  /**
   * Get all system roles
   */
  async getSystemRoles(): Promise<any[]> {
    return this.repository.getSystemRoles(this.tenantId);
  }

  /**
   * Get all custom (non-system) roles
   */
  async getCustomRoles(): Promise<any[]> {
    return this.repository.getCustomRoles(this.tenantId);
  }
}
