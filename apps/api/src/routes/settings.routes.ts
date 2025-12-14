/**
 * Settings API Routes
 *
 * RESTful endpoints for tenant settings management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SettingsService, SettingsError } from '../services/settings.service';
import { updateTenantSettingsSchema } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create SettingsService with tenant context
 */
function getSettingsService(req: Request): SettingsService {
  const { supabase, tenantId } = getTenantContext(req);
  return new SettingsService(supabase, tenantId);
}

/**
 * Error handler for settings-specific errors
 */
function handleSettingsError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof SettingsError) {
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
// SETTINGS ENDPOINTS
// =============================================================================

/**
 * GET /settings
 * Get tenant settings
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.getSettings();

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * PUT /settings
 * Update tenant settings
 */
router.put(
  '/',
  validateRequest({ body: updateTenantSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.updateSettings(req.body);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * POST /settings/reset
 * Reset settings to defaults
 */
router.post(
  '/reset',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.resetSettings();

      res.json({
        success: true,
        data: settings,
        message: 'Settings reset to defaults',
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

// =============================================================================
// COMPANY INFO ENDPOINTS
// =============================================================================

/**
 * GET /settings/company
 * Get company information
 */
router.get(
  '/company',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const companyInfo = await service.getCompanyInfo();

      res.json({
        success: true,
        data: companyInfo,
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * PUT /settings/company
 * Update company information
 */
router.put(
  '/company',
  validateRequest({
    body: z.object({
      company_name: z.string().min(1).max(255).optional(),
      company_email: z.string().email().optional(),
      company_phone: z.string().max(50).optional(),
      company_address: z.string().max(500).optional(),
      tax_number: z.string().max(50).optional(),
      logo_url: z.string().url().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.updateCompanyInfo(req.body);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

// =============================================================================
// MODULE ACTIVATION ENDPOINTS
// =============================================================================

/**
 * POST /settings/modules/accounting/enable
 * Enable accounting module
 */
router.post(
  '/modules/accounting/enable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.toggleAccountingModule(true);

      res.json({
        success: true,
        data: settings,
        message: 'Accounting module enabled',
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * POST /settings/modules/accounting/disable
 * Disable accounting module
 */
router.post(
  '/modules/accounting/disable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.toggleAccountingModule(false);

      res.json({
        success: true,
        data: settings,
        message: 'Accounting module disabled',
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * POST /settings/modules/hr/enable
 * Enable HR module
 */
router.post(
  '/modules/hr/enable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.toggleHRModule(true);

      res.json({
        success: true,
        data: settings,
        message: 'HR module enabled',
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * POST /settings/modules/hr/disable
 * Disable HR module
 */
router.post(
  '/modules/hr/disable',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.toggleHRModule(false);

      res.json({
        success: true,
        data: settings,
        message: 'HR module disabled',
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

// =============================================================================
// SPECIFIC SETTING ENDPOINTS
// =============================================================================

/**
 * GET /settings/:key
 * Get a specific setting value
 */
router.get(
  '/:key',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const value = await service.getSetting(req.params.key as any);

      res.json({
        success: true,
        data: {
          key: req.params.key,
          value,
        },
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

/**
 * PUT /settings/:key
 * Update a specific setting value
 */
router.put(
  '/:key',
  validateRequest({
    body: z.object({
      value: z.any(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getSettingsService(req);
      const settings = await service.updateSetting(req.params.key as any, req.body.value);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      handleSettingsError(error, res, next);
    }
  }
);

export default router;
