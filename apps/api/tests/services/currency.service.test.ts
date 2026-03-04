import { describe, it, expect } from 'vitest';
import { CurrencyService, CurrencyError } from '../../src/services/currency.service';

/**
 * Unit tests for CurrencyService pure business logic.
 * Tests error class and constructor — no DB mocks needed.
 */

const currencyService = new (CurrencyService as any)(null, 'test-tenant');

// ==========================================================================
// CurrencyError
// ==========================================================================

describe('CurrencyError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new CurrencyError('bad currency', 'BAD_CURRENCY');
    expect(err.message).toBe('bad currency');
    expect(err.code).toBe('BAD_CURRENCY');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('CurrencyError');
  });

  it('allows overriding statusCode', () => {
    const err = new CurrencyError('not found', 'CURRENCY_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new CurrencyError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new CurrencyError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('CurrencyError');
  });
});

// ==========================================================================
// CurrencyError — all error codes used in service
// ==========================================================================

describe('CurrencyError specific codes', () => {
  it('creates CURRENCY_NOT_FOUND error', () => {
    const err = new CurrencyError('Currency not found', 'CURRENCY_NOT_FOUND', 404);
    expect(err.code).toBe('CURRENCY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates CURRENCY_CODE_EXISTS error', () => {
    const err = new CurrencyError('A currency with this code already exists', 'CURRENCY_CODE_EXISTS');
    expect(err.code).toBe('CURRENCY_CODE_EXISTS');
    expect(err.statusCode).toBe(400);
  });

  it('creates CANNOT_DELETE_DEFAULT error', () => {
    const err = new CurrencyError('Cannot delete the default currency', 'CANNOT_DELETE_DEFAULT');
    expect(err.code).toBe('CANNOT_DELETE_DEFAULT');
    expect(err.statusCode).toBe(400);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new CurrencyError('Failed to update currency', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates NO_DEFAULT_CURRENCY error', () => {
    const err = new CurrencyError('No default currency set', 'NO_DEFAULT_CURRENCY', 404);
    expect(err.code).toBe('NO_DEFAULT_CURRENCY');
    expect(err.statusCode).toBe(404);
  });

  it('creates SET_DEFAULT_FAILED error', () => {
    const err = new CurrencyError('Failed to set default currency', 'SET_DEFAULT_FAILED', 500);
    expect(err.code).toBe('SET_DEFAULT_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates DELETE_FAILED error', () => {
    const err = new CurrencyError('Failed to delete currency', 'DELETE_FAILED', 500);
    expect(err.code).toBe('DELETE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('CurrencyService constructor', () => {
  it('stores tenantId', () => {
    expect(currencyService.tenantId).toBe('test-tenant');
  });

  it('initializes repository', () => {
    expect(currencyService.repository).toBeDefined();
  });
});
