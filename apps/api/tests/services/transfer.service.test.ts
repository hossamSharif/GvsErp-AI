import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransferService, TransferError } from '../../src/services/transfer.service';

/**
 * Unit tests for TransferService pure business logic.
 * Tests error class, constructor, error codes, and method-level guards.
 */

const transferService = new (TransferService as any)(null, 'test-tenant');

// ==========================================================================
// TransferError
// ==========================================================================

describe('TransferError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new TransferError('bad transfer', 'BAD_TRANSFER');
    expect(err.message).toBe('bad transfer');
    expect(err.code).toBe('BAD_TRANSFER');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('TransferError');
  });

  it('allows overriding statusCode', () => {
    const err = new TransferError('not found', 'NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new TransferError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new TransferError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('TransferError');
  });
});

// ==========================================================================
// TransferError — all error codes used in service
// ==========================================================================

describe('TransferError specific codes', () => {
  it('creates TRANSFER_NOT_FOUND error', () => {
    const err = new TransferError('Transfer not found', 'TRANSFER_NOT_FOUND', 404);
    expect(err.code).toBe('TRANSFER_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates SOURCE_WAREHOUSE_NOT_FOUND error', () => {
    const err = new TransferError('Source warehouse not found', 'SOURCE_WAREHOUSE_NOT_FOUND', 404);
    expect(err.code).toBe('SOURCE_WAREHOUSE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates SOURCE_WAREHOUSE_INACTIVE error', () => {
    const err = new TransferError('Source warehouse inactive', 'SOURCE_WAREHOUSE_INACTIVE');
    expect(err.code).toBe('SOURCE_WAREHOUSE_INACTIVE');
  });

  it('creates DEST_WAREHOUSE_NOT_FOUND error', () => {
    const err = new TransferError('Destination warehouse not found', 'DEST_WAREHOUSE_NOT_FOUND', 404);
    expect(err.code).toBe('DEST_WAREHOUSE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates DEST_WAREHOUSE_INACTIVE error', () => {
    const err = new TransferError('Destination warehouse inactive', 'DEST_WAREHOUSE_INACTIVE');
    expect(err.code).toBe('DEST_WAREHOUSE_INACTIVE');
  });

  it('creates INSUFFICIENT_INVENTORY error', () => {
    const err = new TransferError('Not enough stock', 'INSUFFICIENT_INVENTORY');
    expect(err.code).toBe('INSUFFICIENT_INVENTORY');
  });

  it('creates TRANSFER_NOT_PENDING error', () => {
    const err = new TransferError('Transfer is not pending', 'TRANSFER_NOT_PENDING');
    expect(err.code).toBe('TRANSFER_NOT_PENDING');
  });

  it('creates TRANSFER_NOT_IN_TRANSIT error', () => {
    const err = new TransferError('Transfer is not in transit', 'TRANSFER_NOT_IN_TRANSIT');
    expect(err.code).toBe('TRANSFER_NOT_IN_TRANSIT');
  });

  it('creates TRANSFER_COMPLETED error', () => {
    const err = new TransferError('Transfer already completed', 'TRANSFER_COMPLETED');
    expect(err.code).toBe('TRANSFER_COMPLETED');
  });

  it('creates TRANSFER_ALREADY_CANCELED error', () => {
    const err = new TransferError('Transfer already canceled', 'TRANSFER_ALREADY_CANCELED');
    expect(err.code).toBe('TRANSFER_ALREADY_CANCELED');
  });

  it('creates RESERVE_FAILED error', () => {
    const err = new TransferError('Failed to reserve stock', 'RESERVE_FAILED', 500);
    expect(err.code).toBe('RESERVE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('TransferService constructor', () => {
  it('stores tenantId', () => {
    expect(transferService.tenantId).toBe('test-tenant');
  });

  it('initializes transferRepo', () => {
    expect(transferService.transferRepo).toBeDefined();
  });

  it('initializes inventoryRepo', () => {
    expect(transferService.inventoryRepo).toBeDefined();
  });

  it('initializes warehouseRepo', () => {
    expect(transferService.warehouseRepo).toBeDefined();
  });
});

// ==========================================================================
// Method-level tests with mocked repositories
// ==========================================================================

function createServiceWithMocks() {
  const svc = new (TransferService as any)(null, 'tenant-1');

  svc.warehouseRepo = {
    getById: vi.fn(),
  };
  svc.inventoryRepo = {
    getByItemAndWarehouse: vi.fn(),
    reserveStock: vi.fn(),
    releaseReserved: vi.fn(),
    adjustQuantity: vi.fn(),
  };
  svc.transferRepo = {
    getByIdWithDetails: vi.fn(),
    createTransfer: vi.fn(),
    updateStatus: vi.fn(),
    updateNotes: vi.fn(),
    deleteTransferItems: vi.fn(),
    addTransferItems: vi.fn(),
    findWithFilters: vi.fn(),
    getWarehouseTransfers: vi.fn(),
  };

  return svc;
}

const activeWarehouse = { id: 'wh-1', isActive: true, name: 'Warehouse 1' };
const inactiveWarehouse = { id: 'wh-2', isActive: false, name: 'Warehouse 2' };

describe('TransferService.createTransfer', () => {
  let svc: InstanceType<typeof TransferService>;

  beforeEach(() => {
    svc = createServiceWithMocks();
  });

  it('throws SOURCE_WAREHOUSE_NOT_FOUND when source does not exist', async () => {
    (svc as any).warehouseRepo.getById.mockResolvedValueOnce(null);

    await expect(
      svc.createTransfer({ fromWarehouseId: 'missing', toWarehouseId: 'wh-2', items: [] })
    ).rejects.toThrow(TransferError);

    try {
      (svc as any).warehouseRepo.getById.mockResolvedValueOnce(null);
      await svc.createTransfer({ fromWarehouseId: 'missing', toWarehouseId: 'wh-2', items: [] });
    } catch (e) {
      expect((e as TransferError).code).toBe('SOURCE_WAREHOUSE_NOT_FOUND');
    }
  });

  it('throws SOURCE_WAREHOUSE_INACTIVE when source is inactive', async () => {
    (svc as any).warehouseRepo.getById.mockResolvedValueOnce(inactiveWarehouse);

    try {
      await svc.createTransfer({ fromWarehouseId: 'wh-2', toWarehouseId: 'wh-3', items: [] });
    } catch (e) {
      expect((e as TransferError).code).toBe('SOURCE_WAREHOUSE_INACTIVE');
    }
  });

  it('throws DEST_WAREHOUSE_NOT_FOUND when destination does not exist', async () => {
    (svc as any).warehouseRepo.getById
      .mockResolvedValueOnce(activeWarehouse)
      .mockResolvedValueOnce(null);

    try {
      await svc.createTransfer({ fromWarehouseId: 'wh-1', toWarehouseId: 'missing', items: [] });
    } catch (e) {
      expect((e as TransferError).code).toBe('DEST_WAREHOUSE_NOT_FOUND');
    }
  });

  it('throws DEST_WAREHOUSE_INACTIVE when destination is inactive', async () => {
    (svc as any).warehouseRepo.getById
      .mockResolvedValueOnce(activeWarehouse)
      .mockResolvedValueOnce(inactiveWarehouse);

    try {
      await svc.createTransfer({ fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2', items: [] });
    } catch (e) {
      expect((e as TransferError).code).toBe('DEST_WAREHOUSE_INACTIVE');
    }
  });

  it('throws INSUFFICIENT_INVENTORY when stock is too low', async () => {
    (svc as any).warehouseRepo.getById
      .mockResolvedValueOnce(activeWarehouse)
      .mockResolvedValueOnce({ ...activeWarehouse, id: 'wh-dest' });
    (svc as any).inventoryRepo.getByItemAndWarehouse.mockResolvedValueOnce({
      quantity: 5,
      reservedQuantity: 3,
    });

    try {
      await svc.createTransfer({
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-dest',
        items: [{ itemId: 'item-1', quantity: 10 }],
      });
    } catch (e) {
      expect((e as TransferError).code).toBe('INSUFFICIENT_INVENTORY');
    }
  });

  it('treats missing inventory as zero available', async () => {
    (svc as any).warehouseRepo.getById
      .mockResolvedValueOnce(activeWarehouse)
      .mockResolvedValueOnce({ ...activeWarehouse, id: 'wh-dest' });
    (svc as any).inventoryRepo.getByItemAndWarehouse.mockResolvedValueOnce(null);

    try {
      await svc.createTransfer({
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-dest',
        items: [{ itemId: 'item-1', quantity: 1 }],
      });
    } catch (e) {
      expect((e as TransferError).code).toBe('INSUFFICIENT_INVENTORY');
    }
  });
});

describe('TransferService.completeTransfer', () => {
  let svc: InstanceType<typeof TransferService>;

  beforeEach(() => {
    svc = createServiceWithMocks();
  });

  it('throws TRANSFER_NOT_FOUND when transfer does not exist', async () => {
    (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce(null);

    await expect(svc.completeTransfer('missing')).rejects.toThrow(TransferError);
    try {
      (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce(null);
      await svc.completeTransfer('missing');
    } catch (e) {
      expect((e as TransferError).code).toBe('TRANSFER_NOT_FOUND');
    }
  });

  it('throws TRANSFER_NOT_IN_TRANSIT when status is pending', async () => {
    (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce({
      id: 't-1',
      status: 'pending',
      items: [],
    });

    try {
      await svc.completeTransfer('t-1');
    } catch (e) {
      expect((e as TransferError).code).toBe('TRANSFER_NOT_IN_TRANSIT');
    }
  });
});

describe('TransferService.cancelTransfer', () => {
  let svc: InstanceType<typeof TransferService>;

  beforeEach(() => {
    svc = createServiceWithMocks();
  });

  it('throws TRANSFER_COMPLETED when transfer is already completed', async () => {
    (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce({
      id: 't-1',
      status: 'completed',
      items: [],
    });

    try {
      await svc.cancelTransfer('t-1');
    } catch (e) {
      expect((e as TransferError).code).toBe('TRANSFER_COMPLETED');
    }
  });

  it('throws TRANSFER_ALREADY_CANCELED when transfer is canceled', async () => {
    (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce({
      id: 't-1',
      status: 'canceled',
      items: [],
    });

    try {
      await svc.cancelTransfer('t-1');
    } catch (e) {
      expect((e as TransferError).code).toBe('TRANSFER_ALREADY_CANCELED');
    }
  });

  it('releases reserved stock when canceling an in_transit transfer', async () => {
    const items = [
      { itemId: 'item-1', quantity: 5, item: { name: 'Widget' } },
      { itemId: 'item-2', quantity: 3, item: { name: 'Gadget' } },
    ];
    (svc as any).transferRepo.getByIdWithDetails
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'in_transit',
        fromWarehouseId: 'wh-1',
        items,
      })
      // Second call after status update (getTransfer return)
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'canceled',
        fromWarehouseId: 'wh-1',
        items,
      });

    await svc.cancelTransfer('t-1');

    expect((svc as any).inventoryRepo.releaseReserved).toHaveBeenCalledTimes(2);
    expect((svc as any).inventoryRepo.releaseReserved).toHaveBeenCalledWith(
      'tenant-1', 'item-1', 'wh-1', 5
    );
    expect((svc as any).inventoryRepo.releaseReserved).toHaveBeenCalledWith(
      'tenant-1', 'item-2', 'wh-1', 3
    );
  });

  it('does not release stock when canceling a pending transfer', async () => {
    (svc as any).transferRepo.getByIdWithDetails
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'pending',
        fromWarehouseId: 'wh-1',
        items: [{ itemId: 'item-1', quantity: 5 }],
      })
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'canceled',
        fromWarehouseId: 'wh-1',
        items: [{ itemId: 'item-1', quantity: 5 }],
      });

    await svc.cancelTransfer('t-1');

    expect((svc as any).inventoryRepo.releaseReserved).not.toHaveBeenCalled();
  });
});

describe('TransferService.startTransfer', () => {
  let svc: InstanceType<typeof TransferService>;

  beforeEach(() => {
    svc = createServiceWithMocks();
  });

  it('throws TRANSFER_NOT_PENDING when status is not pending', async () => {
    (svc as any).transferRepo.getByIdWithDetails.mockResolvedValueOnce({
      id: 't-1',
      status: 'in_transit',
      items: [],
    });

    try {
      await svc.startTransfer('t-1');
    } catch (e) {
      expect((e as TransferError).code).toBe('TRANSFER_NOT_PENDING');
    }
  });

  it('reserves stock for each item and updates status', async () => {
    const items = [
      { itemId: 'item-1', quantity: 10, item: { name: 'Widget' } },
    ];
    (svc as any).transferRepo.getByIdWithDetails
      .mockResolvedValueOnce({ id: 't-1', status: 'pending', fromWarehouseId: 'wh-1', items })
      .mockResolvedValueOnce({ id: 't-1', status: 'in_transit', fromWarehouseId: 'wh-1', items });

    await svc.startTransfer('t-1');

    expect((svc as any).inventoryRepo.reserveStock).toHaveBeenCalledWith(
      'tenant-1', 'item-1', 'wh-1', 10
    );
    expect((svc as any).transferRepo.updateStatus).toHaveBeenCalledWith(
      'tenant-1', 't-1', 'in_transit'
    );
  });
});
