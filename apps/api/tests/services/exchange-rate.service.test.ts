import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExchangeRateService, ExchangeRateError } from '../../src/services/exchange-rate.service';

/**
 * Unit tests for ExchangeRateService.
 * Tests error class, constructor, and service methods with mocked repository.
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

// ==========================================================================
// Service methods with mocked repository
// ==========================================================================

describe('ExchangeRateService.getRates', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  beforeEach(() => {
    svc.repository = {
      findAll: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1 } }),
    };
  });

  it('passes default params when none provided', async () => {
    await svc.getRates({});
    expect(svc.repository.findAll).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      page: 1,
      limit: 50,
      sort_by: 'effective_date',
      sort_order: 'desc',
    });
  });

  it('passes custom pagination params', async () => {
    await svc.getRates({ page: 3, limit: 10 });
    expect(svc.repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 10 })
    );
  });

  it('passes custom sort params', async () => {
    await svc.getRates({ sort_by: 'rate', sort_order: 'asc' });
    expect(svc.repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ sort_by: 'rate', sort_order: 'asc' })
    );
  });
});

describe('ExchangeRateService.getRate', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  it('returns rate when found', async () => {
    const mockRate = { id: 'rate-1', rate: 1.5 };
    svc.repository = { findById: vi.fn().mockResolvedValue(mockRate) };
    const result = await svc.getRate('rate-1');
    expect(result).toEqual(mockRate);
    expect(svc.repository.findById).toHaveBeenCalledWith('tenant-1', 'rate-1');
  });

  it('throws RATE_NOT_FOUND when not found', async () => {
    svc.repository = { findById: vi.fn().mockResolvedValue(null) };
    await expect(svc.getRate('missing-id')).rejects.toThrow(ExchangeRateError);
    await expect(svc.getRate('missing-id')).rejects.toThrow('Exchange rate not found');
  });
});

describe('ExchangeRateService.createRate', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  beforeEach(() => {
    svc.repository = {
      rateExists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({ id: 'new-rate' }),
    };
  });

  it('normalizes currency codes to uppercase', async () => {
    await svc.createRate({ from_currency: 'eur', to_currency: 'usd', rate: 1.1, effective_date: '2026-01-01' });
    expect(svc.repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      from_currency: 'EUR',
      to_currency: 'USD',
    }));
  });

  it('defaults to_currency to USD when not provided', async () => {
    await svc.createRate({ from_currency: 'GBP', rate: 1.3, effective_date: '2026-01-01' });
    expect(svc.repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      to_currency: 'USD',
    }));
  });

  it('defaults rate_type to formal when not provided', async () => {
    await svc.createRate({ from_currency: 'EUR', rate: 1.1, effective_date: '2026-01-01' });
    expect(svc.repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      rate_type: 'formal',
    }));
  });

  it('throws RATE_EXISTS when duplicate exists', async () => {
    svc.repository.rateExists = vi.fn().mockResolvedValue(true);
    await expect(svc.createRate({
      from_currency: 'EUR', rate: 1.1, effective_date: '2026-01-01',
    })).rejects.toThrow(ExchangeRateError);
  });

  it('passes rate_type black_market correctly', async () => {
    await svc.createRate({ from_currency: 'EUR', rate_type: 'black_market', rate: 1.5, effective_date: '2026-01-01' });
    expect(svc.repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      rate_type: 'black_market',
    }));
  });
});

describe('ExchangeRateService.updateRate', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');
  const existingRate = { id: 'rate-1', from_currency: 'EUR', to_currency: 'USD', rate_type: 'formal', effective_date: '2026-01-01' };

  beforeEach(() => {
    svc.repository = {
      findById: vi.fn().mockResolvedValue({ ...existingRate }),
      rateExists: vi.fn().mockResolvedValue(false),
      update: vi.fn().mockResolvedValue({ ...existingRate, rate: 1.2 }),
    };
  });

  it('throws RATE_NOT_FOUND for missing rate', async () => {
    svc.repository.findById = vi.fn().mockResolvedValue(null);
    await expect(svc.updateRate('missing', { rate: 1.5 })).rejects.toThrow('Exchange rate not found');
  });

  it('normalizes updated currency codes to uppercase', async () => {
    await svc.updateRate('rate-1', { from_currency: 'gbp' });
    expect(svc.repository.update).toHaveBeenCalledWith('tenant-1', 'rate-1', expect.objectContaining({
      from_currency: 'GBP',
    }));
  });

  it('checks for duplicates when key fields change', async () => {
    await svc.updateRate('rate-1', { from_currency: 'GBP' });
    expect(svc.repository.rateExists).toHaveBeenCalled();
  });

  it('skips duplicate check when only rate value changes', async () => {
    await svc.updateRate('rate-1', { rate: 1.5 });
    expect(svc.repository.rateExists).not.toHaveBeenCalled();
  });

  it('throws RATE_EXISTS when duplicate found on update', async () => {
    svc.repository.rateExists = vi.fn().mockResolvedValue(true);
    await expect(svc.updateRate('rate-1', { from_currency: 'GBP' })).rejects.toThrow('already exists');
  });

  it('throws UPDATE_FAILED when repository update returns null', async () => {
    svc.repository.update = vi.fn().mockResolvedValue(null);
    await expect(svc.updateRate('rate-1', { rate: 1.5 })).rejects.toThrow('Failed to update');
  });
});

describe('ExchangeRateService.deleteRate', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  it('succeeds when rate exists', async () => {
    svc.repository = { delete: vi.fn().mockResolvedValue(true) };
    await expect(svc.deleteRate('rate-1')).resolves.toBeUndefined();
    expect(svc.repository.delete).toHaveBeenCalledWith('tenant-1', 'rate-1');
  });

  it('throws RATE_NOT_FOUND when rate does not exist', async () => {
    svc.repository = { delete: vi.fn().mockResolvedValue(false) };
    await expect(svc.deleteRate('missing')).rejects.toThrow('Exchange rate not found');
  });
});

describe('ExchangeRateService.getLatestRate', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  it('normalizes currency codes and applies defaults', async () => {
    svc.repository = { getLatestRate: vi.fn().mockResolvedValue({ rate: 1.1 }) };
    await svc.getLatestRate({ from: 'eur' });
    expect(svc.repository.getLatestRate).toHaveBeenCalledWith('tenant-1', 'EUR', 'USD', 'formal', undefined);
  });

  it('passes custom to_currency and type', async () => {
    svc.repository = { getLatestRate: vi.fn().mockResolvedValue({ rate: 1.1 }) };
    await svc.getLatestRate({ from: 'EUR', to: 'gbp', type: 'black_market' });
    expect(svc.repository.getLatestRate).toHaveBeenCalledWith('tenant-1', 'EUR', 'GBP', 'black_market', undefined);
  });

  it('passes asOfDate when provided', async () => {
    svc.repository = { getLatestRate: vi.fn().mockResolvedValue({ rate: 1.1 }) };
    await svc.getLatestRate({ from: 'EUR', asOfDate: '2026-06-01' });
    expect(svc.repository.getLatestRate).toHaveBeenCalledWith('tenant-1', 'EUR', 'USD', 'formal', '2026-06-01');
  });

  it('throws RATE_NOT_FOUND when no rate available', async () => {
    svc.repository = { getLatestRate: vi.fn().mockResolvedValue(null) };
    await expect(svc.getLatestRate({ from: 'XYZ' })).rejects.toThrow('No exchange rate found');
  });
});

describe('ExchangeRateService.getRatesInRange', () => {
  const svc = new (ExchangeRateService as any)(null, 'tenant-1');

  it('normalizes currencies and applies defaults', async () => {
    svc.repository = { getRatesInRange: vi.fn().mockResolvedValue([]) };
    await svc.getRatesInRange({ from: 'eur', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(svc.repository.getRatesInRange).toHaveBeenCalledWith('tenant-1', 'EUR', 'USD', 'formal', '2026-01-01', '2026-12-31');
  });

  it('passes custom to_currency and type', async () => {
    svc.repository = { getRatesInRange: vi.fn().mockResolvedValue([{ rate: 1.1 }]) };
    const result = await svc.getRatesInRange({ from: 'EUR', to: 'gbp', type: 'black_market', startDate: '2026-01-01', endDate: '2026-06-01' });
    expect(svc.repository.getRatesInRange).toHaveBeenCalledWith('tenant-1', 'EUR', 'GBP', 'black_market', '2026-01-01', '2026-06-01');
    expect(result).toEqual([{ rate: 1.1 }]);
  });
});
