/**
 * POS Routes
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { Router, Request } from 'express';
import { POSService } from '../services/pos.service';
import { validateBody, validateParams } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { idempotencyMiddleware } from '../middleware/idempotency';
import {
  createPOSLocationSchema,
  updatePOSLocationSchema,
  posLocationIdParamSchema,
  quickSaleRequestSchema,
} from '@erp/shared';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);
// Safe replay of offline-synced writes (Idempotency-Key header).
router.use(idempotencyMiddleware);

function getPOSService(req: Request) {
  const { supabase, tenantId } = getTenantContext(req);
  return new POSService(supabase, tenantId);
}

/**
 * GET /pos
 * Get all POS locations for the authenticated tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req);
    const activeOnly = req.query.active === 'true';
    const posService = getPOSService(req);

    const locations = await posService.getAllLocations(tenantId, activeOnly);

    res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /pos/:id
 * Get a single POS location by ID
 */
router.get(
  '/:id',
  validateParams(posLocationIdParamSchema),
  async (req, res, next) => {
    try {
      const { tenantId } = getTenantContext(req);
      const { id } = req.params;
      const posService = getPOSService(req);

      const location = await posService.getLocationById(id, tenantId);

      if (!location) {
        return void res.status(404).json({
          success: false,
          error: 'POS location not found',
        });
      }

      res.json({
        success: true,
        data: location,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pos
 * Create a new POS location
 */
router.post(
  '/',
  requirePermission('pos:write'),
  validateBody(createPOSLocationSchema),
  async (req, res, next) => {
    try {
      const { tenantId } = getTenantContext(req);
      const locationData = req.body;
      const posService = getPOSService(req);

      const newLocation = await posService.createLocation(tenantId, locationData);

      res.status(201).json({
        success: true,
        data: newLocation,
        message: 'POS location created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /pos/:id
 * Update an existing POS location
 */
router.put(
  '/:id',
  requirePermission('pos:write'),
  validateParams(posLocationIdParamSchema),
  validateBody(updatePOSLocationSchema),
  async (req, res, next) => {
    try {
      const { tenantId } = getTenantContext(req);
      const { id } = req.params;
      const updateData = req.body;
      const posService = getPOSService(req);

      const updatedLocation = await posService.updateLocation(id, tenantId, updateData);

      res.json({
        success: true,
        data: updatedLocation,
        message: 'POS location updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /pos/:id
 * Delete a POS location (soft delete)
 */
router.delete(
  '/:id',
  requirePermission('pos:delete'),
  validateParams(posLocationIdParamSchema),
  async (req, res, next) => {
    try {
      const { tenantId } = getTenantContext(req);
      const { id } = req.params;
      const posService = getPOSService(req);

      await posService.deleteLocation(id, tenantId);

      res.json({
        success: true,
        message: 'POS location deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /pos/:id/sale
 * Process a quick sale from the POS terminal
 */
router.post(
  '/:id/sale',
  requirePermission('pos:write'),
  validateParams(posLocationIdParamSchema),
  validateBody(quickSaleRequestSchema),
  async (req, res, next) => {
    try {
      const { tenantId, userId } = getTenantContext(req);
      const { id } = req.params;
      const saleData = req.body;
      const posService = getPOSService(req);

      const result = await posService.processQuickSale(id, tenantId, userId, saleData);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Sale processed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /pos/warehouse/:warehouseId
 * Get POS locations by warehouse ID
 */
router.get('/warehouse/:warehouseId', async (req, res, next) => {
  try {
    const { tenantId } = getTenantContext(req);
    const { warehouseId } = req.params;
    const posService = getPOSService(req);

    const locations = await posService.getLocationsByWarehouse(warehouseId, tenantId);

    res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
