import { describe, it, expect } from 'vitest';
import { POSService } from '../../src/services/pos.service';
import type { QuickSaleRequest, POSLocation } from '@erp/shared';

/**
 * Unit tests for POSService pure functions
 * No mocks needed — testing calculateSaleSummary and validateDiscount.
 */

// Create a minimal instance (only calling pure methods, no DB)
const posService = new (POSService as any)(null, 'test-tenant');

/** Helper to build a POSLocation with specific discount settings */
function makePOSLocation(discounts?: POSLocation['settings']['discounts']): POSLocation {
  return {
    id: 'pos-1',
    tenant_id: 'tenant-1',
    name: 'Test POS',
    warehouse_id: 'wh-1',
    settings: { discounts },
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };
}

describe('POSService.calculateSaleSummary', () => {
  it('calculates subtotal from items', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 2, unit_price: 10 },
        { item_id: 'b', quantity: 1, unit_price: 25 },
      ],
    };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(45);
    expect(result.total).toBe(45);
    expect(result.items_count).toBe(2);
    expect(result.discount_amount).toBe(0);
    expect(result.tax_amount).toBe(0);
  });

  it('applies item-level discount percent', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 100, discount_percent: 10 },
      ],
    };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(100);
    expect(result.discount_amount).toBe(10);
    expect(result.total).toBe(90);
  });

  it('applies invoice-level discount amount', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 2, unit_price: 50 },
      ],
      discount_amount: 20,
    };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(100);
    expect(result.discount_amount).toBe(20);
    expect(result.total).toBe(80);
  });

  it('applies invoice-level discount percent', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 200 },
      ],
      discount_percent: 15,
    };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(200);
    expect(result.discount_amount).toBe(30);
    expect(result.total).toBe(170);
  });

  it('prefers discount_amount over discount_percent when both provided', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 100 },
      ],
      discount_amount: 5,
      discount_percent: 50,
    };
    const result = posService.calculateSaleSummary(saleData);
    // discount_amount takes priority (checked first)
    expect(result.discount_amount).toBe(5);
    expect(result.total).toBe(95);
  });

  it('calculates tax on discounted amount', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 100 },
      ],
    };
    const result = posService.calculateSaleSummary(saleData, 10); // 10% tax
    expect(result.subtotal).toBe(100);
    expect(result.tax_amount).toBe(10);
    expect(result.total).toBe(110);
  });

  it('calculates tax after discount', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 100, discount_percent: 20 },
      ],
    };
    const result = posService.calculateSaleSummary(saleData, 10); // 10% tax
    expect(result.subtotal).toBe(100);
    expect(result.discount_amount).toBe(20);
    // Tax on discounted: 80 * 10% = 8
    expect(result.tax_amount).toBe(8);
    expect(result.total).toBe(88);
  });

  it('handles empty items array', () => {
    const saleData: QuickSaleRequest = { items: [] };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.items_count).toBe(0);
  });

  it('combines item-level and invoice-level discounts', () => {
    const saleData: QuickSaleRequest = {
      items: [
        { item_id: 'a', quantity: 1, unit_price: 100, discount_percent: 10 }, // 10 off
        { item_id: 'b', quantity: 1, unit_price: 50 },
      ],
      discount_amount: 5, // additional 5 off
    };
    const result = posService.calculateSaleSummary(saleData);
    expect(result.subtotal).toBe(150);
    expect(result.discount_amount).toBe(15); // 10 item + 5 invoice
    expect(result.total).toBe(135);
  });
});

describe('POSService.validateDiscount', () => {
  it('returns valid when no discount settings configured', () => {
    const location = makePOSLocation(undefined);
    const result = posService.validateDiscount(50, location);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns valid when discount is within max limit', () => {
    const location = makePOSLocation({ max_discount_percent: 20 });
    const result = posService.validateDiscount(15, location);
    expect(result.valid).toBe(true);
  });

  it('returns valid when discount equals max limit', () => {
    const location = makePOSLocation({ max_discount_percent: 20 });
    const result = posService.validateDiscount(20, location);
    expect(result.valid).toBe(true);
  });

  it('rejects discount exceeding max limit', () => {
    const location = makePOSLocation({ max_discount_percent: 20 });
    const result = posService.validateDiscount(25, location);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('20%');
  });

  it('returns valid when manager approval not required', () => {
    const location = makePOSLocation({
      require_manager_approval: false,
      manager_approval_threshold: 10,
    });
    const result = posService.validateDiscount(50, location);
    expect(result.valid).toBe(true);
  });

  it('returns valid when discount is below manager approval threshold', () => {
    const location = makePOSLocation({
      require_manager_approval: true,
      manager_approval_threshold: 15,
    });
    const result = posService.validateDiscount(10, location);
    expect(result.valid).toBe(true);
  });

  it('rejects discount above threshold without manager approval', () => {
    const location = makePOSLocation({
      require_manager_approval: true,
      manager_approval_threshold: 15,
    });
    const result = posService.validateDiscount(20, location, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('manager approval');
    expect(result.reason).toContain('15%');
  });

  it('allows discount above threshold with manager approval', () => {
    const location = makePOSLocation({
      require_manager_approval: true,
      manager_approval_threshold: 15,
    });
    const result = posService.validateDiscount(20, location, true);
    expect(result.valid).toBe(true);
  });

  it('checks max limit before manager approval', () => {
    const location = makePOSLocation({
      max_discount_percent: 10,
      require_manager_approval: true,
      manager_approval_threshold: 5,
    });
    // 15% exceeds max of 10% — should fail on max, not manager approval
    const result = posService.validateDiscount(15, location, true);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('maximum');
  });

  it('returns valid with zero discount', () => {
    const location = makePOSLocation({
      max_discount_percent: 10,
      require_manager_approval: true,
      manager_approval_threshold: 5,
    });
    const result = posService.validateDiscount(0, location);
    expect(result.valid).toBe(true);
  });
});
