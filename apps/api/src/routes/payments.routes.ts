/**
 * Payments API Routes
 *
 * RESTful endpoints for payment management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import type { PaymentQueryParams } from '@erp/shared';
import {
  createPaymentSchema,
  updatePaymentSchema,
  paymentQuerySchema,
  paymentReportParamsSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create PaymentService with tenant context
 */
function getPaymentService(req: Request): PaymentService {
  const { supabase, tenantId } = getTenantContext(req);
  return new PaymentService(supabase, tenantId);
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
      const params = req.query as unknown as PaymentQueryParams;

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
      next(error);
    }
  }
);

/**
 * POST /payments
 * Create a new payment
 */
router.post(
  '/',
  requirePermission('payments:write'),
  validateRequest({ body: createPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      const { userId } = getTenantContext(req);
      const payment = await service.createPayment(req.body, userId);

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
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
      next(error);
    }
  }
);

/**
 * PUT /payments/:id
 * Update a payment (limited fields)
 */
router.put(
  '/:id',
  requirePermission('payments:write'),
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
      next(error);
    }
  }
);

/**
 * DELETE /payments/:id
 * Delete a payment (reverses balance changes)
 */
router.delete(
  '/:id',
  requirePermission('payments:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPaymentService(req);
      await service.deletePayment(req.params.id);

      res.json({
        success: true,
        message: 'Payment deleted successfully',
      });
    } catch (error) {
      next(error);
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
      next(error);
    }
  }
);

export default router;
