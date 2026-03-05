import { describe, it, expect } from 'vitest';
import { SettingsService, SettingsError } from '../../src/services/settings.service';

/**
 * Unit tests for SettingsService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
 */

const settingsService = new (SettingsService as any)(null, 'test-tenant');

// ==========================================================================
// SettingsError
// ==========================================================================

describe('SettingsError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new SettingsError('bad input', 'BAD_INPUT');
    expect(err.message).toBe('bad input');
    expect(err.code).toBe('BAD_INPUT');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('SettingsError');
  });

  it('allows overriding statusCode', () => {
    const err = new SettingsError('server error', 'SERVER_ERROR', 500);
    expect(err.statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    const err = new SettingsError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new SettingsError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('SettingsError');
  });
});

// ==========================================================================
// SettingsError — all error codes used in service
// ==========================================================================

describe('SettingsError specific codes', () => {
  it('creates FETCH_FAILED error', () => {
    const err = new SettingsError('Failed to fetch settings', 'FETCH_FAILED', 500);
    expect(err.code).toBe('FETCH_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates TENANT_NOT_FOUND error', () => {
    const err = new SettingsError('Tenant not found', 'TENANT_NOT_FOUND', 404);
    expect(err.code).toBe('TENANT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new SettingsError('Failed to update', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates RESET_FAILED error', () => {
    const err = new SettingsError('Failed to reset', 'RESET_FAILED', 500);
    expect(err.code).toBe('RESET_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('SettingsService constructor', () => {
  it('stores tenantId', () => {
    expect(settingsService.tenantId).toBe('test-tenant');
  });

  it('stores supabase client', () => {
    expect(settingsService.supabase).toBeDefined();
  });
});
