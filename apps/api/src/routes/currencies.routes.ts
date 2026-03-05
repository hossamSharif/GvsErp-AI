/**
 * Currencies API Routes
 *
 * RESTful endpoints for currency management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CurrencyService, CurrencyError } from '../services/currency.service';
import {
  createCurrencySchema,
  updateCurrencySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create CurrencyService with tenant context
 */
function getCurrencyService(req: Request): CurrencyService {
  const { supabase, tenantId } = getTenantContext(req);
  return new CurrencyService(supabase, tenantId);
}

/**
 * Error handler for currency-specific errors
 */
function handleCurrencyError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof CurrencyError) {
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
// CURRENCY CRUD ENDPOINTS
// =============================================================================

/**
 * GET /currencies
 * List all currencies
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const result = await service.getCurrencies({
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * POST /currencies
 * Create a new currency
 */
router.post(
  '/',
  requirePermission('currencies:write'),
  validateRequest({ body: createCurrencySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.createCurrency(req.body);

      res.status(201).json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * GET /currencies/:id
 * Get a single currency by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.getCurrency(req.params.id);

      res.json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * GET /currencies/code/:code
 * Get a currency by code
 */
router.get(
  '/code/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.getCurrencyByCode(req.params.code);

      res.json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * PUT /currencies/:id
 * Update a currency
 */
router.put(
  '/:id',
  requirePermission('currencies:write'),
  validateRequest({ body: updateCurrencySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.updateCurrency(req.params.id, req.body);

      res.json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * DELETE /currencies/:id
 * Delete a currency
 */
router.delete(
  '/:id',
  requirePermission('currencies:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      await service.deleteCurrency(req.params.id);

      res.json({
        success: true,
        message: 'Currency deleted successfully',
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

// =============================================================================
// DEFAULT CURRENCY ENDPOINTS
// =============================================================================

/**
 * GET /currencies/default/get
 * Get the default currency
 */
router.get(
  '/default/get',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.getDefaultCurrency();

      res.json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

/**
 * POST /currencies/:id/set-default
 * Set a currency as default
 */
router.post(
  '/:id/set-default',
  requirePermission('currencies:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getCurrencyService(req);
      const currency = await service.setDefault(req.params.id);

      res.json({
        success: true,
        data: currency,
      });
    } catch (error) {
      handleCurrencyError(error, res, next);
    }
  }
);

export default router;
