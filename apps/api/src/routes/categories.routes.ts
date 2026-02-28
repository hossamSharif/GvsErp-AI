/**
 * Categories API Routes
 *
 * RESTful endpoints for category management with hierarchical support.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CategoryRepository } from '../repositories/category.repository';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Application error for category-related operations
 */
class CategoryError extends Error {
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
 * Helper to create CategoryRepository with tenant context
 */
function getCategoryRepository(req: Request): { repository: CategoryRepository; tenantId: string } {
  const { supabase, tenantId } = getTenantContext(req);
  return {
    repository: new CategoryRepository(supabase),
    tenantId,
  };
}

/**
 * Error handler for category-specific errors
 */
function handleCategoryError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof CategoryError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }
  next(error);
}

// =============================================================================
// CATEGORY CRUD ENDPOINTS
// =============================================================================

/**
 * GET /categories
 * List categories (flat or tree structure)
 */
router.get(
  '/',
  validateRequest({ query: categoryQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const { parentId, includeTree } = req.query as {
        parentId?: string | null;
        includeTree?: boolean;
      };

      let data;

      if (includeTree) {
        // Return tree structure
        data = await repository.findAsTree(tenantId);
      } else if (parentId === null || parentId === 'null') {
        // Return only root categories
        data = await repository.findRoots(tenantId);
      } else if (parentId) {
        // Return children of specific parent
        data = await repository.findChildren(tenantId, parentId);
      } else {
        // Return flat list
        data = await repository.findAllFlat(tenantId);
      }

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * POST /categories
 * Create a new category
 */
router.post(
  '/',
  validateRequest({ body: createCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const { name, parentId } = req.body;

      // Validate parent exists if provided
      if (parentId) {
        const parentExists = await repository.exists(tenantId, parentId);
        if (!parentExists) {
          throw new CategoryError('Parent category not found', 'PARENT_NOT_FOUND', 404);
        }

        // Check depth limit
        const parentDepth = await repository.getDepth(tenantId, parentId);
        if (parentDepth >= 4) {
          throw new CategoryError(
            'Cannot create category: maximum depth of 5 levels would be exceeded',
            'MAX_DEPTH_EXCEEDED',
            400
          );
        }
      }

      const category = await repository.create(tenantId, {
        name,
        parent_id: parentId || null,
      });

      res.status(201).json({
        success: true,
        data: {
          id: category.id,
          tenantId: category.tenant_id,
          name: category.name,
          parentId: category.parent_id,
          createdAt: category.created_at,
        },
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * GET /categories/:id
 * Get a single category by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const category = await repository.findById(tenantId, req.params.id);

      if (!category) {
        throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      res.json({
        success: true,
        data: {
          id: category.id,
          tenantId: category.tenant_id,
          name: category.name,
          parentId: category.parent_id,
          createdAt: category.created_at,
        },
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * GET /categories/:id/tree
 * Get a category with its full subtree
 */
router.get(
  '/:id/tree',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const category = await repository.findByIdWithChildren(tenantId, req.params.id);

      if (!category) {
        throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * GET /categories/:id/path
 * Get the path from root to this category
 */
router.get(
  '/:id/path',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);

      // Check category exists
      const exists = await repository.exists(tenantId, req.params.id);
      if (!exists) {
        throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      const path = await repository.findPath(tenantId, req.params.id);

      res.json({
        success: true,
        data: path,
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * PUT /categories/:id
 * Update a category
 */
router.put(
  '/:id',
  validateRequest({ body: updateCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const { name, parentId } = req.body;

      // Check category exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      // Validate move if parent is changing
      if (parentId !== undefined && parentId !== existing.parent_id) {
        const validation = await repository.validateMove(tenantId, req.params.id, parentId);
        if (!validation.valid) {
          throw new CategoryError(validation.error || 'Invalid move', 'INVALID_MOVE', 400);
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (parentId !== undefined) updateData.parent_id = parentId;

      const updated = await repository.update(tenantId, req.params.id, updateData);

      if (!updated) {
        throw new CategoryError('Failed to update category', 'UPDATE_FAILED', 500);
      }

      res.json({
        success: true,
        data: {
          id: updated.id,
          tenantId: updated.tenant_id,
          name: updated.name,
          parentId: updated.parent_id,
          createdAt: updated.created_at,
        },
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

/**
 * DELETE /categories/:id
 * Delete a category (if empty)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);

      // Check category exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND', 404);
      }

      // Check for children
      const hasChildren = await repository.hasChildren(tenantId, req.params.id);
      if (hasChildren) {
        throw new CategoryError(
          'Cannot delete category with subcategories. Delete or move subcategories first.',
          'HAS_CHILDREN',
          400
        );
      }

      // Check for items
      const hasItems = await repository.hasItems(tenantId, req.params.id);
      if (hasItems) {
        throw new CategoryError(
          'Cannot delete category with items. Move items to another category first.',
          'HAS_ITEMS',
          400
        );
      }

      await repository.delete(tenantId, req.params.id, false); // Hard delete

      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

// =============================================================================
// SEARCH ENDPOINT
// =============================================================================

/**
 * GET /categories/search
 * Search categories by name
 */
router.get(
  '/search',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { repository, tenantId } = getCategoryRepository(req);
      const query = req.query.q as string;

      if (!query || query.length < 1) {
        res.json({
          success: true,
          data: [],
        });
        return;
      }

      const categories = await repository.search(tenantId, query);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      handleCategoryError(error, res, next);
    }
  }
);

export default router;
