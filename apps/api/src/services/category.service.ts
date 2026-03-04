/**
 * Category Service
 *
 * Business logic for category management with hierarchical support.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { CategoryRepository } from '../repositories/category.repository';
import type { Category, CategoryWithChildren } from '@erp/shared';

/**
 * Application error for category-related operations
 */
export class CategoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}

/**
 * Service for Category business logic
 */
export class CategoryService {
  private readonly repository: CategoryRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.repository = new CategoryRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * List categories (flat, tree, roots, or children of a parent)
   */
  async getCategories(options: {
    parentId?: string | null;
    includeTree?: boolean;
  }): Promise<Category[] | CategoryWithChildren[]> {
    const { parentId, includeTree } = options;

    if (includeTree) {
      return this.repository.findAsTree(this.tenantId);
    }
    if (parentId === null || parentId === 'null') {
      return this.repository.findRoots(this.tenantId);
    }
    if (parentId) {
      return this.repository.findChildren(this.tenantId, parentId);
    }
    return this.repository.findAllFlat(this.tenantId);
  }

  /**
   * Get a single category by ID
   */
  async getCategory(id: string): Promise<Category> {
    const category = await this.repository.findById(this.tenantId, id);
    if (!category) {
      throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }
    return {
      id: category.id,
      tenantId: category.tenant_id,
      name: category.name,
      parentId: category.parent_id,
      createdAt: category.created_at,
    };
  }

  /**
   * Get a category with its full subtree
   */
  async getCategoryTree(id: string): Promise<CategoryWithChildren> {
    const category = await this.repository.findByIdWithChildren(this.tenantId, id);
    if (!category) {
      throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }
    return category;
  }

  /**
   * Get the path from root to a category
   */
  async getCategoryPath(id: string): Promise<Category[]> {
    const exists = await this.repository.exists(this.tenantId, id);
    if (!exists) {
      throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }
    return this.repository.findPath(this.tenantId, id);
  }

  /**
   * Create a new category
   */
  async createCategory(input: { name: string; parentId?: string | null }): Promise<Category> {
    if (input.parentId) {
      const parentExists = await this.repository.exists(this.tenantId, input.parentId);
      if (!parentExists) {
        throw new CategoryError('Parent category not found', 'PARENT_NOT_FOUND', 404);
      }

      const parentDepth = await this.repository.getDepth(this.tenantId, input.parentId);
      if (parentDepth >= 4) {
        throw new CategoryError(
          'Cannot create category: maximum depth of 5 levels would be exceeded',
          'MAX_DEPTH_EXCEEDED',
          400
        );
      }
    }

    const category = await this.repository.create(this.tenantId, {
      name: input.name,
      parent_id: input.parentId || null,
    });

    return {
      id: category.id,
      tenantId: category.tenant_id,
      name: category.name,
      parentId: category.parent_id,
      createdAt: category.created_at,
    };
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, input: { name?: string; parentId?: string | null }): Promise<Category> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }

    if (input.parentId !== undefined && input.parentId !== existing.parent_id) {
      const validation = await this.repository.validateMove(this.tenantId, id, input.parentId);
      if (!validation.valid) {
        throw new CategoryError(validation.error || 'Invalid move', 'INVALID_MOVE', 400);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.parentId !== undefined) updateData.parent_id = input.parentId;

    const updated = await this.repository.update(this.tenantId, id, updateData);
    if (!updated) {
      throw new CategoryError('Failed to update category', 'UPDATE_FAILED', 500);
    }

    return {
      id: updated.id,
      tenantId: updated.tenant_id,
      name: updated.name,
      parentId: updated.parent_id,
      createdAt: updated.created_at,
    };
  }

  /**
   * Delete a category (must have no children or items)
   */
  async deleteCategory(id: string): Promise<void> {
    const existing = await this.repository.findById(this.tenantId, id);
    if (!existing) {
      throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
    }

    const hasChildren = await this.repository.hasChildren(this.tenantId, id);
    if (hasChildren) {
      throw new CategoryError(
        'Cannot delete category with subcategories. Delete or move subcategories first.',
        'HAS_CHILDREN',
        400
      );
    }

    const hasItems = await this.repository.hasItems(this.tenantId, id);
    if (hasItems) {
      throw new CategoryError(
        'Cannot delete category with items. Move items to another category first.',
        'HAS_ITEMS',
        400
      );
    }

    await this.repository.delete(this.tenantId, id, false);
  }

  /**
   * Search categories by name
   */
  async searchCategories(query: string): Promise<Category[]> {
    if (!query || query.length < 1) {
      return [];
    }
    return this.repository.search(this.tenantId, query);
  }
}
