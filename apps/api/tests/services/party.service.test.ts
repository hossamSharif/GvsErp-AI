import { describe, it, expect } from 'vitest';
import { PartyService, PartyError } from '../../src/services/party.service';

/**
 * Unit tests for PartyService pure business logic.
 * Tests error class, mapRow, mapSortField — no DB mocks needed.
 */

const partyService = new (PartyService as any)(null, 'test-tenant');

// ==========================================================================
// PartyError
// ==========================================================================

describe('PartyError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new PartyError('bad party', 'BAD_PARTY');
    expect(err.message).toBe('bad party');
    expect(err.code).toBe('BAD_PARTY');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('PartyError');
  });

  it('allows overriding statusCode', () => {
    const err = new PartyError('not found', 'PARTY_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new PartyError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new PartyError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('PartyError');
  });

  it('supports 500 server error status', () => {
    const err = new PartyError('update failed', 'UPDATE_FAILED', 500);
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// PartyError — all error codes used in service
// ==========================================================================

describe('PartyError specific codes', () => {
  it('creates PARTY_NOT_FOUND error', () => {
    const err = new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    expect(err.code).toBe('PARTY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates EMAIL_DUPLICATE error', () => {
    const err = new PartyError(
      'A customer with this email already exists',
      'EMAIL_DUPLICATE',
      400
    );
    expect(err.code).toBe('EMAIL_DUPLICATE');
    expect(err.statusCode).toBe(400);
  });

  it('creates HAS_TRANSACTIONS error', () => {
    const err = new PartyError(
      'Cannot delete party with existing transactions. Deactivate instead.',
      'HAS_TRANSACTIONS',
      400
    );
    expect(err.code).toBe('HAS_TRANSACTIONS');
    expect(err.statusCode).toBe(400);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new PartyError('Failed to update party', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates DELETE_FAILED error', () => {
    const err = new PartyError('Failed to delete party', 'DELETE_FAILED', 500);
    expect(err.code).toBe('DELETE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates RECALCULATE_FAILED error', () => {
    const err = new PartyError('Failed to recalculate balance', 'RECALCULATE_FAILED', 500);
    expect(err.code).toBe('RECALCULATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates SUMMARY_FAILED error', () => {
    const err = new PartyError('Failed to get balance summary', 'SUMMARY_FAILED', 500);
    expect(err.code).toBe('SUMMARY_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// mapRow — DB row → camelCase Party
// ==========================================================================

describe('PartyService.mapRow', () => {
  it('maps all fields from snake_case to camelCase', () => {
    const row = {
      id: 'p-1',
      tenant_id: 'tenant-1',
      type: 'customer',
      name: 'Acme Corp',
      email: 'acme@example.com',
      phone: '+1234567890',
      address: '123 Main St',
      tax_number: 'TAX-001',
      balance: '1500.50',
      is_active: true,
      notes: 'VIP customer',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    };

    const result = partyService.mapRow(row);

    expect(result).toEqual({
      id: 'p-1',
      tenantId: 'tenant-1',
      type: 'customer',
      name: 'Acme Corp',
      email: 'acme@example.com',
      phone: '+1234567890',
      address: '123 Main St',
      taxNumber: 'TAX-001',
      balance: 1500.5,
      isActive: true,
      notes: 'VIP customer',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    });
  });

  it('handles null optional fields', () => {
    const row = {
      id: 'p-2',
      tenant_id: 'tenant-1',
      type: 'supplier',
      name: 'Supplier Inc',
      email: null,
      phone: null,
      address: null,
      tax_number: null,
      balance: null,
      is_active: false,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = partyService.mapRow(row);

    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.taxNumber).toBeNull();
    expect(result.balance).toBe(0);
    expect(result.notes).toBeNull();
    expect(result.isActive).toBe(false);
  });

  it('coerces string balance to number', () => {
    const row = {
      id: 'p-3',
      tenant_id: 'tenant-1',
      type: 'customer',
      name: 'Test',
      email: null,
      phone: null,
      address: null,
      tax_number: null,
      balance: '999.99',
      is_active: true,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    expect(partyService.mapRow(row).balance).toBe(999.99);
    expect(typeof partyService.mapRow(row).balance).toBe('number');
  });

  it('handles zero balance', () => {
    const row = {
      id: 'p-4',
      tenant_id: 'tenant-1',
      type: 'supplier',
      name: 'Zero',
      email: null,
      phone: null,
      address: null,
      tax_number: null,
      balance: 0,
      is_active: true,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    expect(partyService.mapRow(row).balance).toBe(0);
  });
});

// ==========================================================================
// mapSortField — API field name → DB column
// ==========================================================================

describe('PartyService.mapSortField', () => {
  it('maps "name" to "name"', () => {
    expect(partyService.mapSortField('name')).toBe('name');
  });

  it('maps "balance" to "balance"', () => {
    expect(partyService.mapSortField('balance')).toBe('balance');
  });

  it('maps "createdAt" to "created_at"', () => {
    expect(partyService.mapSortField('createdAt')).toBe('created_at');
  });

  it('maps "updatedAt" to "updated_at"', () => {
    expect(partyService.mapSortField('updatedAt')).toBe('updated_at');
  });

  it('defaults to "name" for undefined', () => {
    expect(partyService.mapSortField(undefined)).toBe('name');
  });

  it('defaults to "name" for unknown field', () => {
    expect(partyService.mapSortField('unknown')).toBe('name');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('PartyService constructor', () => {
  it('stores tenantId', () => {
    expect(partyService.tenantId).toBe('test-tenant');
  });

  it('initializes partyRepository', () => {
    expect(partyService.partyRepository).toBeDefined();
  });
});
