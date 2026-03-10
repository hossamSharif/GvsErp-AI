import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehouseService, WarehouseError } from '../../src/services/warehouse.service';

/**
 * Unit tests for WarehouseService pure business logic.
 * Tests error class, constructor — no DB mocks needed.
 */

const warehouseService = new (WarehouseService as any)(null, 'test-tenant');

// ==========================================================================
// WarehouseError
// ==========================================================================

describe('WarehouseError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new WarehouseError('bad warehouse', 'BAD_WAREHOUSE');
    expect(err.message).toBe('bad warehouse');
    expect(err.code).toBe('BAD_WAREHOUSE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('WarehouseError');
  });

  it('allows overriding statusCode', () => {
    const err = new WarehouseError('not found', 'WAREHOUSE_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new WarehouseError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new WarehouseError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('WarehouseError');
  });

  it('supports 500 server error status', () => {
    const err = new WarehouseError('update failed', 'WAREHOUSE_UPDATE_FAILED', 500);
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// WarehouseError — all error codes used in service
// ==========================================================================

describe('WarehouseError specific codes', () => {
  it('creates WAREHOUSE_NOT_FOUND error', () => {
    const err = new WarehouseError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    expect(err.code).toBe('WAREHOUSE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates WAREHOUSE_HAS_INVENTORY error', () => {
    const err = new WarehouseError(
      'Cannot deactivate warehouse with inventory. Transfer or remove all stock first.',
      'WAREHOUSE_HAS_INVENTORY',
      400
    );
    expect(err.code).toBe('WAREHOUSE_HAS_INVENTORY');
    expect(err.statusCode).toBe(400);
  });

  it('creates WAREHOUSE_HAS_PENDING_TRANSFERS error', () => {
    const err = new WarehouseError(
      'Cannot deactivate warehouse with pending transfers. Complete or cancel transfers first.',
      'WAREHOUSE_HAS_PENDING_TRANSFERS',
      400
    );
    expect(err.code).toBe('WAREHOUSE_HAS_PENDING_TRANSFERS');
    expect(err.statusCode).toBe(400);
  });

  it('creates WAREHOUSE_UPDATE_FAILED error', () => {
    const err = new WarehouseError('Failed to update warehouse', 'WAREHOUSE_UPDATE_FAILED', 500);
    expect(err.code).toBe('WAREHOUSE_UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });

  it('creates deactivate variant of UPDATE_FAILED error', () => {
    const err = new WarehouseError('Failed to deactivate warehouse', 'WAREHOUSE_UPDATE_FAILED', 500);
    expect(err.code).toBe('WAREHOUSE_UPDATE_FAILED');
    expect(err.message).toBe('Failed to deactivate warehouse');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('WarehouseService constructor', () => {
  it('stores tenantId', () => {
    expect(warehouseService.tenantId).toBe('test-tenant');
  });

  it('initializes warehouseRepo', () => {
    expect(warehouseService.warehouseRepo).toBeDefined();
  });

  it('initializes inventoryRepo', () => {
    expect(warehouseService.inventoryRepo).toBeDefined();
  });

  it('initializes alertsService', () => {
    expect(warehouseService.alertsService).toBeDefined();
  });
});

// ==========================================================================
// bulkUpdateLowStockThresholds — result shape
// ==========================================================================

describe('WarehouseService bulk threshold result shape', () => {
  it('returns correct shape for empty input', async () => {
    // Override getWarehouse to skip DB call
    const original = warehouseService.getWarehouse;
    warehouseService.getWarehouse = async () => ({ id: 'w-1', name: 'Test' });

    const result = await warehouseService.bulkUpdateLowStockThresholds('w-1', []);

    expect(result).toEqual({
      updated: 0,
      failed: 0,
      results: [],
    });

    warehouseService.getWarehouse = original;
  });
});

// ==========================================================================
// deactivateWarehouse — guard logic
// ==========================================================================

describe('WarehouseService.deactivateWarehouse', () => {
  const svc = new (WarehouseService as any)(null, 'tenant-1');
  const mockWarehouse = { id: 'w-1', name: 'Main', isActive: true };

  beforeEach(() => {
    svc.warehouseRepo = {
      getById: vi.fn().mockResolvedValue(mockWarehouse),
      hasInventory: vi.fn().mockResolvedValue(false),
      hasPendingTransfers: vi.fn().mockResolvedValue(false),
      updateWarehouse: vi.fn().mockResolvedValue({ ...mockWarehouse, isActive: false }),
    };
  });

  it('deactivates warehouse when no inventory or transfers', async () => {
    const result = await svc.deactivateWarehouse('w-1');
    expect(result.isActive).toBe(false);
    expect(svc.warehouseRepo.updateWarehouse).toHaveBeenCalledWith('tenant-1', 'w-1', { isActive: false });
  });

  it('throws WAREHOUSE_HAS_INVENTORY when stock exists', async () => {
    svc.warehouseRepo.hasInventory = vi.fn().mockResolvedValue(true);
    await expect(svc.deactivateWarehouse('w-1')).rejects.toThrow('Cannot deactivate warehouse with inventory');
    try {
      await svc.deactivateWarehouse('w-1');
    } catch (e) {
      expect(e).toBeInstanceOf(WarehouseError);
      expect((e as WarehouseError).code).toBe('WAREHOUSE_HAS_INVENTORY');
    }
  });

  it('throws WAREHOUSE_HAS_PENDING_TRANSFERS when transfers pending', async () => {
    svc.warehouseRepo.hasPendingTransfers = vi.fn().mockResolvedValue(true);
    await expect(svc.deactivateWarehouse('w-1')).rejects.toThrow('Cannot deactivate warehouse with pending transfers');
    try {
      await svc.deactivateWarehouse('w-1');
    } catch (e) {
      expect(e).toBeInstanceOf(WarehouseError);
      expect((e as WarehouseError).code).toBe('WAREHOUSE_HAS_PENDING_TRANSFERS');
    }
  });

  it('checks inventory before transfers', async () => {
    svc.warehouseRepo.hasInventory = vi.fn().mockResolvedValue(true);
    await expect(svc.deactivateWarehouse('w-1')).rejects.toThrow();
    expect(svc.warehouseRepo.hasPendingTransfers).not.toHaveBeenCalled();
  });

  it('throws WAREHOUSE_NOT_FOUND when warehouse missing', async () => {
    svc.warehouseRepo.getById = vi.fn().mockResolvedValue(null);
    await expect(svc.deactivateWarehouse('missing')).rejects.toThrow(WarehouseError);
  });

  it('throws WAREHOUSE_UPDATE_FAILED when update returns null', async () => {
    svc.warehouseRepo.updateWarehouse = vi.fn().mockResolvedValue(null);
    await expect(svc.deactivateWarehouse('w-1')).rejects.toThrow('Failed to deactivate warehouse');
  });
});

// ==========================================================================
// getLowStockSummary — delegates to alertsService
// ==========================================================================

describe('WarehouseService.getLowStockSummary', () => {
  const svc = new (WarehouseService as any)(null, 'tenant-1');

  it('delegates to alertsService and returns summary', async () => {
    const mockSummary = {
      totalAlerts: 3,
      criticalCount: 1,
      warningCount: 1,
      lowCount: 1,
      byWarehouse: [
        { warehouseId: 'w1', warehouseName: 'WH1', alertCount: 2 },
        { warehouseId: 'w2', warehouseName: 'WH2', alertCount: 1 },
      ],
    };
    svc.alertsService = {
      getLowStockSummary: vi.fn().mockResolvedValue(mockSummary),
    };
    const result = await svc.getLowStockSummary();
    expect(svc.alertsService.getLowStockSummary).toHaveBeenCalled();
    expect(result).toEqual(mockSummary);
  });

  it('returns empty summary when no alerts', async () => {
    const emptySummary = {
      totalAlerts: 0,
      criticalCount: 0,
      warningCount: 0,
      lowCount: 0,
      byWarehouse: [],
    };
    svc.alertsService = {
      getLowStockSummary: vi.fn().mockResolvedValue(emptySummary),
    };
    const result = await svc.getLowStockSummary();
    expect(result.totalAlerts).toBe(0);
    expect(result.byWarehouse).toHaveLength(0);
  });
});

// ==========================================================================
// Alert delegation methods
// ==========================================================================

describe('WarehouseService alert delegation methods', () => {
  const svc = new (WarehouseService as any)(null, 'tenant-1');
  const mockAlerts = [
    { itemId: 'i1', severity: 'critical', percentOfThreshold: 10 },
    { itemId: 'i2', severity: 'warning', percentOfThreshold: 40 },
  ];

  beforeEach(() => {
    svc.alertsService = {
      getLowStockAlerts: vi.fn().mockResolvedValue(mockAlerts),
      getCriticalAlerts: vi.fn().mockResolvedValue([mockAlerts[0]]),
      getSuggestedReorders: vi.fn().mockResolvedValue([
        { itemId: 'i1', suggestedQuantity: 50, severity: 'critical' },
      ]),
    };
  });

  it('getLowStockAlertsWithSeverity delegates to alertsService', async () => {
    const result = await svc.getLowStockAlertsWithSeverity('w1', 'critical');
    expect(svc.alertsService.getLowStockAlerts).toHaveBeenCalledWith('w1', 'critical');
    expect(result).toEqual(mockAlerts);
  });

  it('getLowStockAlertsWithSeverity works without parameters', async () => {
    const result = await svc.getLowStockAlertsWithSeverity();
    expect(svc.alertsService.getLowStockAlerts).toHaveBeenCalledWith(undefined, undefined);
    expect(result).toEqual(mockAlerts);
  });

  it('getCriticalAlerts delegates to alertsService', async () => {
    const result = await svc.getCriticalAlerts('w1');
    expect(svc.alertsService.getCriticalAlerts).toHaveBeenCalledWith('w1');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('getCriticalAlerts works without warehouseId', async () => {
    await svc.getCriticalAlerts();
    expect(svc.alertsService.getCriticalAlerts).toHaveBeenCalledWith(undefined);
  });

  it('getSuggestedReorders delegates to alertsService', async () => {
    const result = await svc.getSuggestedReorders('w1');
    expect(svc.alertsService.getSuggestedReorders).toHaveBeenCalledWith('w1');
    expect(result).toHaveLength(1);
    expect(result[0].suggestedQuantity).toBe(50);
  });

  it('getSuggestedReorders works without warehouseId', async () => {
    await svc.getSuggestedReorders();
    expect(svc.alertsService.getSuggestedReorders).toHaveBeenCalledWith(undefined);
  });
});

// ==========================================================================
// getInventoryReportData — unitCost calculation
// ==========================================================================

describe('WarehouseService.getInventoryReportData', () => {
  const svc = new (WarehouseService as any)(null, 'tenant-1');
  const mockWarehouse = { id: 'w-1', name: 'Main', isActive: true };

  const makeInvItem = (overrides: Record<string, unknown> = {}) => ({
    itemId: 'item-1',
    itemName: 'Widget',
    itemSku: 'WDG-001',
    itemBarcode: '123456',
    unitOfMeasure: 'pcs',
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    lowStockThreshold: 5,
    isLowStock: false,
    estimatedValue: 100,
    ...overrides,
  });

  beforeEach(() => {
    svc.warehouseRepo = {
      getById: vi.fn().mockResolvedValue(mockWarehouse),
      getActiveWarehouses: vi.fn().mockResolvedValue([mockWarehouse]),
    };
  });

  it('calculates unitCost correctly for items with quantity', async () => {
    svc.inventoryRepo = {
      getWarehouseInventory: vi.fn().mockResolvedValue({
        data: [makeInvItem({ quantity: 10, estimatedValue: 250 })],
      }),
    };

    const result = await svc.getInventoryReportData({ warehouseId: 'w-1' });
    expect(result.entries[0].unitCost).toBe(25); // 250 / 10
  });

  it('returns unitCost 0 for zero-quantity items', async () => {
    svc.inventoryRepo = {
      getWarehouseInventory: vi.fn().mockResolvedValue({
        data: [makeInvItem({ quantity: 0, estimatedValue: 100 })],
      }),
    };

    const result = await svc.getInventoryReportData({
      warehouseId: 'w-1',
      includeZeroQuantity: true,
    });
    expect(result.entries[0].unitCost).toBe(0);
    expect(result.entries[0].totalValue).toBe(100);
  });

  it('filters out zero-quantity items by default', async () => {
    svc.inventoryRepo = {
      getWarehouseInventory: vi.fn().mockResolvedValue({
        data: [
          makeInvItem({ itemId: 'a', quantity: 5, estimatedValue: 50 }),
          makeInvItem({ itemId: 'b', quantity: 0, estimatedValue: 0 }),
        ],
      }),
    };

    const result = await svc.getInventoryReportData({ warehouseId: 'w-1' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].itemId).toBe('a');
  });

  it('aggregates totals correctly', async () => {
    svc.inventoryRepo = {
      getWarehouseInventory: vi.fn().mockResolvedValue({
        data: [
          makeInvItem({ itemId: 'a', quantity: 10, estimatedValue: 100, isLowStock: true }),
          makeInvItem({ itemId: 'b', quantity: 5, estimatedValue: 75, isLowStock: false }),
        ],
      }),
    };

    const result = await svc.getInventoryReportData({ warehouseId: 'w-1' });
    expect(result.summary.totalItems).toBe(2);
    expect(result.summary.totalQuantity).toBe(15);
    expect(result.summary.totalValue).toBe(175);
    expect(result.summary.lowStockCount).toBe(1);
  });
});
