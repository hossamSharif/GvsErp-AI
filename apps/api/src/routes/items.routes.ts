/**
 * Items API Routes
 *
 * RESTful endpoints for item management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ItemService, ItemError } from '../services/item.service';
import {
  createItemSchema,
  updateItemSchema,
  itemQuerySchema,
  bulkPriceUpdateSchema,
  createItemPriceSchema,
  updateItemPriceSchema,
  createItemPackagingSchema,
  updateItemPackagingSchema,
  itemReportParamsSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create ItemService with tenant context
 */
function getItemService(req: Request): ItemService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ItemService(supabase, tenantId);
}

/**
 * Error handler for item-specific errors
 */
function handleItemError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ItemError) {
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
// ITEM CRUD ENDPOINTS
// =============================================================================

/**
 * GET /items
 * List items with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: itemQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const params = req.query as unknown as {
        search?: string;
        categoryId?: string;
        isActive?: boolean;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
      };

      const result = await service.getItems(params as any);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * POST /items
 * Create a new item
 */
router.post(
  '/',
  requirePermission('items:write'),
  validateRequest({ body: createItemSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const item = await service.createItem(req.body);

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * GET /items/:id
 * Get a single item by ID with all relations
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const item = await service.getItem(req.params.id);

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * PUT /items/:id
 * Update an item
 */
router.put(
  '/:id',
  requirePermission('items:write'),
  validateRequest({ body: updateItemSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const item = await service.updateItem(req.params.id, req.body);

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * DELETE /items/:id
 * Soft delete an item
 */
router.delete(
  '/:id',
  requirePermission('items:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      await service.deleteItem(req.params.id);

      res.json({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * POST /items/bulk-price-update
 * Bulk update prices for multiple items
 */
router.post(
  '/bulk-price-update',
  requirePermission('items:write'),
  validateRequest({ body: bulkPriceUpdateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const result = await service.bulkUpdatePrices(req.body);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

// =============================================================================
// LOOKUP ENDPOINTS
// =============================================================================

/**
 * GET /items/by-sku/:sku
 * Find item by SKU
 */
router.get(
  '/by-sku/:sku',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const item = await service.getItemBySku(req.params.sku);

      if (!item) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Item with this SKU not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * GET /items/by-barcode/:barcode
 * Find item by barcode
 */
router.get(
  '/by-barcode/:barcode',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const item = await service.getItemByBarcode(req.params.barcode);

      if (!item) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Item with this barcode not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

// =============================================================================
// PRICE ENDPOINTS
// =============================================================================

/**
 * GET /items/:id/prices
 * Get all prices for an item
 */
router.get(
  '/:id/prices',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const prices = await service.getItemPrices(req.params.id);

      res.json({
        success: true,
        data: prices,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * POST /items/:id/prices
 * Add a price to an item
 */
router.post(
  '/:id/prices',
  requirePermission('items:write'),
  validateRequest({ body: createItemPriceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const price = await service.addItemPrice(req.params.id, req.body);

      res.status(201).json({
        success: true,
        data: price,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * PUT /items/:id/prices/:priceId
 * Update an item price
 */
router.put(
  '/:id/prices/:priceId',
  requirePermission('items:write'),
  validateRequest({ body: updateItemPriceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const price = await service.updateItemPrice(req.params.priceId, req.body);

      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * DELETE /items/:id/prices/:priceId
 * Delete an item price
 */
router.delete(
  '/:id/prices/:priceId',
  requirePermission('items:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      await service.deleteItemPrice(req.params.priceId);

      res.json({
        success: true,
        message: 'Price deleted successfully',
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

// =============================================================================
// PACKAGING ENDPOINTS
// =============================================================================

/**
 * GET /items/:id/packagings
 * Get all packagings for an item
 */
router.get(
  '/:id/packagings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const packagings = await service.getItemPackagings(req.params.id);

      res.json({
        success: true,
        data: packagings,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * POST /items/:id/packagings
 * Add a packaging to an item
 */
router.post(
  '/:id/packagings',
  requirePermission('items:write'),
  validateRequest({ body: createItemPackagingSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const packaging = await service.addItemPackaging(req.params.id, req.body);

      res.status(201).json({
        success: true,
        data: packaging,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * PUT /items/:id/packagings/:packagingId
 * Update an item packaging
 */
router.put(
  '/:id/packagings/:packagingId',
  requirePermission('items:write'),
  validateRequest({ body: updateItemPackagingSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const packaging = await service.updateItemPackaging(req.params.packagingId, req.body);

      res.json({
        success: true,
        data: packaging,
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

/**
 * DELETE /items/:id/packagings/:packagingId
 * Delete an item packaging
 */
router.delete(
  '/:id/packagings/:packagingId',
  requirePermission('items:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      await service.deleteItemPackaging(req.params.packagingId);

      res.json({
        success: true,
        message: 'Packaging deleted successfully',
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

// =============================================================================
// REPORT ENDPOINTS
// =============================================================================

/**
 * GET /items/report
 * Get items data for report generation
 */
router.get(
  '/report',
  validateRequest({ query: itemReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getItemService(req);
      const params = req.query as unknown as {
        categoryId?: string;
        isActive?: boolean;
        includePrices?: boolean;
        priceTier?: string;
        currency?: string;
      };

      const data = await service.getItemsForReport(params);

      res.json({
        success: true,
        data,
        meta: {
          total: data.length,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      handleItemError(error, res, next);
    }
  }
);

export default router;
