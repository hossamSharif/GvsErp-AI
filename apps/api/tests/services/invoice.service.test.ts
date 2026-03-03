import { describe, it, expect } from 'vitest';
import { InvoiceService, InvoiceError } from '../../src/services/invoice.service';

/**
 * Unit tests for InvoiceService pure business logic.
 * No mocks needed — only tests private helpers via (instance as any).
 */

const invoiceService = new (InvoiceService as any)(null, 'test-tenant');

// ==========================================================================
// InvoiceError
// ==========================================================================

describe('InvoiceError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new InvoiceError('something went wrong', 'SOME_CODE');
    expect(err.message).toBe('something went wrong');
    expect(err.code).toBe('SOME_CODE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('InvoiceError');
  });

  it('allows overriding statusCode', () => {
    const err = new InvoiceError('not found', 'NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new InvoiceError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });
});

// ==========================================================================
// calculateLineTotal
// ==========================================================================

describe('InvoiceService.calculateLineTotal', () => {
  it('calculates basic total with no discount and no tax', () => {
    expect(invoiceService.calculateLineTotal(2, 50, 0, 0)).toBe(100);
  });

  it('calculates with single item', () => {
    expect(invoiceService.calculateLineTotal(1, 100, 0, 0)).toBe(100);
  });

  it('applies discount percentage', () => {
    expect(invoiceService.calculateLineTotal(1, 100, 10, 0)).toBe(90);
  });

  it('applies tax rate', () => {
    expect(invoiceService.calculateLineTotal(1, 100, 0, 20)).toBe(120);
  });

  it('applies both discount and tax', () => {
    // 2 * 100 * (1 - 0.10) * (1 + 0.10) = 2 * 100 * 0.9 * 1.1 = 198
    expect(invoiceService.calculateLineTotal(2, 100, 10, 10)).toBe(198);
  });

  it('rounds to 2 decimal places', () => {
    // 3 * 33.333 * 1 * 1 = 99.999 -> rounds to 100.00
    expect(invoiceService.calculateLineTotal(3, 33.333, 0, 0)).toBe(100);
  });

  it('handles floating-point rounding for tax', () => {
    // 1 * 10 * 1 * 1.05 = 10.5
    expect(invoiceService.calculateLineTotal(1, 10, 0, 5)).toBe(10.5);
  });

  it('returns 0 for zero quantity', () => {
    expect(invoiceService.calculateLineTotal(0, 100, 50, 20)).toBe(0);
  });

  it('returns 0 for 100% discount', () => {
    expect(invoiceService.calculateLineTotal(1, 100, 100, 20)).toBe(0);
  });

  it('returns 0 for zero unit price', () => {
    expect(invoiceService.calculateLineTotal(5, 0, 10, 15)).toBe(0);
  });

  it('handles large quantities correctly', () => {
    // 1000 * 99.99 * 1 * 1 = 99990
    expect(invoiceService.calculateLineTotal(1000, 99.99, 0, 0)).toBe(99990);
  });

  it('handles small fractional prices', () => {
    // 1 * 0.01 * 1 * 1 = 0.01
    expect(invoiceService.calculateLineTotal(1, 0.01, 0, 0)).toBe(0.01);
  });

  it('handles discount + tax that produces sub-cent result', () => {
    // 1 * 33.33 * 0.85 * 1.07 = 1 * 33.33 * 0.9095 = 30.313635 -> 30.31
    expect(invoiceService.calculateLineTotal(1, 33.33, 15, 7)).toBe(30.31);
  });
});

// ==========================================================================
// mapSortField
// ==========================================================================

describe('InvoiceService.mapSortField', () => {
  it('maps invoiceNumber to invoice_number', () => {
    expect(invoiceService.mapSortField('invoiceNumber')).toBe('invoice_number');
  });

  it('maps createdAt to created_at', () => {
    expect(invoiceService.mapSortField('createdAt')).toBe('created_at');
  });

  it('maps finalizedAt to finalized_at', () => {
    expect(invoiceService.mapSortField('finalizedAt')).toBe('finalized_at');
  });

  it('maps total to total', () => {
    expect(invoiceService.mapSortField('total')).toBe('total');
  });

  it('maps status to status', () => {
    expect(invoiceService.mapSortField('status')).toBe('status');
  });

  it('defaults to created_at when undefined', () => {
    expect(invoiceService.mapSortField(undefined)).toBe('created_at');
  });

  it('defaults to created_at for unknown field', () => {
    expect(invoiceService.mapSortField('unknownField')).toBe('created_at');
  });

  it('defaults to created_at for empty string', () => {
    expect(invoiceService.mapSortField('')).toBe('created_at');
  });
});
