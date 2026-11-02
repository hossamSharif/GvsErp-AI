import { describe, it, expect } from 'vitest';
import {
  computeBalanceSnapshot,
  type BalanceSnapshotSources,
  type SnapshotInvoiceRow,
  type SnapshotPaymentRow,
} from '../../src/services/invoice.service';

/**
 * computeBalanceSnapshot drives the payment block of the statement ("كشف بيان")
 * print template: balance before the invoice, after it, paid with it, remaining.
 */

const inv = (over: Partial<SnapshotInvoiceRow> & { id: string }): SnapshotInvoiceRow => ({
  status: 'final',
  returned_from_id: null,
  total: 0,
  exchange_rate: 1,
  invoice_date: '2026-10-18',
  created_at: '2026-10-18T10:00:00Z',
  ...over,
});

const pay = (over: Partial<SnapshotPaymentRow> & { id: string }): SnapshotPaymentRow => ({
  amount: 0,
  exchange_rate: 1,
  payment_date: '2026-10-18',
  created_at: '2026-10-18T10:00:00Z',
  ...over,
});

const PRINTED = inv({ id: 'printed', total: 500 });

function sources(over: Partial<BalanceSnapshotSources> = {}): BalanceSnapshotSources {
  return {
    currency: 'USD',
    opening: { amount: 0, date: null },
    invoice: PRINTED,
    invoices: [PRINTED],
    payments: [],
    linkedAmounts: new Map(),
    ...over,
  };
}

describe('computeBalanceSnapshot', () => {
  it('opening 1,000 + invoice 500 paid 200 with it', () => {
    const s = computeBalanceSnapshot(
      sources({
        opening: { amount: 1000, date: '2026-01-01' },
        payments: [pay({ id: 'p1', amount: 200 })],
        linkedAmounts: new Map([['p1', 200]]),
      })
    );
    expect(s).toMatchObject({
      hasParty: true,
      previousBalance: 1000,
      invoiceEffect: 500,
      balanceAfter: 1500,
      paidWithInvoice: 200,
      remaining: 1300,
    });
  });

  it('counts an opening balance with no date, ignores one dated after the invoice', () => {
    expect(
      computeBalanceSnapshot(sources({ opening: { amount: 300, date: null } })).previousBalance
    ).toBe(300);
    expect(
      computeBalanceSnapshot(sources({ opening: { amount: 300, date: '2026-12-01' } }))
        .previousBalance
    ).toBe(0);
  });

  it('includes earlier invoices, returns and payments; excludes later ones', () => {
    const s = computeBalanceSnapshot(
      sources({
        invoices: [
          PRINTED,
          inv({ id: 'old', total: 1000, invoice_date: '2026-09-01' }),
          inv({
            id: 'ret',
            status: 'returned',
            returned_from_id: 'old',
            total: 100,
            invoice_date: '2026-09-05',
          }),
          inv({ id: 'later', total: 9999, invoice_date: '2026-11-01' }),
        ],
        payments: [
          pay({ id: 'p-old', amount: 250, payment_date: '2026-09-10' }),
          pay({ id: 'p-later', amount: 5000, payment_date: '2026-11-02' }),
        ],
      })
    );
    expect(s.previousBalance).toBe(1000 - 100 - 250);
    expect(s.balanceAfter).toBe(650 + 500);
    expect(s.paidWithInvoice).toBe(0);
  });

  it('orders same-day rows by created_at', () => {
    const s = computeBalanceSnapshot(
      sources({
        invoices: [
          PRINTED,
          inv({ id: 'morning', total: 10, created_at: '2026-10-18T08:00:00Z' }),
          inv({ id: 'evening', total: 20, created_at: '2026-10-18T18:00:00Z' }),
        ],
        payments: [
          pay({ id: 'pm', amount: 1, created_at: '2026-10-18T09:00:00Z' }),
          pay({ id: 'pe', amount: 2, created_at: '2026-10-18T19:00:00Z' }),
        ],
      })
    );
    expect(s.previousBalance).toBe(10 - 1);
  });

  it('keeps a linked payment out of "before" even when it is dated earlier', () => {
    const s = computeBalanceSnapshot(
      sources({
        payments: [pay({ id: 'p1', amount: 500, payment_date: '2026-10-01' })],
        linkedAmounts: new Map([['p1', 500]]),
      })
    );
    expect(s.previousBalance).toBe(0);
    expect(s.paidWithInvoice).toBe(500);
    expect(s.remaining).toBe(0);
  });

  it('only the unlinked remainder of a shared payment falls into "before"', () => {
    const s = computeBalanceSnapshot(
      sources({
        payments: [pay({ id: 'p1', amount: 800, payment_date: '2026-10-01' })],
        linkedAmounts: new Map([['p1', 300]]),
      })
    );
    expect(s.previousBalance).toBe(-500);
    expect(s.paidWithInvoice).toBe(300);
  });

  it('converts to base currency with exchange rates', () => {
    const fx = inv({ id: 'printed', total: 100, exchange_rate: 2 });
    const s = computeBalanceSnapshot(
      sources({
        invoice: fx,
        invoices: [fx],
        payments: [pay({ id: 'p1', amount: 50, exchange_rate: 2 })],
        linkedAmounts: new Map([['p1', 50]]),
      })
    );
    expect(s.invoiceEffect).toBe(200);
    expect(s.paidWithInvoice).toBe(100);
    expect(s.remaining).toBe(100);
  });

  it('a return document reduces the balance', () => {
    const ret = inv({ id: 'printed', status: 'returned', returned_from_id: 'orig', total: 120 });
    const s = computeBalanceSnapshot(
      sources({
        invoice: ret,
        invoices: [ret, inv({ id: 'orig', total: 400, invoice_date: '2026-10-01' })],
      })
    );
    expect(s.previousBalance).toBe(400);
    expect(s.invoiceEffect).toBe(-120);
    expect(s.balanceAfter).toBe(280);
  });

  it('projects a draft as final; a canceled invoice has no effect', () => {
    const draft = inv({ id: 'printed', status: 'draft', total: 70 });
    expect(computeBalanceSnapshot(sources({ invoice: draft, invoices: [] })).invoiceEffect).toBe(70);

    const canceled = inv({ id: 'printed', status: 'canceled', total: 70 });
    expect(
      computeBalanceSnapshot(sources({ invoice: canceled, invoices: [] })).invoiceEffect
    ).toBe(0);
  });

  it('ignores invoices flipped to returned in place', () => {
    const s = computeBalanceSnapshot(
      sources({
        invoices: [
          PRINTED,
          inv({ id: 'flipped', status: 'returned', total: 999, invoice_date: '2026-09-01' }),
        ],
      })
    );
    expect(s.previousBalance).toBe(0);
  });
});
