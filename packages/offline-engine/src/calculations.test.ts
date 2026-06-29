import { describe, it, expect } from 'vitest';
import {
  calculateLineTotal,
  computeInvoiceTotals,
  stockQuantityChange,
  applyStockDelta,
  computeStockMovements,
  computePartyBalanceDelta,
} from './calculations';

// Reference implementation copied verbatim from the server/draft-store before
// the refactor. The shared engine must stay byte-identical to this.
function referenceLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
  taxRate: number
): number {
  return (
    Math.round(
      quantity * unitPrice * (1 - discountPercent / 100) * (1 + taxRate / 100) * 100
    ) / 100
  );
}

describe('calculateLineTotal', () => {
  const cases: Array<[number, number, number, number]> = [
    [1, 100, 0, 0],
    [3, 9.99, 0, 0],
    [2, 50, 10, 0],
    [2, 50, 0, 15],
    [2, 50, 10, 15],
    [7, 12.34, 5, 8],
    [10, 0.1, 33.333, 0],
    [1, 0, 0, 20],
    [100, 19.95, 12.5, 7.25],
  ];

  it.each(cases)(
    'matches reference for qty=%s price=%s disc=%s tax=%s',
    (quantity, unitPrice, discountPercent, taxRate) => {
      expect(
        calculateLineTotal({ quantity, unitPrice, discountPercent, taxRate })
      ).toBe(referenceLineTotal(quantity, unitPrice, discountPercent, taxRate));
    }
  );

  it('pins known values', () => {
    expect(calculateLineTotal({ quantity: 2, unitPrice: 50, discountPercent: 10, taxRate: 15 })).toBe(103.5);
    expect(calculateLineTotal({ quantity: 3, unitPrice: 9.99, discountPercent: 0, taxRate: 0 })).toBe(29.97);
  });
});

describe('computeInvoiceTotals', () => {
  it('sums lines and applies document discount, rounding only the total', () => {
    const items = [
      { quantity: 2, unitPrice: 50, discountPercent: 10, taxRate: 15 }, // sub 90, tax 13.5
      { quantity: 1, unitPrice: 20, discountPercent: 0, taxRate: 0 }, // sub 20, tax 0
    ];
    const { subtotal, taxAmount, total } = computeInvoiceTotals(items, 5);
    expect(subtotal).toBeCloseTo(110, 10);
    expect(taxAmount).toBeCloseTo(13.5, 10);
    expect(total).toBe(118.5); // round(110 + 13.5 - 5)
  });

  it('handles an empty document', () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});

describe('stockQuantityChange', () => {
  it('signs by type and return flag like applyStockMovements/reverseStockMovements', () => {
    expect(stockQuantityChange('sale', 5)).toBe(-5);
    expect(stockQuantityChange('purchase', 5)).toBe(5);
    expect(stockQuantityChange('sale', 5, true)).toBe(5); // sale return adds back
    expect(stockQuantityChange('purchase', 5, true)).toBe(-5); // purchase return removes
  });
});

describe('computeStockMovements', () => {
  it('computes previous/new quantities from a snapshot, defaulting missing to 0', () => {
    const movements = computeStockMovements(
      'sale',
      [
        { itemId: 'a', quantity: 3 },
        { itemId: 'b', quantity: 1 },
      ],
      { a: 10 }
    );
    expect(movements).toEqual([
      { itemId: 'a', quantityChange: -3, previousQuantity: 10, newQuantity: 7 },
      { itemId: 'b', quantityChange: -1, previousQuantity: 0, newQuantity: -1 },
    ]);
  });
});

describe('applyStockDelta', () => {
  it('adds the signed change', () => {
    expect(applyStockDelta(10, -3)).toBe(7);
    expect(applyStockDelta(0, 5)).toBe(5);
  });
});

describe('computePartyBalanceDelta', () => {
  it('invoice finalize increases balance by total * exchangeRate', () => {
    expect(computePartyBalanceDelta({ kind: 'invoice_finalize', total: 100 })).toBe(100);
    expect(
      computePartyBalanceDelta({ kind: 'invoice_finalize', total: 100, exchangeRate: 3.75 })
    ).toBe(375);
  });

  it('invoice return reverses the finalize delta', () => {
    expect(
      computePartyBalanceDelta({ kind: 'invoice_finalize', total: 100, exchangeRate: 2, isReturn: true })
    ).toBe(-200);
  });

  it('payment decreases balance by amount * exchangeRate', () => {
    expect(computePartyBalanceDelta({ kind: 'payment', amount: 40 })).toBe(-40);
    expect(
      computePartyBalanceDelta({ kind: 'payment', amount: 40, exchangeRate: 3.75 })
    ).toBe(-150);
  });

  it('payment reversal (delete) increases balance back', () => {
    expect(
      computePartyBalanceDelta({ kind: 'payment', amount: 40, exchangeRate: 3.75, isReversal: true })
    ).toBe(150);
  });
});
