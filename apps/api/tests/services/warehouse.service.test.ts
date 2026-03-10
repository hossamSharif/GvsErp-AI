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
// getLowStockSummary — counting logic
// ==========================================================================

describe('WarehouseService.getLowStockSummary', () => {
  const svc = new (WarehouseService as any)(null, 'tenant-1');

  it('counts severity levels correctly', async () => {
    svc.inventoryRepo = {
      getLowStockAlerts: vi.fn().mockResolvedValue([
        { warehouseId: 'w1', warehouseName: 'WH1', percentOfThreshold: 10 },
        { warehouseId: 'w1', warehouseName: 'WH1', percentOfThreshold: 30 },
        { warehouseId: 'w2', warehouseName: 'WH2', percentOfThreshold: 80 },
      ]),
    };
    const result = await svc.getLowStockSummary();
    expect(result.totalAlerts).toBe(3);
    expect(result.criticalCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.lowCount).toBe(1);
  });

  it('groups alerts by warehouse', async () => {
    svc.inventoryRepo = {
      getLowStockAlerts: vi.fn().mockResolvedValue([
        { warehouseId: 'w1', warehouseName: 'WH1', percentOfThreshold: 10 },
        { warehouseId: 'w1', warehouseName: 'WH1', percentOfThreshold: 20 },
        { warehouseId: 'w2', warehouseName: 'WH2', percentOfThreshold: 60 },
      ]),
    };
    const result = await svc.getLowStockSummary();
    expect(result.byWarehouse).toHaveLength(2);
    expect(result.byWarehouse.find((w: { warehouseId: string }) => w.warehouseId === 'w1')?.alertCount).toBe(2);
    expect(result.byWarehouse.find((w: { warehouseId: string }) => w.warehouseId === 'w2')?.alertCount).toBe(1);
  });

  it('returns empty summary when no alerts', async () => {
    svc.inventoryRepo = {
      getLowStockAlerts: vi.fn().mockResolvedValue([]),
    };
    const result = await svc.getLowStockSummary();
    expect(result.totalAlerts).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.byWarehouse).toHaveLength(0);
  });
});
