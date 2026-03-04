import { describe, it, expect } from 'vitest';
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
