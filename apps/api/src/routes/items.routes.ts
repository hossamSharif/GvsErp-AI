/**
 * Items API Routes
 *
 * RESTful endpoints for item management.
 */

import { Router, Request, Response } from 'express';
import { ItemService } from '../services/item.service';
import { ItemGridService } from '../services/item-grid.service';
import { ExpiryAlertsService } from '../services/expiry-alerts.service';
import { ItemMovementService } from '../services/item-movement.service';
import {
  createItemSchema,
  updateItemSchema,
  itemQuerySchema,
  itemGridQuerySchema,
  saveItemGridRowSchema,
  bulkPriceUpdateSchema,
  createItemPriceSchema,
  updateItemPriceSchema,
  createItemPackagingSchema,
  updateItemPackagingSchema,
  itemReportParamsSchema,
  itemMovementParamsSchema,
  expiryQuerySchema,
} from '@erp/shared';
import type { ItemQueryParams, ItemMovementParams, ItemGridQueryParams } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';

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
 * Helper to create ItemGridService with tenant context
 */
function getItemGridService(req: Request): ItemGridService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ItemGridService(supabase, tenantId);
}

/**
 * Helper to create ExpiryAlertsService with tenant context
 */
function getExpiryAlertsService(req: Request): ExpiryAlertsService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ExpiryAlertsService(supabase, tenantId);
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const params = req.query as unknown as ItemQueryParams;

    const result = await service.getItems(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * POST /items
 * Create a new item
 */
router.post(
  '/',
  requirePermission('items:write'),
  validateRequest({ body: createItemSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const item = await service.createItem(req.body);

    res.status(201).json({
      success: true,
      data: item,
    });
  })
);

/**
 * GET /items/report
 * Get items data for report generation.
 * Registered BEFORE /:id so the literal path is not captured by the param route.
 */
router.get(
  '/report',
  validateRequest({ query: itemReportParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// =============================================================================
// ITEM GRID (BULK EDIT) ENDPOINTS
// Registered BEFORE /:id so the literal path is not captured by the param route.
// =============================================================================

/**
 * GET /items/grid
 * Merged item + retail/cost price + warehouse opening-stock rows for the
 * bulk-edit grid, with search, advanced "missing data" filters and pagination.
 */
router.get(
  '/grid',
  validateRequest({ query: itemGridQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemGridService(req);
    const params = req.query as unknown as ItemGridQueryParams;

    const result = await service.getGridRows(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * POST /items/:id/grid-row
 * Save one grid row: item main info, retail price, cost price and opening stock
 * in a single call.
 *
 * Always responds 200 — each section reports its own outcome, so a rejected
 * barcode does not hide a successful price write.
 */
router.post(
  '/:id/grid-row',
  requirePermission('items:write'),
  validateRequest({ body: saveItemGridRowSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getTenantContext(req);
    const service = getItemGridService(req);

    // Opening stock is a warehouse write. Rather than 403 the whole row, let the
    // item/price sections through and fail just that section.
    const permissions = req.user?.permissions ?? [];
    const canWriteOpening =
      permissions.includes('*' as never) || permissions.includes('warehouses:write' as never);

    const result = await service.saveRow(
      req.params.id,
      req.body,
      userId,
      { canWriteOpening }
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// EXPIRY ENDPOINTS
// Registered BEFORE /:id so literal paths are not captured by the param route.
// =============================================================================

/**
 * GET /items/alerts/expiring
 * Get items expiring within N days, with severity
 */
router.get(
  '/alerts/expiring',
  validateRequest({ query: expiryQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getExpiryAlertsService(req);
    const { days, severity } = req.query as unknown as { days: number; severity?: 'expired' | 'critical' | 'warning' };

    const alerts = await service.getExpiringAlerts(days, severity);

    res.json({
      success: true,
      data: alerts,
    });
  })
);

/**
 * GET /items/alerts/expiry-summary
 * Get expiry alert summary counts
 */
router.get(
  '/alerts/expiry-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getExpiryAlertsService(req);
    const summary = await service.getExpirySummary();

    res.json({
      success: true,
      data: summary,
    });
  })
);

/**
 * GET /items/report/expiry
 * Get items expiring within N days for the dedicated expiry report page
 */
router.get(
  '/report/expiry',
  validateRequest({ query: expiryQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getExpiryAlertsService(req);
    const { days, severity } = req.query as unknown as { days: number; severity?: 'expired' | 'critical' | 'warning' };

    const data = await service.getExpiringAlerts(days, severity);

    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        generatedAt: new Date().toISOString(),
      },
    });
  })
);

// =============================================================================
// MOVEMENT REPORT
// =============================================================================

/**
 * GET /items/:id/movement
 * Per-item stock ledger: opening quantity, in/out movements, closing quantity
 * and profitability KPIs for a date range.
 */
router.get(
  '/:id/movement',
  validateRequest({ query: itemMovementParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { supabase, tenantId } = getTenantContext(req);
    const service = new ItemMovementService(supabase, tenantId);
    const params = req.query as unknown as ItemMovementParams;

    const report = await service.getItemMovement(req.params.id, params);

    res.json({
      success: true,
      data: report,
      meta: {
        total: report.movements.length,
        generatedAt: report.generatedAt,
      },
    });
  })
);

/**
 * GET /items/:id
 * Get a single item by ID with all relations
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const item = await service.getItem(req.params.id);

    res.json({
      success: true,
      data: item,
    });
  })
);

/**
 * PUT /items/:id
 * Update an item
 */
router.put(
  '/:id',
  requirePermission('items:write'),
  validateRequest({ body: updateItemSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const item = await service.updateItem(req.params.id, req.body);

    res.json({
      success: true,
      data: item,
    });
  })
);

/**
 * DELETE /items/:id
 * Soft delete an item
 */
router.delete(
  '/:id',
  requirePermission('items:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    await service.deleteItem(req.params.id);

    res.json({
      success: true,
      message: 'Item deleted successfully',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const result = await service.bulkUpdatePrices(req.body);

    res.json({
      success: true,
      data: result,
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * GET /items/by-barcode/:barcode
 * Find item by barcode
 */
router.get(
  '/by-barcode/:barcode',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const prices = await service.getItemPrices(req.params.id);

    res.json({
      success: true,
      data: prices,
    });
  })
);

/**
 * POST /items/:id/prices
 * Add a price to an item
 */
router.post(
  '/:id/prices',
  requirePermission('items:write'),
  validateRequest({ body: createItemPriceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const price = await service.addItemPrice(req.params.id, req.body);

    res.status(201).json({
      success: true,
      data: price,
    });
  })
);

/**
 * PUT /items/:id/prices/:priceId
 * Update an item price
 */
router.put(
  '/:id/prices/:priceId',
  requirePermission('items:write'),
  validateRequest({ body: updateItemPriceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const price = await service.updateItemPrice(req.params.priceId, req.body);

    res.json({
      success: true,
      data: price,
    });
  })
);

/**
 * DELETE /items/:id/prices/:priceId
 * Delete an item price
 */
router.delete(
  '/:id/prices/:priceId',
  requirePermission('items:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    await service.deleteItemPrice(req.params.priceId);

    res.json({
      success: true,
      message: 'Price deleted successfully',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const packagings = await service.getItemPackagings(req.params.id);

    res.json({
      success: true,
      data: packagings,
    });
  })
);

/**
 * POST /items/:id/packagings
 * Add a packaging to an item
 */
router.post(
  '/:id/packagings',
  requirePermission('items:write'),
  validateRequest({ body: createItemPackagingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const packaging = await service.addItemPackaging(req.params.id, req.body);

    res.status(201).json({
      success: true,
      data: packaging,
    });
  })
);

/**
 * PUT /items/:id/packagings/:packagingId
 * Update an item packaging
 */
router.put(
  '/:id/packagings/:packagingId',
  requirePermission('items:write'),
  validateRequest({ body: updateItemPackagingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    const packaging = await service.updateItemPackaging(req.params.packagingId, req.body);

    res.json({
      success: true,
      data: packaging,
    });
  })
);

/**
 * DELETE /items/:id/packagings/:packagingId
 * Delete an item packaging
 */
router.delete(
  '/:id/packagings/:packagingId',
  requirePermission('items:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getItemService(req);
    await service.deleteItemPackaging(req.params.packagingId);

    res.json({
      success: true,
      message: 'Packaging deleted successfully',
    });
  })
);

export default router;
