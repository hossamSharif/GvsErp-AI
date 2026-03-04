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
