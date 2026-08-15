import { describe, it, expect } from 'vitest';
import {
  PartyService,
  PartyError,
  buildOpeningBalanceLines,
  assembleStatementRows,
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

// ==========================================================================
// assembleStatementRows
// ==========================================================================

/**
 * A statement is built from two halves: a brought-forward figure covering
 * everything strictly before dateFrom, and the rows inside the window. Both
 * halves must window on the SAME column, or a transaction lands in neither
 * (money vanishes) or in both (money doubles). These tests pin the row half and
 * the `< dateFrom` predicate that the brought-forward half mirrors.
 */

const NO_OPENING = { amount: 0, date: null };

const invoice = (id: string, date: string, total: number) => ({
  id,
  invoice_number: `INV-${id}`,
  total,
  exchange_rate: 1,
  invoice_date: date,
});

const payment = (id: string, date: string, amount: number) => ({
  id,
  reference: `PAY-${id}`,
  amount,
  exchange_rate: 1,
  payment_date: date,
  notes: null,
});

const empty = { invoices: [], returns: [], payments: [] };

/** The brought-forward predicate getBalanceAtDate applies, in isolation. */
const isBroughtForward = (date: string, dateFrom: string) => date < dateFrom;

describe('assembleStatementRows', () => {
  it('excludes a back-dated payment from the window and brings it forward instead', () => {
    // Regression: this payment was entered on 2026-08-06 but dated 2026-03-08.
    // getBalanceAtDate windowed on created_at while the row query used
    // payment_date, so it was neither brought forward nor listed, and the
    // ledger closed 100,000 above the party's actual balance.
    const backDated = payment('p1', '2026-03-08', 100000);

    const rows = assembleStatementRows(
      { opening: NO_OPENING, ...empty, payments: [backDated] },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows).toHaveLength(0);
    expect(isBroughtForward(backDated.payment_date, '2026-05-17')).toBe(true);
  });

  it('counts a payment inside the window exactly once', () => {
    const inWindow = payment('p2', '2026-08-03', 520000);

    const rows = assembleStatementRows(
      { opening: NO_OPENING, ...empty, payments: [inWindow] },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows).toHaveLength(1);
    expect(isBroughtForward(inWindow.payment_date, '2026-05-17')).toBe(false);
  });

  it('does not double-count a payment dated after the window', () => {
    const future = payment('p3', '2026-09-09', 200000);

    const rows = assembleStatementRows(
      { opening: NO_OPENING, ...empty, payments: [future] },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows).toHaveLength(0);
    expect(isBroughtForward(future.payment_date, '2026-05-17')).toBe(false);
  });

  it('lists an opening balance dated exactly on dateFrom as a row, not brought forward', () => {
    const rows = assembleStatementRows(
      { opening: { amount: 620000, date: '2026-05-17' }, ...empty },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('opening');
    expect(rows[0].debit).toBe(620000);
    expect(isBroughtForward('2026-05-17', '2026-05-17')).toBe(false);
  });

  it('puts a negative opening balance on the credit side', () => {
    const rows = assembleStatementRows(
      { opening: { amount: -5400, date: '2026-06-01' }, ...empty },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows[0].debit).toBe(0);
    expect(rows[0].credit).toBe(5400);
  });

  it('emits return documents on the credit side', () => {
    const rows = assembleStatementRows(
      { opening: NO_OPENING, ...empty, returns: [invoice('r1', '2026-07-01', 1200)] },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows[0].type).toBe('return');
    expect(rows[0].debit).toBe(0);
    expect(rows[0].credit).toBe(1200);
  });

  it('orders same-day rows opening, invoice, return, payment', () => {
    const day = '2026-08-03';
    const rows = assembleStatementRows(
      {
        opening: { amount: 100, date: day },
        invoices: [invoice('i1', day, 200)],
        returns: [invoice('r1', day, 50)],
        payments: [payment('p1', day, 75)],
      },
      '2026-05-17',
      '2026-08-15'
    );

    expect(rows.map((r) => r.type)).toEqual(['opening', 'invoice', 'return', 'payment']);
  });

  it('breaks ties on id so repeated calls return a stable order', () => {
    const day = '2026-08-03';
    const forward = assembleStatementRows(
      { opening: NO_OPENING, ...empty, payments: [payment('b', day, 1), payment('a', day, 2)] },
      '2026-01-01',
      '2026-12-31'
    );
    const reversed = assembleStatementRows(
      { opening: NO_OPENING, ...empty, payments: [payment('a', day, 2), payment('b', day, 1)] },
      '2026-01-01',
      '2026-12-31'
    );

    expect(forward.map((r) => r.id)).toEqual(['a', 'b']);
    expect(forward.map((r) => r.id)).toEqual(reversed.map((r) => r.id));
  });

  it('sorts across dates chronologically', () => {
    const rows = assembleStatementRows(
      {
        opening: NO_OPENING,
        returns: [],
        invoices: [invoice('i2', '2026-08-06', 1529000), invoice('i1', '2026-08-03', 520000)],
        payments: [payment('p1', '2026-07-01', 10)],
      },
      '2026-01-01',
      '2026-12-31'
    );

    expect(rows.map((r) => r.date)).toEqual(['2026-07-01', '2026-08-03', '2026-08-06']);
  });

  it('reproduces the reported supplier: brought forward -100,000, closing 520,000', () => {
    // Window 2026-05-17..2026-08-15. The March payment is brought forward; the
    // opening balance and both invoice/payment pairs fall inside the window.
    const broughtForward = -100000;

    const rows = assembleStatementRows(
      {
        opening: { amount: 620000, date: '2026-08-02' },
        invoices: [invoice('i1', '2026-08-03', 520000), invoice('i2', '2026-08-06', 1529000)],
        returns: [],
        payments: [payment('p2', '2026-08-03', 520000), payment('p3', '2026-08-06', 1529000)],
      },
      '2026-05-17',
      '2026-08-15'
    );

    const closing = rows.reduce((bal, r) => bal + r.debit - r.credit, broughtForward);
    expect(closing).toBe(520000);
  });

  it('keeps broughtForward + sum(debit - credit) === closing for a randomised fixture', () => {
    const pick = (n: number) => Math.floor(Math.random() * n);
    const day = () => `2026-0${1 + pick(9)}-${String(1 + pick(28)).padStart(2, '0')}`;

    for (let run = 0; run < 50; run++) {
      const invoices = Array.from({ length: pick(4) }, (_, i) =>
        invoice(`i${i}`, day(), pick(10000))
      );
      const returns = Array.from({ length: pick(3) }, (_, i) =>
        invoice(`r${i}`, day(), pick(1000))
      );
      const payments = Array.from({ length: pick(4) }, (_, i) =>
        payment(`p${i}`, day(), pick(10000))
      );

      const broughtForward = pick(50000) - 25000;
      const rows = assembleStatementRows(
        { opening: NO_OPENING, invoices, returns, payments },
        '2026-01-01',
        '2026-12-31'
      );

      // Mirrors the running-balance loop in getPartyStatement.
      let running = broughtForward;
      const balances = rows.map((r) => (running += r.debit - r.credit));
      const closing = balances.length ? balances[balances.length - 1] : broughtForward;

      expect(closing).toBeCloseTo(
        rows.reduce((sum, r) => sum + r.debit - r.credit, broughtForward),
        10
      );
      expect(rows).toHaveLength(invoices.length + returns.length + payments.length);
    }
  });
});
