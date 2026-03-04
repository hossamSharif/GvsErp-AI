import { describe, it, expect } from 'vitest';
import { ExchangeRateService, ExchangeRateError } from '../../src/services/exchange-rate.service';

/**
 * Unit tests for ExchangeRateService pure business logic.
 * Tests error class and constructor — no DB mocks needed.
 */

const exchangeRateService = new (ExchangeRateService as any)(null, 'test-tenant');

// ==========================================================================
// ExchangeRateError
// ==========================================================================

describe('ExchangeRateError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new ExchangeRateError('bad rate', 'BAD_RATE');
    expect(err.message).toBe('bad rate');
    expect(err.code).toBe('BAD_RATE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('ExchangeRateError');
  });

  it('allows overriding statusCode', () => {
    const err = new ExchangeRateError('not found', 'RATE_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new ExchangeRateError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new ExchangeRateError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ExchangeRateError');
  });
});

// ==========================================================================
// ExchangeRateError — all error codes used in service
// ==========================================================================

describe('ExchangeRateError specific codes', () => {
  it('creates RATE_NOT_FOUND error', () => {
    const err = new ExchangeRateError('Exchange rate not found', 'RATE_NOT_FOUND', 404);
    expect(err.code).toBe('RATE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates RATE_EXISTS error', () => {
    const err = new ExchangeRateError('Rate already exists', 'RATE_EXISTS');
    expect(err.code).toBe('RATE_EXISTS');
    expect(err.statusCode).toBe(400);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new ExchangeRateError('Failed to update', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('ExchangeRateService constructor', () => {
  it('stores tenantId', () => {
    expect(exchangeRateService.tenantId).toBe('test-tenant');
  });

  it('initializes repository', () => {
    expect(exchangeRateService.repository).toBeDefined();
  });
});
