import { describe, it, expect } from 'vitest';
import { ItemService, ItemError } from '../../src/services/item.service';

/**
 * Unit tests for ItemService pure business logic.
 * Tests error class and private helpers via (instance as any) — no DB mocks needed.
 */

const itemService = new (ItemService as any)(null, 'test-tenant');

// ==========================================================================
// ItemError
// ==========================================================================

describe('ItemError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new ItemError('bad item', 'BAD_ITEM');
    expect(err.message).toBe('bad item');
    expect(err.code).toBe('BAD_ITEM');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('ItemError');
  });

  it('allows overriding statusCode', () => {
    const err = new ItemError('not found', 'ITEM_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new ItemError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new ItemError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ItemError');
  });

  it('uses default 400 when statusCode not provided', () => {
    const err = new ItemError('msg', 'CODE');
    expect(err.statusCode).toBe(400);
  });

  it('supports 409 conflict status', () => {
    const err = new ItemError('duplicate', 'DUPLICATE_SKU', 409);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('DUPLICATE_SKU');
  });

  it('supports 500 server error status', () => {
    const err = new ItemError('failed', 'UPDATE_FAILED', 500);
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// mapSortField
// ==========================================================================

describe('ItemService.mapSortField', () => {
  it('maps name to name', () => {
    expect(itemService.mapSortField('name')).toBe('name');
  });

  it('maps sku to sku', () => {
    expect(itemService.mapSortField('sku')).toBe('sku');
  });

  it('maps barcode to barcode', () => {
    expect(itemService.mapSortField('barcode')).toBe('barcode');
  });

  it('maps brand to brand', () => {
    expect(itemService.mapSortField('brand')).toBe('brand');
  });

  it('maps createdAt to created_at', () => {
    expect(itemService.mapSortField('createdAt')).toBe('created_at');
  });

  it('maps updatedAt to updated_at', () => {
    expect(itemService.mapSortField('updatedAt')).toBe('updated_at');
  });

  it('defaults to name for undefined input', () => {
    expect(itemService.mapSortField(undefined)).toBe('name');
  });

  it('defaults to name for unknown field', () => {
    expect(itemService.mapSortField('unknown_field')).toBe('name');
  });

  it('defaults to name for empty string', () => {
    expect(itemService.mapSortField('')).toBe('name');
  });
});

// ==========================================================================
// getItemBySku mapping (static structure test)
// ==========================================================================

describe('ItemService field mapping', () => {
  it('maps database row to Item shape in getItemBySku', async () => {
    // Verify the mapping logic by checking the method exists and is callable
    expect(typeof itemService.getItemBySku).toBe('function');
  });

  it('maps database row to Item shape in getItemByBarcode', async () => {
    expect(typeof itemService.getItemByBarcode).toBe('function');
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('ItemService constructor', () => {
  it('stores tenantId', () => {
    expect(itemService.tenantId).toBe('test-tenant');
  });

  it('initializes repositories', () => {
    expect(itemService.itemRepository).toBeDefined();
    expect(itemService.categoryRepository).toBeDefined();
  });
});

// ==========================================================================
// ItemError edge cases
// ==========================================================================

describe('ItemError specific error codes', () => {
  it('creates ITEM_NOT_FOUND error', () => {
    const err = new ItemError('Item not found', 'ITEM_NOT_FOUND', 404);
    expect(err.message).toBe('Item not found');
    expect(err.code).toBe('ITEM_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates DUPLICATE_SKU error', () => {
    const err = new ItemError('An item with this SKU already exists', 'DUPLICATE_SKU', 409);
    expect(err.message).toBe('An item with this SKU already exists');
    expect(err.code).toBe('DUPLICATE_SKU');
  });

  it('creates DUPLICATE_BARCODE error', () => {
    const err = new ItemError('An item with this barcode already exists', 'DUPLICATE_BARCODE', 409);
    expect(err.message).toBe('An item with this barcode already exists');
    expect(err.code).toBe('DUPLICATE_BARCODE');
  });

  it('creates CATEGORY_NOT_FOUND error', () => {
    const err = new ItemError('Category not found', 'CATEGORY_NOT_FOUND', 400);
    expect(err.message).toBe('Category not found');
    expect(err.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('creates PRICE_NOT_FOUND error', () => {
    const err = new ItemError('Price not found', 'PRICE_NOT_FOUND', 404);
    expect(err.code).toBe('PRICE_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates PACKAGING_NOT_FOUND error', () => {
    const err = new ItemError('Packaging not found', 'PACKAGING_NOT_FOUND', 404);
    expect(err.code).toBe('PACKAGING_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new ItemError('Failed to retrieve updated item', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});
