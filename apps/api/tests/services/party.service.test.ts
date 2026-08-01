import { describe, it, expect } from 'vitest';
import {
  PartyService,
  PartyError,
  buildOpeningBalanceLines,
} from '../../src/services/party.service';
import {
  naturalDirection,
  toSignedOpeningBalance,
  fromSignedOpeningBalance,
} from '@erp/shared';

/**
 * Unit tests for PartyService pure business logic.
 * Tests error class, mapRow, mapSortField, opening balance sign conversion and
 * journal line construction — no DB mocks needed.
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
      // Defaulted for rows predating migrations 023 and 035 respectively.
      ledgerAccountId: null,
      openingBalance: 0,
      openingBalanceDate: null,
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

// ==========================================================================
// Opening balance sign convention
// ==========================================================================

describe('opening balance sign helpers', () => {
  it('treats debit as the natural direction for customers', () => {
    expect(naturalDirection('customer')).toBe('debit');
  });

  it('treats credit as the natural direction for suppliers', () => {
    expect(naturalDirection('supplier')).toBe('credit');
  });

  it('signs a customer debit balance positive (they owe us)', () => {
    expect(toSignedOpeningBalance('customer', 1000, 'debit')).toBe(1000);
  });

  it('signs a customer credit balance negative (advance held)', () => {
    expect(toSignedOpeningBalance('customer', 1000, 'credit')).toBe(-1000);
  });

  it('signs a supplier credit balance positive (we owe them)', () => {
    expect(toSignedOpeningBalance('supplier', 500, 'credit')).toBe(500);
  });

  it('signs a supplier debit balance negative (advance paid)', () => {
    expect(toSignedOpeningBalance('supplier', 500, 'debit')).toBe(-500);
  });

  it('ignores a negative magnitude, letting the direction carry the sign', () => {
    expect(toSignedOpeningBalance('customer', -1000, 'debit')).toBe(1000);
  });

  it('round-trips every party type and direction combination', () => {
    const types = ['customer', 'supplier'] as const;
    const directions = ['debit', 'credit'] as const;

    for (const type of types) {
      for (const direction of directions) {
        const signed = toSignedOpeningBalance(type, 250.75, direction);
        expect(fromSignedOpeningBalance(type, signed)).toEqual({
          amount: 250.75,
          direction,
        });
      }
    }
  });

  it('reports zero as the natural direction', () => {
    expect(fromSignedOpeningBalance('customer', 0)).toEqual({ amount: 0, direction: 'debit' });
    expect(fromSignedOpeningBalance('supplier', 0)).toEqual({ amount: 0, direction: 'credit' });
  });
});

// ==========================================================================
// Opening balance journal lines
// ==========================================================================

describe('buildOpeningBalanceLines', () => {
  const LEDGER = 'party-ledger-id';
  const EQUITY = 'opening-balance-equity-id';

  it('debits the party ledger when a customer owes more', () => {
    expect(buildOpeningBalanceLines('customer', 100, LEDGER, EQUITY)).toEqual([
      { account_id: LEDGER, debit: 100, credit: 0 },
      { account_id: EQUITY, debit: 0, credit: 100 },
    ]);
  });

  it('credits the party ledger when a customer owes less', () => {
    expect(buildOpeningBalanceLines('customer', -100, LEDGER, EQUITY)).toEqual([
      { account_id: EQUITY, debit: 100, credit: 0 },
      { account_id: LEDGER, debit: 0, credit: 100 },
    ]);
  });

  it('credits the party ledger when we owe a supplier more', () => {
    expect(buildOpeningBalanceLines('supplier', 100, LEDGER, EQUITY)).toEqual([
      { account_id: EQUITY, debit: 100, credit: 0 },
      { account_id: LEDGER, debit: 0, credit: 100 },
    ]);
  });

  it('debits the party ledger when we owe a supplier less', () => {
    expect(buildOpeningBalanceLines('supplier', -100, LEDGER, EQUITY)).toEqual([
      { account_id: LEDGER, debit: 100, credit: 0 },
      { account_id: EQUITY, debit: 0, credit: 100 },
    ]);
  });

  it('always balances, and never emits a zero/zero line (journal_lines CHECK)', () => {
    const cases: ['customer' | 'supplier', number][] = [
      ['customer', 100],
      ['customer', -100],
      ['supplier', 100],
      ['supplier', -100],
      ['customer', 0.014],
    ];

    for (const [type, delta] of cases) {
      const lines = buildOpeningBalanceLines(type, delta, LEDGER, EQUITY);
      const debits = lines.reduce((sum, l) => sum + l.debit, 0);
      const credits = lines.reduce((sum, l) => sum + l.credit, 0);

      expect(debits).toBeCloseTo(credits, 10);
      for (const line of lines) {
        expect(line.debit === 0 && line.credit === 0).toBe(false);
      }
    }
  });

  it('rounds the amount to two decimal places', () => {
    const lines = buildOpeningBalanceLines('customer', 33.333, LEDGER, EQUITY);
    expect(lines[0].debit).toBe(33.33);
    expect(lines[1].credit).toBe(33.33);
  });
});
