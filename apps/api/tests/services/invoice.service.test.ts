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

  it('preserves stack trace', () => {
    const err = new InvoiceError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('InvoiceError');
  });

  it('creates WAREHOUSE_NOT_FOUND error', () => {
    const err = new InvoiceError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 400);
    expect(err.code).toBe('WAREHOUSE_NOT_FOUND');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVOICE_NOT_FOUND error with 404', () => {
    const err = new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    expect(err.code).toBe('INVOICE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates INVALID_STATUS error', () => {
    const err = new InvoiceError('Invalid status transition', 'INVALID_STATUS');
    expect(err.code).toBe('INVALID_STATUS');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVOICE_NOT_DRAFT error', () => {
    const err = new InvoiceError('Only draft invoices can be updated', 'INVOICE_NOT_DRAFT');
    expect(err.code).toBe('INVOICE_NOT_DRAFT');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVOICE_NO_ITEMS error', () => {
    const err = new InvoiceError('Invoice must have at least one item', 'INVOICE_NO_ITEMS');
    expect(err.code).toBe('INVOICE_NO_ITEMS');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVOICE_NOT_FINAL error', () => {
    const err = new InvoiceError('Only finalized invoices can be returned', 'INVOICE_NOT_FINAL');
    expect(err.code).toBe('INVOICE_NOT_FINAL');
    expect(err.statusCode).toBe(400);
  });

  it('creates ITEMS_NOT_FOUND error', () => {
    const err = new InvoiceError('Items not found: abc', 'ITEMS_NOT_FOUND');
    expect(err.code).toBe('ITEMS_NOT_FOUND');
    expect(err.statusCode).toBe(400);
  });

  it('creates INSUFFICIENT_STOCK error', () => {
    const err = new InvoiceError('Insufficient stock: item1', 'INSUFFICIENT_STOCK');
    expect(err.code).toBe('INSUFFICIENT_STOCK');
    expect(err.statusCode).toBe(400);
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

  it('handles negative quantity (credit/return scenario)', () => {
    // -1 * 100 * 1 * 1 = -100
    expect(invoiceService.calculateLineTotal(-1, 100, 0, 0)).toBe(-100);
  });

  it('handles discount over 100% resulting in negative value', () => {
    // 1 * 100 * (1 - 1.5) * 1 = -50
    expect(invoiceService.calculateLineTotal(1, 100, 150, 0)).toBe(-50);
  });

  it('handles very high tax rate', () => {
    // 1 * 100 * 1 * (1 + 2) = 300
    expect(invoiceService.calculateLineTotal(1, 100, 0, 200)).toBe(300);
  });

  it('handles combined high discount and high tax', () => {
    // 10 * 50 * (1 - 0.5) * (1 + 0.25) = 10 * 50 * 0.5 * 1.25 = 312.5
    expect(invoiceService.calculateLineTotal(10, 50, 50, 25)).toBe(312.5);
  });

  it('handles fractional quantity', () => {
    // 1.5 * 10 * 1 * 1 = 15
    expect(invoiceService.calculateLineTotal(1.5, 10, 0, 0)).toBe(15);
  });

  it('handles all parameters at extreme precision', () => {
    // 0.001 * 0.001 * (1 - 0) * (1 + 0) = 0.000001 -> rounds to 0
    expect(invoiceService.calculateLineTotal(0.001, 0.001, 0, 0)).toBe(0);
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

// ==========================================================================
// mapRowToInvoice
// ==========================================================================

describe('InvoiceService.mapRowToInvoice', () => {
  const sampleRow = {
    id: 'inv-1',
    tenant_id: 'tenant-1',
    invoice_number: 'INV-00001',
    type: 'sale',
    status: 'draft',
    party_id: 'party-1',
    warehouse_id: 'wh-1',
    subtotal: '1000.00',
    tax_amount: '100.00',
    discount_amount: '50.00',
    total: '1050.00',
    currency: 'USD',
    exchange_rate: '1.00',
    notes: 'Test invoice',
    created_by: 'user-1',
    returned_from_id: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T11:00:00Z',
    finalized_at: null,
  };

  it('maps snake_case to camelCase', () => {
    const result = invoiceService.mapRowToInvoice(sampleRow);
    expect(result.tenantId).toBe('tenant-1');
    expect(result.invoiceNumber).toBe('INV-00001');
    expect(result.partyId).toBe('party-1');
    expect(result.warehouseId).toBe('wh-1');
    expect(result.createdBy).toBe('user-1');
    expect(result.returnedFromId).toBeNull();
    expect(result.createdAt).toBe('2026-01-15T10:00:00Z');
    expect(result.updatedAt).toBe('2026-01-15T11:00:00Z');
    expect(result.finalizedAt).toBeNull();
  });

  it('converts numeric strings to numbers', () => {
    const result = invoiceService.mapRowToInvoice(sampleRow);
    expect(result.subtotal).toBe(1000);
    expect(typeof result.subtotal).toBe('number');
    expect(result.taxAmount).toBe(100);
    expect(typeof result.taxAmount).toBe('number');
    expect(result.discountAmount).toBe(50);
    expect(typeof result.discountAmount).toBe('number');
    expect(result.total).toBe(1050);
    expect(typeof result.total).toBe('number');
    expect(result.exchangeRate).toBe(1);
    expect(typeof result.exchangeRate).toBe('number');
  });

  it('preserves type and status as strings', () => {
    const result = invoiceService.mapRowToInvoice(sampleRow);
    expect(result.type).toBe('sale');
    expect(result.status).toBe('draft');
  });

  it('handles finalized invoice', () => {
    const row = { ...sampleRow, status: 'final', finalized_at: '2026-01-16T09:00:00Z' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.status).toBe('final');
    expect(result.finalizedAt).toBe('2026-01-16T09:00:00Z');
  });

  it('handles return invoice with returned_from_id', () => {
    const row = { ...sampleRow, type: 'sale_return', returned_from_id: 'inv-original' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.type).toBe('sale_return');
    expect(result.returnedFromId).toBe('inv-original');
  });

  it('handles zero amounts', () => {
    const row = { ...sampleRow, subtotal: '0', tax_amount: '0', discount_amount: '0', total: '0' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles large amounts', () => {
    const row = { ...sampleRow, total: '999999999.99' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.total).toBe(999999999.99);
  });

  it('preserves null notes', () => {
    const row = { ...sampleRow, notes: null };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.notes).toBeNull();
  });

  it('handles purchase type', () => {
    const row = { ...sampleRow, type: 'purchase' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.type).toBe('purchase');
  });

  it('preserves currency field', () => {
    const row = { ...sampleRow, currency: 'EUR' };
    const result = invoiceService.mapRowToInvoice(row);
    expect(result.currency).toBe('EUR');
  });
});
