/**
 * Warehouses API Routes
 *
 * RESTful endpoints for warehouse and inventory management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { WarehouseService, WarehouseError } from '../services/warehouse.service';
import { AlertsService } from '../services/alerts.service';
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
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create WarehouseService with tenant context
 */
function getWarehouseService(req: Request): WarehouseService {
  const { supabase, tenantId } = getTenantContext(req);
  return new WarehouseService(supabase, tenantId);
}

/**
 * Helper to create AlertsService with tenant context
 */
function getAlertsService(req: Request): AlertsService {
  const { supabase, tenantId } = getTenantContext(req);
  return new AlertsService(supabase, tenantId);
}

/**
 * Error handler for warehouse-specific errors
 */
function handleWarehouseError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof WarehouseError) {
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
// WAREHOUSE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /warehouses
 * List warehouses with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: warehouseQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/active
 * Get all active warehouses (for dropdowns)
 */
router.get(
  '/active',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const warehouses = await service.getActiveWarehouses();

      res.json({
        success: true,
        data: warehouses,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * POST /warehouses
 * Create a new warehouse
 */
router.post(
  '/',
  validateRequest({ body: createWarehouseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const warehouse = await service.createWarehouse(req.body);

      res.status(201).json({
        success: true,
        data: warehouse,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/:id
 * Get a single warehouse by ID with summary
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const warehouse = await service.getWarehouseWithSummary(req.params.id);

      res.json({
        success: true,
        data: warehouse,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * PUT /warehouses/:id
 * Update a warehouse
 */
router.put(
  '/:id',
  validateRequest({ body: updateWarehouseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const warehouse = await service.updateWarehouse(req.params.id, req.body);

      res.json({
        success: true,
        data: warehouse,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * DELETE /warehouses/:id
 * Deactivate a warehouse (soft delete)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      await service.deactivateWarehouse(req.params.id);

      res.json({
        success: true,
        message: 'Warehouse deactivated successfully',
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * PUT /warehouses/:id/inventory/thresholds
 * Update low stock threshold for a single item
 */
router.put(
  '/:id/inventory/thresholds',
  validateRequest({ body: updateInventoryThresholdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * POST /warehouses/:id/inventory/thresholds/bulk
 * Bulk update low stock thresholds
 */
router.post(
  '/:id/inventory/thresholds/bulk',
  validateRequest({ body: bulkUpdateInventoryThresholdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const { thresholds } = req.body;

      const result = await service.bulkUpdateLowStockThresholds(req.params.id, thresholds);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertsService = getAlertsService(req);
      const { warehouseId, severity } = req.query as {
        warehouseId?: string;
        severity?: 'critical' | 'warning' | 'low';
      };

      const alerts = await alertsService.getLowStockAlerts(warehouseId, severity);

      res.json({
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
        },
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/alerts/summary
 * Get low stock summary for dashboard
 */
router.get(
  '/alerts/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertsService = getAlertsService(req);
      const summary = await alertsService.getLowStockSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/alerts/critical
 * Get critical alerts only
 */
router.get(
  '/alerts/critical',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertsService = getAlertsService(req);
      const warehouseId = req.query.warehouseId as string | undefined;
      const alerts = await alertsService.getCriticalAlerts(warehouseId);

      res.json({
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
        },
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/alerts/reorder-suggestions
 * Get suggested reorder quantities
 */
router.get(
  '/alerts/reorder-suggestions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertsService = getAlertsService(req);
      const warehouseId = req.query.warehouseId as string | undefined;
      const suggestions = await alertsService.getSuggestedReorders(warehouseId);

      res.json({
        success: true,
        data: suggestions,
        meta: {
          total: suggestions.length,
        },
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/:id/alerts
 * Get alerts for a specific warehouse
 */
router.get(
  '/:id/alerts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alertsService = getAlertsService(req);
      const alerts = await alertsService.getLowStockAlerts(req.params.id);

      res.json({
        success: true,
        data: alerts,
        meta: {
          total: alerts.length,
        },
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const value = await service.getTotalInventoryValue();

      res.json({
        success: true,
        data: {
          totalValue: value,
        },
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

/**
 * GET /warehouses/value/by-warehouse
 * Get inventory value breakdown by warehouse
 */
router.get(
  '/value/by-warehouse',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getWarehouseService(req);
      const values = await service.getInventoryValueByWarehouse();

      res.json({
        success: true,
        data: values,
      });
    } catch (error) {
      handleWarehouseError(error, res, next);
    }
  }
);

export default router;
