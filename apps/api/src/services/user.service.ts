/**
 * User Service
 *
 * Business logic for user management including Supabase Auth integration,
 * role assignment, and user preferences.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { UserRepository, UserWithRole } from '../repositories/user.repository';
import type { User, UserWithRole as SharedUserWithRole, CreateUserInput, UpdateUserInput } from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for user-related operations
 */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'UserError';
  }
}

/**
 * Service for User business logic
 */
export class UserService {
  private readonly userRepository: UserRepository;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ) {
    this.supabase = supabase;
    this.userRepository = new UserRepository(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // USER CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of users with filters
   */
  async getUsers(params: {
    page?: number;
    limit?: number;
    roleId?: string;
    search?: string;
    includeInactive?: boolean;
  }): Promise<QueryResult<UserWithRole>> {
    return this.userRepository.findAllWithRoles({
      tenantId: this.tenantId,
      page: params.page || 1,
      limit: params.limit || 50,
      role_id: params.roleId,
      search: params.search,
      includeInactive: params.includeInactive,
    });
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: string): Promise<User> {
    const user = await this.userRepository.findByIdWithRole(this.tenantId, id);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    return this.mapUser(user);
  }

  /**
   * Create a new user with Supabase Auth
   */
  async createUser(input: CreateUserInput): Promise<User> {
    // Validate email uniqueness
    const emailExists = await this.userRepository.emailExists(
      this.tenantId,
      input.email
    );

    if (emailExists) {
      throw new UserError(
        'A user with this email already exists',
        'EMAIL_EXISTS',
        400
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: input.full_name,
        tenant_id: this.tenantId,
      },
    });

    if (authError || !authData.user) {
      throw new UserError(
        'Failed to create auth user',
        'AUTH_CREATE_FAILED',
        500
      );
    }

    try {
      // Create user record in database
      const userData = {
        id: authData.user.id,
        tenant_id: this.tenantId,
        email: input.email.toLowerCase(),
        full_name: input.full_name || null,
        role_id: input.role_id || null,
        preferences: input.preferences || {},
        is_active: true,
      };

      const user = await this.userRepository.create(this.tenantId, userData);

      return this.mapUser(user);
    } catch (error) {
      // Rollback: Delete auth user if database creation fails
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw new UserError(
        'Failed to create user record',
        'USER_CREATE_FAILED',
        500
      );
    }
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    // Check if user exists
    const existing = await this.userRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Validate email uniqueness if changed
    if (input.email && input.email !== existing.email) {
      const emailExists = await this.userRepository.emailExists(
        this.tenantId,
        input.email,
        id
      );

      if (emailExists) {
        throw new UserError(
          'A user with this email already exists',
          'EMAIL_EXISTS',
          400
        );
      }

      // Update email in Supabase Auth
      const { error: authError } = await this.supabase.auth.admin.updateUserById(
        id,
        { email: input.email }
      );

      if (authError) {
        throw new UserError(
          'Failed to update auth email',
          'AUTH_UPDATE_FAILED',
          500
        );
      }
    }

    // Update full_name in auth metadata if changed
    if (input.full_name && input.full_name !== existing.full_name) {
      await this.supabase.auth.admin.updateUserById(id, {
        user_metadata: {
          full_name: input.full_name,
        },
      });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (input.email) updates.email = input.email.toLowerCase();
    if (input.full_name !== undefined) updates.full_name = input.full_name;
    if (input.role_id !== undefined) updates.role_id = input.role_id;
    if (input.is_active !== undefined) updates.is_active = input.is_active;
    if (input.preferences !== undefined) {
      updates.preferences = {
        ...(existing.preferences as Record<string, unknown> || {}),
        ...input.preferences,
      };
    }

    const user = await this.userRepository.update(this.tenantId, id, updates);

    if (!user) {
      throw new UserError('Failed to update user', 'UPDATE_FAILED', 500);
    }

    return this.mapUser(user);
  }

  /**
   * Delete a user (soft delete by setting is_active = false)
   */
  async deleteUser(id: string): Promise<void> {
    const existing = await this.userRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Soft delete in database
    const deleted = await this.userRepository.delete(this.tenantId, id);
    if (!deleted) {
      throw new UserError('Failed to delete user', 'DELETE_FAILED', 500);
    }

    // Optionally delete from Supabase Auth (commented out for soft delete)
    // await this.supabase.auth.admin.deleteUser(id);
  }

  /**
   * Permanently delete a user (hard delete)
   */
  async permanentlyDeleteUser(id: string): Promise<void> {
    const existing = await this.userRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Delete from Supabase Auth
    const { error: authError } = await this.supabase.auth.admin.deleteUser(id);
    if (authError) {
      throw new UserError(
        'Failed to delete auth user',
        'AUTH_DELETE_FAILED',
        500
      );
    }

    // Database record will be deleted via CASCADE or trigger
  }

  // ==========================================================================
  // USER STATUS & PREFERENCES
  // ==========================================================================

  /**
   * Activate/deactivate user
   */
  async setUserActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.userRepository.setActive(this.tenantId, id, isActive);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    return this.mapUser(user);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    id: string,
    preferences: { language?: 'en' | 'ar'; theme?: 'light' | 'dark' }
  ): Promise<User> {
    const existing = await this.userRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    const updatedPreferences = {
      ...(existing.preferences as Record<string, unknown> || {}),
      ...preferences,
    };

    const user = await this.userRepository.updatePreferences(
      this.tenantId,
      id,
      updatedPreferences
    );

    if (!user) {
      throw new UserError('Failed to update preferences', 'UPDATE_FAILED', 500);
    }

    return this.mapUser(user);
  }

  /**
   * Change user password
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const existing = await this.userRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    const { error } = await this.supabase.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (error) {
      throw new UserError(
        'Failed to change password',
        'PASSWORD_CHANGE_FAILED',
        500
      );
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw new UserError(
        'Failed to send password reset email',
        'PASSWORD_RESET_FAILED',
        500
      );
    }
  }

  // ==========================================================================
  // ROLE MANAGEMENT
  // ==========================================================================

  /**
   * Update user role
   */
  async updateUserRole(id: string, roleId: string): Promise<User> {
    const user = await this.userRepository.updateRole(this.tenantId, id, roleId);

    if (!user) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    return this.mapUser(user);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleId: string): Promise<User[]> {
    const result = await this.userRepository.findAllWithRoles({
      tenantId: this.tenantId,
      role_id: roleId,
      limit: 1000,
    });

    return result.data.map((user) => this.mapUser(user));
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Map database user to API user type
   */
  private mapUser(user: any): SharedUserWithRole {
    return {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      full_name: user.full_name || null,
      role_id: user.role_id || null,
      role: user.role ? {
        id: user.role.id,
        tenant_id: user.role.tenant_id,
        name: user.role.name,
        permissions: user.role.permissions,
        is_system: user.role.is_system,
        created_at: user.role.created_at,
      } : null,
      preferences: user.preferences || {},
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
