/**
 * Currencies API Routes
 *
 * RESTful endpoints for currency management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CurrencyRepository } from '../repositories/currency.repository';
import {
  createCurrencySchema,
  updateCurrencySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create CurrencyRepository with tenant context
 */
function getCurrencyRepository(req: Request): CurrencyRepository {
  const { supabase } = getTenantContext(req);
  return new CurrencyRepository(supabase);
}

/**
 * Error handler for currency-specific errors
 */
function handleCurrencyError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof Error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CURRENCY_ERROR',
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
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);

      const params = {
        tenantId,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      };

      const result = await repository.findAll(params);

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
  validateRequest({ body: createCurrencySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);

      // Check if currency code already exists
      const codeExists = await repository.codeExists(tenantId, req.body.code);
      if (codeExists) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CURRENCY_CODE_EXISTS',
            message: 'A currency with this code already exists',
          },
        });
        return;
      }

      // If this is set as default, no other validation needed - trigger will handle it
      const currencyData = {
        code: req.body.code.toUpperCase(),
        name: req.body.name,
        symbol: req.body.symbol || null,
        is_default: req.body.is_default || false,
      };

      const currency = await repository.create({ tenant_id: tenantId, ...currencyData });

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
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);
      const currency = await repository.findById(tenantId, req.params.id);

      if (!currency) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CURRENCY_NOT_FOUND',
            message: 'Currency not found',
          },
        });
        return;
      }

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
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);
      const currency = await repository.findByCode(tenantId, req.params.code);

      if (!currency) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CURRENCY_NOT_FOUND',
            message: 'Currency not found',
          },
        });
        return;
      }

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
  validateRequest({ body: updateCurrencySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);

      // Check if currency exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CURRENCY_NOT_FOUND',
            message: 'Currency not found',
          },
        });
        return;
      }

      // Check if new code conflicts with existing currency
      if (req.body.code && req.body.code !== existing.code) {
        const codeExists = await repository.codeExists(tenantId, req.body.code, req.params.id);
        if (codeExists) {
          res.status(400).json({
            success: false,
            error: {
              code: 'CURRENCY_CODE_EXISTS',
              message: 'A currency with this code already exists',
            },
          });
          return;
        }
      }

      const updates: any = {};
      if (req.body.code !== undefined) updates.code = req.body.code.toUpperCase();
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.symbol !== undefined) updates.symbol = req.body.symbol;
      if (req.body.is_default !== undefined) updates.is_default = req.body.is_default;

      const currency = await repository.update(tenantId, req.params.id, updates);

      if (!currency) {
        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update currency',
          },
        });
        return;
      }

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);

      // Check if currency exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CURRENCY_NOT_FOUND',
            message: 'Currency not found',
          },
        });
        return;
      }

      // Prevent deleting default currency
      if (existing.is_default) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE_DEFAULT',
            message: 'Cannot delete the default currency. Set another currency as default first.',
          },
        });
        return;
      }

      const deleted = await repository.delete(tenantId, req.params.id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete currency',
          },
        });
        return;
      }

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
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);
      const currency = await repository.getDefault(tenantId);

      if (!currency) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_DEFAULT_CURRENCY',
            message: 'No default currency set',
          },
        });
        return;
      }

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getCurrencyRepository(req);

      // Check if currency exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CURRENCY_NOT_FOUND',
            message: 'Currency not found',
          },
        });
        return;
      }

      const currency = await repository.setDefault(tenantId, req.params.id);

      if (!currency) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SET_DEFAULT_FAILED',
            message: 'Failed to set default currency',
          },
        });
        return;
      }

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
