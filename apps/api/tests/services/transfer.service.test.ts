import { describe, it, expect } from 'vitest';
import { TransferService, TransferError } from '../../src/services/transfer.service';

/**
 * Unit tests for TransferService pure business logic.
 * Tests error class, constructor, error codes — no DB mocks needed.
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
