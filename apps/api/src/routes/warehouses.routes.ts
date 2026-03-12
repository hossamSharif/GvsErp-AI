/**
 * Warehouses API Routes
 *
 * RESTful endpoints for warehouse and inventory management.
 */

import { Router, Request, Response } from 'express';
import { WarehouseService } from '../services/warehouse.service';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseQuerySchema,
  inventoryQuerySchema,
  updateInventoryThresholdSchema,
  bulkUpdateInventoryThresholdSchema,
  lowStockAlertQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create WarehouseService with tenant context
 */
function getWarehouseService(req: Request): WarehouseService {
  const { supabase, tenantId } = getTenantContext(req);
  return new WarehouseService(supabase, tenantId);
}

// =============================================================================
// WAREHOUSE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /warehouses
 * List warehouses with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: warehouseQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const params = req.query as unknown as {
      search?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'createdAt' | 'updatedAt';
      sortDir?: 'asc' | 'desc';
    };

    const result = await service.getWarehouses(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /warehouses/active
 * Get all active warehouses (for dropdowns)
 */
router.get(
  '/active',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouses = await service.getActiveWarehouses();

    res.json({
      success: true,
      data: warehouses,
    });
  })
);

/**
 * POST /warehouses
 * Create a new warehouse
 */
router.post(
  '/',
  requirePermission('warehouses:write'),
  validateRequest({ body: createWarehouseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouse = await service.createWarehouse(req.body);

    res.status(201).json({
      success: true,
      data: warehouse,
    });
  })
);

/**
 * GET /warehouses/:id
 * Get a single warehouse by ID with summary
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouse = await service.getWarehouseWithSummary(req.params.id);

    res.json({
      success: true,
      data: warehouse,
    });
  })
);

/**
 * PUT /warehouses/:id
 * Update a warehouse
 */
router.put(
  '/:id',
  requirePermission('warehouses:write'),
  validateRequest({ body: updateWarehouseSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouse = await service.updateWarehouse(req.params.id, req.body);

    res.json({
      success: true,
      data: warehouse,
    });
  })
);

/**
 * DELETE /warehouses/:id
 * Deactivate a warehouse (soft delete)
 */
router.delete(
  '/:id',
  requirePermission('warehouses:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    await service.deactivateWarehouse(req.params.id);

    res.json({
      success: true,
      message: 'Warehouse deactivated successfully',
    });
  })
);

// =============================================================================
// INVENTORY ENDPOINTS
// =============================================================================

/**
 * GET /warehouses/:id/inventory
 * Get inventory for a warehouse
 */
router.get(
  '/:id/inventory',
  validateRequest({ query: inventoryQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const params = req.query as unknown as {
      search?: string;
      lowStockOnly?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'itemName' | 'quantity' | 'updatedAt';
      sortDir?: 'asc' | 'desc';
    };

    const result = await service.getWarehouseInventory(req.params.id, params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * PUT /warehouses/:id/inventory/thresholds
 * Update low stock threshold for a single item
 */
router.put(
  '/:id/inventory/thresholds',
  requirePermission('warehouses:write'),
  validateRequest({ body: updateInventoryThresholdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const { itemId, lowStockThreshold } = req.body;

    const result = await service.updateLowStockThreshold(
      itemId,
      req.params.id,
      lowStockThreshold
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /warehouses/:id/inventory/thresholds/bulk
 * Bulk update low stock thresholds
 */
router.post(
  '/:id/inventory/thresholds/bulk',
  requirePermission('warehouses:write'),
  validateRequest({ body: bulkUpdateInventoryThresholdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const { thresholds } = req.body;

    const result = await service.bulkUpdateLowStockThresholds(req.params.id, thresholds);

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// LOW STOCK ALERT ENDPOINTS
// =============================================================================

/**
 * GET /warehouses/alerts/low-stock
 * Get all low stock alerts
 */
router.get(
  '/alerts/low-stock',
  validateRequest({ query: lowStockAlertQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const { warehouseId, severity } = req.query as {
      warehouseId?: string;
      severity?: 'critical' | 'warning' | 'low';
    };

    const alerts = await service.getLowStockAlertsWithSeverity(warehouseId, severity);

    res.json({
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
      },
    });
  })
);

/**
 * GET /warehouses/alerts/summary
 * Get low stock summary for dashboard
 */
router.get(
  '/alerts/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const summary = await service.getLowStockSummary();

    res.json({
      success: true,
      data: summary,
    });
  })
);

/**
 * GET /warehouses/alerts/critical
 * Get critical alerts only
 */
router.get(
  '/alerts/critical',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouseId = req.query.warehouseId as string | undefined;
    const alerts = await service.getCriticalAlerts(warehouseId);

    res.json({
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
      },
    });
  })
);

/**
 * GET /warehouses/alerts/reorder-suggestions
 * Get suggested reorder quantities
 */
router.get(
  '/alerts/reorder-suggestions',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const warehouseId = req.query.warehouseId as string | undefined;
    const suggestions = await service.getSuggestedReorders(warehouseId);

    res.json({
      success: true,
      data: suggestions,
      meta: {
        total: suggestions.length,
      },
    });
  })
);

/**
 * GET /warehouses/:id/alerts
 * Get alerts for a specific warehouse
 */
router.get(
  '/:id/alerts',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const alerts = await service.getLowStockAlertsWithSeverity(req.params.id);

    res.json({
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
      },
    });
  })
);

// =============================================================================
// VALUE ENDPOINTS
// =============================================================================

/**
 * GET /warehouses/value/total
 * Get total inventory value across all warehouses
 */
router.get(
  '/value/total',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const value = await service.getTotalInventoryValue();

    res.json({
      success: true,
      data: {
        totalValue: value,
      },
    });
  })
);

/**
 * GET /warehouses/value/by-warehouse
 * Get inventory value breakdown by warehouse
 */
router.get(
  '/value/by-warehouse',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getWarehouseService(req);
    const values = await service.getInventoryValueByWarehouse();

    res.json({
      success: true,
      data: values,
    });
  })
);

export default router;
