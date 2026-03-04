import { describe, it, expect } from 'vitest';
import { CategoryService, CategoryError } from '../../src/services/category.service';

/**
 * Unit tests for CategoryService pure business logic.
 * Tests error class and searchCategories guard — no DB mocks needed.
 */

const categoryService = new (CategoryService as any)(null, 'test-tenant');

// ==========================================================================
// CategoryError
// ==========================================================================

describe('CategoryError', () => {
  it('sets message, code, and default statusCode', () => {
    const err = new CategoryError('bad category', 'BAD_CATEGORY');
    expect(err.message).toBe('bad category');
    expect(err.code).toBe('BAD_CATEGORY');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('CategoryError');
  });

  it('allows overriding statusCode', () => {
    const err = new CategoryError('not found', 'CATEGORY_NOT_FOUND', 404);
    expect(err.statusCode).toBe(404);
  });

  it('is an instance of Error', () => {
    const err = new CategoryError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves stack trace', () => {
    const err = new CategoryError('stack test', 'STACK');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('CategoryError');
  });

  it('supports 500 server error status', () => {
    const err = new CategoryError('update failed', 'UPDATE_FAILED', 500);
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// CategoryError — all error codes used in service
// ==========================================================================

describe('CategoryError specific codes', () => {
  it('creates CATEGORY_NOT_FOUND error', () => {
    const err = new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    expect(err.code).toBe('CATEGORY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates PARENT_NOT_FOUND error', () => {
    const err = new CategoryError('Parent category not found', 'PARENT_NOT_FOUND', 404);
    expect(err.code).toBe('PARENT_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates MAX_DEPTH_EXCEEDED error', () => {
    const err = new CategoryError(
      'Cannot create category: maximum depth of 5 levels would be exceeded',
      'MAX_DEPTH_EXCEEDED',
      400
    );
    expect(err.code).toBe('MAX_DEPTH_EXCEEDED');
    expect(err.statusCode).toBe(400);
  });

  it('creates INVALID_MOVE error', () => {
    const err = new CategoryError('Invalid move', 'INVALID_MOVE', 400);
    expect(err.code).toBe('INVALID_MOVE');
  });

  it('creates HAS_CHILDREN error', () => {
    const err = new CategoryError(
      'Cannot delete category with subcategories. Delete or move subcategories first.',
      'HAS_CHILDREN',
      400
    );
    expect(err.code).toBe('HAS_CHILDREN');
  });

  it('creates HAS_ITEMS error', () => {
    const err = new CategoryError(
      'Cannot delete category with items. Move items to another category first.',
      'HAS_ITEMS',
      400
    );
    expect(err.code).toBe('HAS_ITEMS');
  });

  it('creates UPDATE_FAILED error', () => {
    const err = new CategoryError('Failed to update category', 'UPDATE_FAILED', 500);
    expect(err.code).toBe('UPDATE_FAILED');
    expect(err.statusCode).toBe(500);
  });
});

// ==========================================================================
// searchCategories guard
// ==========================================================================

describe('CategoryService.searchCategories', () => {
  it('returns empty array for empty string', async () => {
    const result = await categoryService.searchCategories('');
    expect(result).toEqual([]);
  });

  it('returns empty array for undefined-like input', async () => {
    const result = await categoryService.searchCategories(null as any);
    expect(result).toEqual([]);
  });
});

// ==========================================================================
// Constructor
// ==========================================================================

describe('CategoryService constructor', () => {
  it('stores tenantId', () => {
    expect(categoryService.tenantId).toBe('test-tenant');
  });

  it('initializes repository', () => {
    expect(categoryService.repository).toBeDefined();
  });
});
