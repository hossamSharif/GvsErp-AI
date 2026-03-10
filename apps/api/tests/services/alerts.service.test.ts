import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertsService } from '../../src/services/alerts.service';
import type { AlertSeverity } from '../../src/services/alerts.service';

/**
 * Unit tests for AlertsService pure business logic.
 * Tests getSeverity thresholds and constructor — no DB mocks needed.
 */

const alertsService = new (AlertsService as any)(null, 'test-tenant');

// ==========================================================================
// getSeverity — alert severity classification
// ==========================================================================

describe('AlertsService.getSeverity', () => {
  it('returns critical for negative percentage', () => {
    expect(alertsService.getSeverity(-10)).toBe('critical');
  });

  it('returns critical for 0%', () => {
    expect(alertsService.getSeverity(0)).toBe('critical');
  });

  it('returns critical for 24%', () => {
    expect(alertsService.getSeverity(24)).toBe('critical');
  });

  it('returns warning for 25%', () => {
    expect(alertsService.getSeverity(25)).toBe('warning');
  });

  it('returns warning for 49%', () => {
    expect(alertsService.getSeverity(49)).toBe('warning');
  });

  it('returns low for 50%', () => {
    expect(alertsService.getSeverity(50)).toBe('low');
  });

  it('returns low for 99%', () => {
    expect(alertsService.getSeverity(99)).toBe('low');
  });

  it('returns low for 100%', () => {
    expect(alertsService.getSeverity(100)).toBe('low');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('AlertsService constructor', () => {
  it('stores tenantId', () => {
    expect(alertsService.tenantId).toBe('test-tenant');
  });

  it('initializes inventoryRepo', () => {
    expect(alertsService.inventoryRepo).toBeDefined();
  });

  it('initializes warehouseRepo', () => {
    expect(alertsService.warehouseRepo).toBeDefined();
  });
});

// ==========================================================================
// getLowStockAlerts — severity filtering
// ==========================================================================

describe('AlertsService.getLowStockAlerts', () => {
  const svc = new (AlertsService as any)(null, 'tenant-1');

  const mockAlerts = [
    { itemId: 'i1', itemName: 'Item A', warehouseId: 'w1', warehouseName: 'WH1', quantity: 2, lowStockThreshold: 100, percentOfThreshold: 2, itemSku: 'SKU1' },
    { itemId: 'i2', itemName: 'Item B', warehouseId: 'w1', warehouseName: 'WH1', quantity: 30, lowStockThreshold: 100, percentOfThreshold: 30, itemSku: 'SKU2' },
    { itemId: 'i3', itemName: 'Item C', warehouseId: 'w2', warehouseName: 'WH2', quantity: 80, lowStockThreshold: 100, percentOfThreshold: 80, itemSku: null },
  ];

  beforeEach(() => {
    svc.inventoryRepo = {
      getLowStockAlerts: vi.fn().mockResolvedValue(mockAlerts),
    };
  });

  it('returns all alerts with severity when no filter', async () => {
    const result = await svc.getLowStockAlerts();
    expect(result).toHaveLength(3);
    expect(result[0].severity).toBe('critical');
    expect(result[1].severity).toBe('warning');
    expect(result[2].severity).toBe('low');
  });

  it('filters by critical severity', async () => {
    const result = await svc.getLowStockAlerts(undefined, 'critical');
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('i1');
  });

  it('filters by warning severity', async () => {
    const result = await svc.getLowStockAlerts(undefined, 'warning');
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('i2');
  });

  it('returns empty array when no alerts match severity', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([
      { ...mockAlerts[2] },
    ]);
    const result = await svc.getLowStockAlerts(undefined, 'critical');
    expect(result).toHaveLength(0);
  });

  it('passes warehouseId to repository', async () => {
    await svc.getLowStockAlerts('w1');
    expect(svc.inventoryRepo.getLowStockAlerts).toHaveBeenCalledWith('tenant-1', 'w1');
  });

  it('returns empty array when repository returns no alerts', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([]);
    const result = await svc.getLowStockAlerts();
    expect(result).toHaveLength(0);
  });
});

// ==========================================================================
// getSuggestedReorders — reorder quantity calculation
// ==========================================================================

describe('AlertsService.getSuggestedReorders', () => {
  const svc = new (AlertsService as any)(null, 'tenant-1');

  beforeEach(() => {
    svc.inventoryRepo = {
      getLowStockAlerts: vi.fn().mockResolvedValue([]),
    };
  });

  it('suggests enough to reach 150% of threshold', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([
      { itemId: 'i1', itemName: 'A', itemSku: 'S1', warehouseId: 'w1', warehouseName: 'WH1', quantity: 10, lowStockThreshold: 100, percentOfThreshold: 10 },
    ]);
    const result = await svc.getSuggestedReorders();
    // target = 100 * 1.5 = 150, suggested = ceil(150 - 10) = 140
    expect(result[0].suggestedQuantity).toBe(140);
  });

  it('returns minimum of 1 even when quantity exceeds target', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([
      { itemId: 'i1', itemName: 'A', itemSku: 'S1', warehouseId: 'w1', warehouseName: 'WH1', quantity: 200, lowStockThreshold: 100, percentOfThreshold: 200 },
    ]);
    const result = await svc.getSuggestedReorders();
    // target = 150, suggested = ceil(150 - 200) = -50 → max(-50, 1) = 1
    expect(result[0].suggestedQuantity).toBe(1);
  });

  it('handles zero quantity (out of stock)', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([
      { itemId: 'i1', itemName: 'A', itemSku: null, warehouseId: 'w1', warehouseName: 'WH1', quantity: 0, lowStockThreshold: 50, percentOfThreshold: 0 },
    ]);
    const result = await svc.getSuggestedReorders();
    // target = 50 * 1.5 = 75, suggested = ceil(75 - 0) = 75
    expect(result[0].suggestedQuantity).toBe(75);
    expect(result[0].severity).toBe('critical');
  });

  it('sorts by severity then by suggested quantity descending', async () => {
    svc.inventoryRepo.getLowStockAlerts = vi.fn().mockResolvedValue([
      { itemId: 'i1', itemName: 'Low1', itemSku: 'S1', warehouseId: 'w1', warehouseName: 'WH1', quantity: 80, lowStockThreshold: 100, percentOfThreshold: 80 },
      { itemId: 'i2', itemName: 'Crit1', itemSku: 'S2', warehouseId: 'w1', warehouseName: 'WH1', quantity: 5, lowStockThreshold: 100, percentOfThreshold: 5 },
      { itemId: 'i3', itemName: 'Crit2', itemSku: 'S3', warehouseId: 'w1', warehouseName: 'WH1', quantity: 0, lowStockThreshold: 100, percentOfThreshold: 0 },
    ]);
    const result = await svc.getSuggestedReorders();
    expect(result[0].itemName).toBe('Crit2'); // critical, highest suggested qty (150)
    expect(result[1].itemName).toBe('Crit1'); // critical, lower suggested qty (145)
    expect(result[2].itemName).toBe('Low1');  // low severity
  });

  it('returns empty array when no alerts', async () => {
    const result = await svc.getSuggestedReorders();
    expect(result).toHaveLength(0);
  });
});
