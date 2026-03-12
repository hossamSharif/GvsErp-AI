import { describe, it, expect, vi } from 'vitest';
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

// ==========================================================================
// createCurrency — code uppercasing and duplicate check
// ==========================================================================

describe('CurrencyService.createCurrency', () => {
  it('uppercases currency code before creating', async () => {
    const svc = new (CurrencyService as any)(null, 'tenant-1');
    const createSpy = vi.fn().mockResolvedValue({ id: '1', code: 'USD', name: 'US Dollar' });
    svc.repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: createSpy,
    };

    await svc.createCurrency({ code: 'usd', name: 'US Dollar' });
    expect(createSpy).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ code: 'USD' }));
  });

  it('throws CURRENCY_CODE_EXISTS when code is taken', async () => {
    const svc = new (CurrencyService as any)(null, 'tenant-1');
    svc.repository = {
      codeExists: vi.fn().mockResolvedValue(true),
    };

    await expect(svc.createCurrency({ code: 'USD', name: 'US Dollar' }))
      .rejects.toThrow(CurrencyError);
  });

  it('defaults is_default to false', async () => {
    const svc = new (CurrencyService as any)(null, 'tenant-1');
    const createSpy = vi.fn().mockResolvedValue({ id: '1', code: 'EUR', name: 'Euro' });
    svc.repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: createSpy,
    };

    await svc.createCurrency({ code: 'EUR', name: 'Euro' });
    expect(createSpy).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ is_default: false }));
  });
});

// ==========================================================================
// deleteCurrency — default currency guard
// ==========================================================================

describe('CurrencyService.deleteCurrency', () => {
  it('throws CANNOT_DELETE_DEFAULT for default currency', async () => {
    const svc = new (CurrencyService as any)(null, 'tenant-1');
    svc.repository = {
      findById: vi.fn().mockResolvedValue({ id: '1', code: 'USD', is_default: true }),
    };

    await expect(svc.deleteCurrency('1')).rejects.toThrow('Cannot delete the default currency');
  });

  it('throws CURRENCY_NOT_FOUND when currency does not exist', async () => {
    const svc = new (CurrencyService as any)(null, 'tenant-1');
    svc.repository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    await expect(svc.deleteCurrency('nonexistent')).rejects.toThrow(CurrencyError);
  });
});
