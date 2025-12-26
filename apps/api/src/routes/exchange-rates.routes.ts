/**
 * Exchange Rates API Routes
 *
 * RESTful endpoints for exchange rate management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExchangeRateRepository } from '../repositories/currency.repository';
import {
  createExchangeRateSchema,
  updateExchangeRateSchema,
} from '@erp-saas/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create ExchangeRateRepository with tenant context
 */
function getExchangeRateRepository(req: Request): ExchangeRateRepository {
  const { supabase } = getTenantContext(req);
  return new ExchangeRateRepository(supabase);
}

/**
 * Error handler for exchange rate-specific errors
 */
function handleExchangeRateError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof Error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'EXCHANGE_RATE_ERROR',
        message: error.message,
      },
    });
    return;
  }
  next(error);
}

// =============================================================================
// EXCHANGE RATE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /exchange-rates
 * List all exchange rates
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      const params = {
        tenantId,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        sort_by: req.query.sortBy as string || 'effective_date',
        sort_order: (req.query.sortDir as 'asc' | 'desc') || 'desc',
      };

      const result = await repository.findAll(params);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

/**
 * POST /exchange-rates
 * Create a new exchange rate
 */
router.post(
  '/',
  validateRequest({ body: createExchangeRateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      const fromCurrency = req.body.from_currency.toUpperCase();
      const toCurrency = (req.body.to_currency || 'USD').toUpperCase();
      const rateType = req.body.rate_type || 'formal';
      const effectiveDate = req.body.effective_date;

      // Check if rate already exists for the same date
      const rateExists = await repository.rateExists(
        tenantId,
        fromCurrency,
        toCurrency,
        rateType,
        effectiveDate
      );

      if (rateExists) {
        res.status(400).json({
          success: false,
          error: {
            code: 'RATE_EXISTS',
            message: 'An exchange rate for this currency pair, type, and date already exists',
          },
        });
        return;
      }

      const rateData = {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate_type: rateType,
        rate: req.body.rate,
        effective_date: effectiveDate,
      };

      const rate = await repository.create(tenantId, rateData);

      res.status(201).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

/**
 * GET /exchange-rates/:id
 * Get a single exchange rate by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);
      const rate = await repository.findById(tenantId, req.params.id);

      if (!rate) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RATE_NOT_FOUND',
            message: 'Exchange rate not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: rate,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

/**
 * PUT /exchange-rates/:id
 * Update an exchange rate
 */
router.put(
  '/:id',
  validateRequest({ body: updateExchangeRateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      // Check if rate exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RATE_NOT_FOUND',
            message: 'Exchange rate not found',
          },
        });
        return;
      }

      // If updating key fields, check for duplicates
      const fromCurrency = req.body.from_currency?.toUpperCase() || existing.from_currency;
      const toCurrency = req.body.to_currency?.toUpperCase() || existing.to_currency;
      const rateType = req.body.rate_type || existing.rate_type;
      const effectiveDate = req.body.effective_date || existing.effective_date;

      if (
        req.body.from_currency ||
        req.body.to_currency ||
        req.body.rate_type ||
        req.body.effective_date
      ) {
        const rateExists = await repository.rateExists(
          tenantId,
          fromCurrency,
          toCurrency,
          rateType,
          effectiveDate,
          req.params.id
        );

        if (rateExists) {
          res.status(400).json({
            success: false,
            error: {
              code: 'RATE_EXISTS',
              message: 'An exchange rate for this currency pair, type, and date already exists',
            },
          });
          return;
        }
      }

      const updates: any = {};
      if (req.body.from_currency !== undefined) updates.from_currency = fromCurrency;
      if (req.body.to_currency !== undefined) updates.to_currency = toCurrency;
      if (req.body.rate_type !== undefined) updates.rate_type = rateType;
      if (req.body.rate !== undefined) updates.rate = req.body.rate;
      if (req.body.effective_date !== undefined) updates.effective_date = effectiveDate;

      const rate = await repository.update(tenantId, req.params.id, updates);

      if (!rate) {
        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update exchange rate',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: rate,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

/**
 * DELETE /exchange-rates/:id
 * Delete an exchange rate
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      const deleted = await repository.delete(tenantId, req.params.id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RATE_NOT_FOUND',
            message: 'Exchange rate not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Exchange rate deleted successfully',
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

// =============================================================================
// EXCHANGE RATE QUERY ENDPOINTS
// =============================================================================

/**
 * GET /exchange-rates/latest/rate
 * Get the latest exchange rate for a currency pair
 */
router.get(
  '/latest/rate',
  validateRequest({
    query: z.object({
      from: z.string().min(2).max(5),
      to: z.string().min(2).max(5).optional().default('USD'),
      type: z.enum(['formal', 'black_market']).optional().default('formal'),
      asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      const fromCurrency = (req.query.from as string).toUpperCase();
      const toCurrency = ((req.query.to as string) || 'USD').toUpperCase();
      const rateType = (req.query.type as 'formal' | 'black_market') || 'formal';
      const asOfDate = req.query.asOfDate as string | undefined;

      const rate = await repository.getLatestRate(
        tenantId,
        fromCurrency,
        toCurrency,
        rateType,
        asOfDate
      );

      if (!rate) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RATE_NOT_FOUND',
            message: 'No exchange rate found for the specified criteria',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: rate,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

/**
 * GET /exchange-rates/range/rates
 * Get exchange rates within a date range
 */
router.get(
  '/range/rates',
  validateRequest({
    query: z.object({
      from: z.string().min(2).max(5),
      to: z.string().min(2).max(5).optional().default('USD'),
      type: z.enum(['formal', 'black_market']).optional().default('formal'),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getExchangeRateRepository(req);

      const fromCurrency = (req.query.from as string).toUpperCase();
      const toCurrency = ((req.query.to as string) || 'USD').toUpperCase();
      const rateType = (req.query.type as 'formal' | 'black_market') || 'formal';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const rates = await repository.getRatesInRange(
        tenantId,
        fromCurrency,
        toCurrency,
        rateType,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: rates,
      });
    } catch (error) {
      handleExchangeRateError(error, res, next);
    }
  }
);

export default router;
