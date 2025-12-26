/**
 * POS Routes
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 */

import { Router, Request } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { POSService } from '../services/pos.service';
import { validate } from '../middleware/validate';
import {
  createPOSLocationSchema,
  updatePOSLocationSchema,
  posLocationIdParamSchema,
  quickSaleRequestSchema,
} from '@erp-saas/shared';

const router = Router();

/**
 * Get Supabase client for the current request
 */
const getSupabaseClient = (req: Request) => {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

/**
 * GET /pos
 * Get all POS locations for the authenticated tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user!.tenant_id;
    const activeOnly = req.query.active === 'true';

    const supabase = getSupabaseClient(req);
    const posService = new POSService(supabase);
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
  validate(posLocationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenant_id;
      const { id } = req.params;

      const supabase = getSupabaseClient(req);
      const posService = new POSService(supabase);
      const location = await posService.getLocationById(id, tenantId);

      if (!location) {
        return res.status(404).json({
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
  validate(createPOSLocationSchema, 'body'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenant_id;
      const locationData = req.body;

      const supabase = getSupabaseClient(req);
      const posService = new POSService(supabase);
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
  validate(posLocationIdParamSchema, 'params'),
  validate(updatePOSLocationSchema, 'body'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenant_id;
      const { id } = req.params;
      const updateData = req.body;

      const supabase = getSupabaseClient(req);
      const posService = new POSService(supabase);
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
  validate(posLocationIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenant_id;
      const { id } = req.params;

      const supabase = getSupabaseClient(req);
      const posService = new POSService(supabase);
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
  validate(posLocationIdParamSchema, 'params'),
  validate(quickSaleRequestSchema, 'body'),
  async (req, res, next) => {
    try {
      const tenantId = req.user!.tenant_id;
      const userId = req.user!.id;
      const { id } = req.params;
      const saleData = req.body;

      const supabase = getSupabaseClient(req);
      const posService = new POSService(supabase);
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
    const tenantId = req.user!.tenant_id;
    const { warehouseId } = req.params;

    const supabase = getSupabaseClient(req);
    const posService = new POSService(supabase);
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
