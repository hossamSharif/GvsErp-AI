/**
 * Categories API Routes
 *
 * RESTful endpoints for category management with hierarchical support.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create CategoryService with tenant context
 */
function getCategoryService(req: Request): CategoryService {
  const { supabase, tenantId } = getTenantContext(req);
  return new CategoryService(supabase, tenantId);
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
      const service = getCategoryService(req);
      const { parentId, includeTree } = req.query as {
        parentId?: string | null;
        includeTree?: boolean;
      };

      const data = await service.getCategories({ parentId, includeTree });

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /categories
 * Create a new category
 */
router.post(
  '/',
  requirePermission('categories:write'),
  validateRequest({ body: createCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCategoryService(req);
      const { name, parentId } = req.body;

      const category = await service.createCategory({ name, parentId });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
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
      const service = getCategoryService(req);
      const category = await service.getCategory(req.params.id);

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
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
      const service = getCategoryService(req);
      const category = await service.getCategoryTree(req.params.id);

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
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
      const service = getCategoryService(req);
      const path = await service.getCategoryPath(req.params.id);

      res.json({
        success: true,
        data: path,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /categories/:id
 * Update a category
 */
router.put(
  '/:id',
  requirePermission('categories:write'),
  validateRequest({ body: updateCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCategoryService(req);
      const { name, parentId } = req.body;

      const category = await service.updateCategory(req.params.id, { name, parentId });

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /categories/:id
 * Delete a category (if empty)
 */
router.delete(
  '/:id',
  requirePermission('categories:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCategoryService(req);
      await service.deleteCategory(req.params.id);

      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      next(error);
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
      const service = getCategoryService(req);
      const query = req.query.q as string;

      const categories = await service.searchCategories(query);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
