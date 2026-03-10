import { describe, it, expect } from 'vitest';
import { PaymentService, PaymentError } from '../../src/services/payment.service';

/**
 * Unit tests for PaymentService pure business logic.
 * Tests private helpers via (instance as any) — no DB mocks needed.
 */

const paymentService = new (PaymentService as any)(null, 'test-tenant');

// ==========================================================================
// PaymentError
// ==========================================================================

describe('PaymentError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new PaymentError('bad payment', 'BAD_PAYMENT');
    expect(err.message).toBe('bad payment');
    expect(err.code).toBe('BAD_PAYMENT');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('PaymentError');
  });

  it('allows overriding statusCode', () => {
    const err = new PaymentError('not found', 'NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new PaymentError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });
});

// ==========================================================================
// PaymentError — all error codes used in service
// ==========================================================================

describe('PaymentError specific codes', () => {
  it('creates PAYMENT_NOT_FOUND error', () => {
    const err = new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    expect(err.code).toBe('PAYMENT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates PARTY_NOT_FOUND error', () => {
    const err = new PaymentError('Party not found', 'PARTY_NOT_FOUND', 404);
    expect(err.code).toBe('PARTY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates INVOICE_NOT_FOUND error', () => {
    const err = new PaymentError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    expect(err.code).toBe('INVOICE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates INVOICE_NOT_FINAL error', () => {
    const err = new PaymentError('Invoice must be finalized', 'INVOICE_NOT_FINAL');
    expect(err.code).toBe('INVOICE_NOT_FINAL');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVOICE_PARTY_MISMATCH error', () => {
    const err = new PaymentError('Invoice does not belong to this party', 'INVOICE_PARTY_MISMATCH');
    expect(err.code).toBe('INVOICE_PARTY_MISMATCH');
    expect(err.statusCode).toBe(400);
  });

  it('creates CREATE_FAILED error', () => {
    const err = new PaymentError('Failed to create payment', 'CREATE_FAILED', 500);
    expect(err.code).toBe('CREATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new PaymentError('Failed to update payment', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates DELETE_FAILED error', () => {
    const err = new PaymentError('Failed to delete payment', 'DELETE_FAILED', 500);
    expect(err.code).toBe('DELETE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// validatePaymentType
// ==========================================================================

describe('PaymentService.validatePaymentType', () => {
  it('accepts received payment from customer', () => {
    expect(() =>
      paymentService.validatePaymentType('received', 'customer')
    ).not.toThrow();
  });

  it('accepts made payment to supplier', () => {
    expect(() =>
      paymentService.validatePaymentType('made', 'supplier')
    ).not.toThrow();
  });

  it('rejects received payment from supplier', () => {
    expect(() =>
      paymentService.validatePaymentType('received', 'supplier')
    ).toThrow(PaymentError);
    expect(() =>
      paymentService.validatePaymentType('received', 'supplier')
    ).toThrow('Payment received should be from a customer');
  });

  it('rejects made payment to customer', () => {
    expect(() =>
      paymentService.validatePaymentType('made', 'customer')
    ).toThrow(PaymentError);
    expect(() =>
      paymentService.validatePaymentType('made', 'customer')
    ).toThrow('Payment made should be to a supplier');
  });

  it('sets INVALID_PAYMENT_TYPE error code on rejection', () => {
    expect.assertions(2);
    try {
      paymentService.validatePaymentType('received', 'supplier');
    } catch (err) {
      expect((err as PaymentError).code).toBe('INVALID_PAYMENT_TYPE');
      expect((err as PaymentError).statusCode).toBe(400);
    }
  });
});

// ==========================================================================
// mapRow
// ==========================================================================

describe('PaymentService.mapRow', () => {
  const sampleRow = {
    id: 'pay-1',
    tenant_id: 'tenant-1',
    party_id: 'party-1',
    type: 'received',
    amount: '1500.50',
    currency: 'USD',
    exchange_rate: '1.00',
    payment_method: 'bank_transfer',
    reference: 'RCV-00001',
    invoice_id: 'inv-1',
    notes: 'First payment',
    payment_date: '2026-01-15',
    created_by: 'user-1',
    created_at: '2026-01-15T10:00:00Z',
  };

  it('maps snake_case to camelCase', () => {
    const result = paymentService.mapRow(sampleRow);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.partyId).toBe('party-1');
    expect(result.paymentMethod).toBe('bank_transfer');
    expect(result.invoiceId).toBe('inv-1');
    expect(result.paymentDate).toBe('2026-01-15');
    expect(result.createdBy).toBe('user-1');
    expect(result.createdAt).toBe('2026-01-15T10:00:00Z');
  });

  it('converts amount string to number', () => {
    const result = paymentService.mapRow(sampleRow);
    expect(result.amount).toBe(1500.50);
    expect(typeof result.amount).toBe('number');
  });

  it('converts exchange_rate string to number', () => {
    const result = paymentService.mapRow(sampleRow);
    expect(result.exchangeRate).toBe(1.00);
    expect(typeof result.exchangeRate).toBe('number');
  });

  it('preserves null fields', () => {
    const rowWithNulls = { ...sampleRow, invoice_id: null, notes: null };
    const result = paymentService.mapRow(rowWithNulls);
    expect(result.invoiceId).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('handles zero amount', () => {
    const row = { ...sampleRow, amount: '0' };
    const result = paymentService.mapRow(row);
    expect(result.amount).toBe(0);
  });

  it('handles large amounts', () => {
    const row = { ...sampleRow, amount: '999999999.99' };
    const result = paymentService.mapRow(row);
    expect(result.amount).toBe(999999999.99);
  });
});

// ==========================================================================
// mapSortField
// ==========================================================================

describe('PaymentService.mapSortField', () => {
  it('maps paymentDate to payment_date', () => {
    expect(paymentService.mapSortField('paymentDate')).toBe('payment_date');
  });

  it('maps amount to amount', () => {
    expect(paymentService.mapSortField('amount')).toBe('amount');
  });

  it('maps createdAt to created_at', () => {
    expect(paymentService.mapSortField('createdAt')).toBe('created_at');
  });

  it('defaults to payment_date when undefined', () => {
    expect(paymentService.mapSortField(undefined)).toBe('payment_date');
  });

  it('defaults to payment_date for unknown field', () => {
    expect(paymentService.mapSortField('unknownField')).toBe('payment_date');
  });

  it('defaults to payment_date for empty string', () => {
    expect(paymentService.mapSortField('')).toBe('payment_date');
  });
});
