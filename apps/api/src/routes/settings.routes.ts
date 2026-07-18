/**
 * Settings API Routes
 *
 * RESTful endpoints for tenant settings management.
 */

import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { AppError, asyncHandler } from '../middleware/error';
import { updateTenantSettingsSchema } from '@erp/shared';
import type { TenantSettings } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { z } from 'zod';

/** Valid top-level keys of TenantSettings for individual get/update */
const validSettingKeys = new Set<string>([
  'default_language', 'default_theme', 'default_currency',
  'modules', 'limits',
  'company_name', 'company_email', 'company_phone', 'company_address',
  'tax_number', 'logo_url',
  'accounting_module_enabled', 'hr_module_enabled',
  'fiscal_year_start', 'time_zone', 'date_format', 'number_format',
  'sales_payment_flow', 'purchase_payment_flow',
]);

function isValidSettingKey(key: string): key is keyof TenantSettings {
  return validSettingKeys.has(key);
}

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create SettingsService with tenant context
 */
function getSettingsService(req: Request): SettingsService {
  const { supabase, tenantId } = getTenantContext(req);
  return new SettingsService(supabase, tenantId);
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.getSettings();

    res.json({
      success: true,
      data: settings,
    });
  })
);

/**
 * PUT /settings
 * Update tenant settings
 */
router.put(
  '/',
  requirePermission('settings:write'),
  validateRequest({ body: updateTenantSettingsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.updateSettings(req.body);

    res.json({
      success: true,
      data: settings,
    });
  })
);

/**
 * POST /settings/reset
 * Reset settings to defaults
 */
router.post(
  '/reset',
  requirePermission('settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.resetSettings();

    res.json({
      success: true,
      data: settings,
      message: 'Settings reset to defaults',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const companyInfo = await service.getCompanyInfo();

    res.json({
      success: true,
      data: companyInfo,
    });
  })
);

/**
 * PUT /settings/company
 * Update company information
 */
router.put(
  '/company',
  requirePermission('settings:write'),
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.updateCompanyInfo(req.body);

    res.json({
      success: true,
      data: settings,
    });
  })
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
  requirePermission('settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.toggleAccountingModule(true);

    res.json({
      success: true,
      data: settings,
      message: 'Accounting module enabled',
    });
  })
);

/**
 * POST /settings/modules/accounting/disable
 * Disable accounting module
 */
router.post(
  '/modules/accounting/disable',
  requirePermission('settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.toggleAccountingModule(false);

    res.json({
      success: true,
      data: settings,
      message: 'Accounting module disabled',
    });
  })
);

/**
 * POST /settings/modules/hr/enable
 * Enable HR module
 */
router.post(
  '/modules/hr/enable',
  requirePermission('settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.toggleHRModule(true);

    res.json({
      success: true,
      data: settings,
      message: 'HR module enabled',
    });
  })
);

/**
 * POST /settings/modules/hr/disable
 * Disable HR module
 */
router.post(
  '/modules/hr/disable',
  requirePermission('settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettingsService(req);
    const settings = await service.toggleHRModule(false);

    res.json({
      success: true,
      data: settings,
      message: 'HR module disabled',
    });
  })
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
  asyncHandler(async (req: Request, res: Response, next) => {
    const key = req.params.key;
    if (!isValidSettingKey(key)) {
      next(AppError.badRequest(`Invalid setting key: ${key}`));
      return;
    }
    const service = getSettingsService(req);
    const value = await service.getSetting(key);

    res.json({
      success: true,
      data: {
        key,
        value,
      },
    });
  })
);

/**
 * PUT /settings/:key
 * Update a specific setting value
 */
router.put(
  '/:key',
  requirePermission('settings:write'),
  validateRequest({
    body: z.object({
      value: z.unknown(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response, next) => {
    const key = req.params.key;
    if (!isValidSettingKey(key)) {
      next(AppError.badRequest(`Invalid setting key: ${key}`));
      return;
    }
    const service = getSettingsService(req);
    const settings = await service.updateSetting(key, req.body.value as TenantSettings[typeof key]);

    res.json({
      success: true,
      data: settings,
    });
  })
);

export default router;
