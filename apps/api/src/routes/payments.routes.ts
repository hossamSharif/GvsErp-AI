/**
 * Payments API Routes
 *
 * RESTful endpoints for payment management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService, PaymentError } from '../services/payment.service';
import {
  createPaymentSchema,
  updatePaymentSchema,
  paymentQuerySchema,
  paymentReportParamsSchema,
} from '@erp-saas/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create PaymentService with tenant context
 */
function getPaymentService(req: Request): PaymentService {
  const { supabase, tenantId } = getTenantContext(req);
  return new PaymentService(supabase, tenantId);
}

/**
 * Error handler for payment-specific errors
 */
function handlePaymentError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PaymentError) {
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
// PAYMENT CRUD ENDPOINTS
// =============================================================================

/**
 * GET /payments
 * List payments with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: paymentQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const params = req.query as unknown as {
        type?: 'received' | 'made';
        partyId?: string;
        invoiceId?: string;
        paymentMethod?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
      };

      const result = await service.getPayments(params);

      res.json({
        success: true,
        data: result.data,
        meta: {
          total: result.meta.total,
          page: result.meta.page,
          limit: result.meta.limit,
          hasMore: result.meta.page < result.meta.total_pages,
        },
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

/**
 * POST /payments
 * Create a new payment
 */
router.post(
  '/',
  validateRequest({ body: createPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const userId = (req as any).user?.id; // From auth middleware
      const payment = await service.createPayment(req.body, userId);

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

/**
 * GET /payments/:id
 * Get a single payment by ID with all relations
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const payment = await service.getPayment(req.params.id);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

/**
 * PUT /payments/:id
 * Update a payment (limited fields)
 */
router.put(
  '/:id',
  validateRequest({ body: updatePaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const payment = await service.updatePayment(req.params.id, req.body);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

/**
 * DELETE /payments/:id
 * Delete a payment (reverses balance changes)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      await service.deletePayment(req.params.id);

      res.json({
        success: true,
        message: 'Payment deleted successfully',
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

// =============================================================================
// REPORT ENDPOINTS
// =============================================================================

/**
 * GET /payments/reports/summary
 * Get payment report with summary
 */
router.get(
  '/reports/summary',
  validateRequest({ query: paymentReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const params = req.query as unknown as {
        type?: 'received' | 'made';
        partyId?: string;
        partyType?: 'customer' | 'supplier';
        dateFrom?: string;
        dateTo?: string;
        paymentMethod?: string;
        includeSummary?: boolean;
      };

      const report = await service.getPaymentReport(params);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      handlePaymentError(error, res, next);
    }
  }
);

export default router;
