/**
 * Exchange Rates API Routes
 *
 * RESTful endpoints for exchange rate management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExchangeRateService, ExchangeRateError } from '../services/exchange-rate.service';
import {
  createExchangeRateSchema,
  updateExchangeRateSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { z } from 'zod';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create ExchangeRateService with tenant context
 */
function getExchangeRateService(req: Request): ExchangeRateService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ExchangeRateService(supabase, tenantId);
}

/**
 * Error handler for exchange rate-specific errors
 */
function handleExchangeRateError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ExchangeRateError) {
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
      const service = getExchangeRateService(req);
      const result = await service.getRates({
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        sort_by: req.query.sortBy as string || 'effective_date',
        sort_order: (req.query.sortDir as 'asc' | 'desc') || 'desc',
      });

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
      const service = getExchangeRateService(req);
      const rate = await service.createRate(req.body);

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
      const service = getExchangeRateService(req);
      const rate = await service.getRate(req.params.id);

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
      const service = getExchangeRateService(req);
      const rate = await service.updateRate(req.params.id, req.body);

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
      const service = getExchangeRateService(req);
      await service.deleteRate(req.params.id);

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
      const service = getExchangeRateService(req);
      const rate = await service.getLatestRate({
        from: req.query.from as string,
        to: req.query.to as string,
        type: req.query.type as 'formal' | 'black_market',
        asOfDate: req.query.asOfDate as string | undefined,
      });

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
      const service = getExchangeRateService(req);
      const rates = await service.getRatesInRange({
        from: req.query.from as string,
        to: req.query.to as string,
        type: req.query.type as 'formal' | 'black_market',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

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
