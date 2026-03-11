import { describe, it, expect } from 'vitest';
import { RoleService, RoleError } from '../../src/services/role.service';

/**
 * Unit tests for RoleService pure business logic.
 * Tests error class and constructor — no DB mocks needed.
 */

const roleService = new (RoleService as any)(null, 'test-tenant');

// ==========================================================================
// RoleError
// ==========================================================================

describe('RoleError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new RoleError('bad role', 'BAD_ROLE');
    expect(err.message).toBe('bad role');
    expect(err.code).toBe('BAD_ROLE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('RoleError');
  });

  it('allows overriding statusCode', () => {
    const err = new RoleError('not found', 'ROLE_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new RoleError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new RoleError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('RoleError');
  });
});

// ==========================================================================
// RoleError — all error codes used in service
// ==========================================================================

describe('RoleError specific codes', () => {
  it('creates ROLE_NOT_FOUND error', () => {
    const err = new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
    expect(err.code).toBe('ROLE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates ROLE_NAME_EXISTS error', () => {
    const err = new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
    expect(err.code).toBe('ROLE_NAME_EXISTS');
    expect(err.statusCode).toBe(400);
  });

  it('creates SYSTEM_ROLE error', () => {
    const err = new RoleError('Cannot modify system roles', 'SYSTEM_ROLE');
    expect(err.code).toBe('SYSTEM_ROLE');
    expect(err.statusCode).toBe(400);
  });

  it('creates CANNOT_DELETE error', () => {
    const err = new RoleError('Cannot delete role', 'CANNOT_DELETE');
    expect(err.code).toBe('CANNOT_DELETE');
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new RoleError('Failed to update role', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('RoleService constructor', () => {
  it('stores tenantId', () => {
    expect(roleService.tenantId).toBe('test-tenant');
  });

  it('initializes repository', () => {
    expect(roleService.repository).toBeDefined();
  });
});

// ==========================================================================
// mapRow — permission normalization edge cases
// ==========================================================================

describe('RoleService.mapRow', () => {
  const mapRow = (row: Record<string, unknown>) => roleService.mapRow(row);

  it('maps a valid role row with array permissions', () => {
    const row = {
      id: 'role-1',
      tenant_id: 'test-tenant',
      name: 'Admin',
      permissions: ['users:read', 'users:write'],
      is_system: true,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result).toEqual({
      id: 'role-1',
      tenant_id: 'test-tenant',
      name: 'Admin',
      permissions: ['users:read', 'users:write'],
      is_system: true,
      created_at: '2025-01-01T00:00:00Z',
    });
  });

  it('normalizes null permissions to empty array', () => {
    const row = {
      id: 'role-2',
      tenant_id: 'test-tenant',
      name: 'Empty',
      permissions: null,
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result.permissions).toEqual([]);
  });

  it('normalizes undefined permissions to empty array', () => {
    const row = {
      id: 'role-3',
      tenant_id: 'test-tenant',
      name: 'NoPerms',
      permissions: undefined,
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result.permissions).toEqual([]);
  });

  it('normalizes string permissions to empty array', () => {
    const row = {
      id: 'role-4',
      tenant_id: 'test-tenant',
      name: 'StringPerms',
      permissions: 'not-an-array',
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result.permissions).toEqual([]);
  });

  it('normalizes object permissions to empty array', () => {
    const row = {
      id: 'role-5',
      tenant_id: 'test-tenant',
      name: 'ObjPerms',
      permissions: { read: true },
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result.permissions).toEqual([]);
  });

  it('preserves empty array permissions', () => {
    const row = {
      id: 'role-6',
      tenant_id: 'test-tenant',
      name: 'EmptyArr',
      permissions: [],
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    const result = mapRow(row);
    expect(result.permissions).toEqual([]);
  });

  it('preserves is_system flag correctly', () => {
    const systemRow = {
      id: 'role-sys',
      tenant_id: 'test-tenant',
      name: 'System',
      permissions: [],
      is_system: true,
      created_at: '2025-01-01T00:00:00Z',
    };
    const customRow = {
      id: 'role-custom',
      tenant_id: 'test-tenant',
      name: 'Custom',
      permissions: [],
      is_system: false,
      created_at: '2025-01-01T00:00:00Z',
    };
    expect(mapRow(systemRow).is_system).toBe(true);
    expect(mapRow(customRow).is_system).toBe(false);
  });
});
