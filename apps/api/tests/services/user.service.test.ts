import { describe, it, expect } from 'vitest';
import { UserService, UserError } from '../../src/services/user.service';

/**
 * Unit tests for UserService pure business logic.
 * Tests error class, mapUser, constructor — no DB mocks needed.
 */

const userService = new (UserService as any)(null, 'test-tenant');

// ==========================================================================
// UserError
// ==========================================================================

describe('UserError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new UserError('bad user', 'BAD_USER');
    expect(err.message).toBe('bad user');
    expect(err.code).toBe('BAD_USER');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('UserError');
  });

  it('allows overriding statusCode', () => {
    const err = new UserError('not found', 'USER_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new UserError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new UserError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('UserError');
  });
});

// ==========================================================================
// UserError — all error codes used in service
// ==========================================================================

describe('UserError specific codes', () => {
  it('creates USER_NOT_FOUND error', () => {
    const err = new UserError('User not found', 'USER_NOT_FOUND', 404);
    expect(err.code).toBe('USER_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates EMAIL_EXISTS error', () => {
    const err = new UserError('A user with this email already exists', 'EMAIL_EXISTS', 400);
    expect(err.code).toBe('EMAIL_EXISTS');
  });

  it('creates AUTH_CREATE_FAILED error', () => {
    const err = new UserError('Failed to create auth user: test', 'AUTH_CREATE_FAILED', 500);
    expect(err.code).toBe('AUTH_CREATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates USER_CREATE_FAILED error', () => {
    const err = new UserError('Failed to create user record', 'USER_CREATE_FAILED', 500);
    expect(err.code).toBe('USER_CREATE_FAILED');
  });

  it('creates AUTH_UPDATE_FAILED error', () => {
    const err = new UserError('Failed to update auth email: test', 'AUTH_UPDATE_FAILED', 500);
    expect(err.code).toBe('AUTH_UPDATE_FAILED');
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new UserError('Failed to update user', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
  });

  it('creates DELETE_FAILED error', () => {
    const err = new UserError('Failed to delete user', 'DELETE_FAILED', 500);
    expect(err.code).toBe('DELETE_FAILED');
  });

  it('creates AUTH_DELETE_FAILED error', () => {
    const err = new UserError('Failed to delete auth user: test', 'AUTH_DELETE_FAILED', 500);
    expect(err.code).toBe('AUTH_DELETE_FAILED');
  });

  it('creates PASSWORD_CHANGE_FAILED error', () => {
    const err = new UserError('Failed to change password: test', 'PASSWORD_CHANGE_FAILED', 500);
    expect(err.code).toBe('PASSWORD_CHANGE_FAILED');
  });

  it('creates PASSWORD_RESET_FAILED error', () => {
    const err = new UserError('Failed to send password reset email: test', 'PASSWORD_RESET_FAILED', 500);
    expect(err.code).toBe('PASSWORD_RESET_FAILED');
  });
});

// ==========================================================================
// mapUser — DB row → API user type
// ==========================================================================

describe('UserService.mapUser', () => {
  it('maps all fields with role', () => {
    const row = {
      id: 'u-1',
      tenant_id: 'tenant-1',
      email: 'test@example.com',
      full_name: 'Test User',
      role_id: 'r-1',
      role: {
        id: 'r-1',
        tenant_id: 'tenant-1',
        name: 'Admin',
        permissions: ['*'],
        is_system: true,
        created_at: '2025-01-01T00:00:00Z',
      },
      preferences: { language: 'en', theme: 'dark' },
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    };

    const result = userService.mapUser(row);

    expect(result.id).toBe('u-1');
    expect(result.email).toBe('test@example.com');
    expect(result.full_name).toBe('Test User');
    expect(result.role).toEqual({
      id: 'r-1',
      tenant_id: 'tenant-1',
      name: 'Admin',
      permissions: ['*'],
      is_system: true,
      created_at: '2025-01-01T00:00:00Z',
    });
    expect(result.preferences).toEqual({ language: 'en', theme: 'dark' });
    expect(result.is_active).toBe(true);
  });

  it('handles null role', () => {
    const row = {
      id: 'u-2',
      tenant_id: 'tenant-1',
      email: 'norole@example.com',
      full_name: null,
      role_id: null,
      role: null,
      preferences: null,
      is_active: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = userService.mapUser(row);

    expect(result.full_name).toBeNull();
    expect(result.role_id).toBeNull();
    expect(result.role).toBeNull();
    expect(result.preferences).toEqual({});
    expect(result.is_active).toBe(false);
  });

  it('handles missing full_name gracefully', () => {
    const row = {
      id: 'u-3',
      tenant_id: 'tenant-1',
      email: 'noname@example.com',
      full_name: undefined,
      role_id: null,
      role: null,
      preferences: {},
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = userService.mapUser(row);
    expect(result.full_name).toBeNull();
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('UserService constructor', () => {
  it('stores tenantId', () => {
    expect(userService.tenantId).toBe('test-tenant');
  });

  it('initializes userRepository', () => {
    expect(userService.userRepository).toBeDefined();
  });
});
