/**
 * Reports API Routes
 *
 * RESTful endpoints for generating various reports.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { InvoiceService, InvoiceError } from '../services/invoice.service';
import { salesReportParamsSchema, purchaseReportParamsSchema } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create InvoiceService with tenant context
 */
function getInvoiceService(req: Request): InvoiceService {
  const { supabase, tenantId, userId } = getTenantContext(req);
  return new InvoiceService(supabase, tenantId, userId);
}

/**
 * Error handler
 */
function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof InvoiceError) {
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
// SALES REPORTS
// =============================================================================

/**
 * GET /reports/sales
 * Get sales report data with optional summary
 */
router.get(
  '/sales',
  validateRequest({ query: salesReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const params = req.query as unknown as {
        dateFrom?: string;
        dateTo?: string;
        partyId?: string;
        warehouseId?: string;
        status?: string | string[];
        includeSummary?: boolean;
      };

      const report = await service.getSalesReport(params);

      res.json({
        success: true,
        data: report.entries,
        summary: report.summary,
        meta: {
          generatedAt: report.generatedAt,
          total: report.entries.length,
        },
      });
    } catch (error) {
      handleError(error, res, next);
    }
  }
);

// =============================================================================
// PURCHASE REPORTS
// =============================================================================

/**
 * GET /reports/purchases
 * Get purchase report data with optional summary
 */
router.get(
  '/purchases',
  validateRequest({ query: purchaseReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const params = req.query as unknown as {
        dateFrom?: string;
        dateTo?: string;
        partyId?: string;
        warehouseId?: string;
        status?: string | string[];
        includeSummary?: boolean;
      };

      const report = await service.getPurchaseReport(params);

      res.json({
        success: true,
        data: report.entries,
        summary: report.summary,
        meta: {
          generatedAt: report.generatedAt,
          total: report.entries.length,
        },
      });
    } catch (error) {
      handleError(error, res, next);
    }
  }
);

export default router;
