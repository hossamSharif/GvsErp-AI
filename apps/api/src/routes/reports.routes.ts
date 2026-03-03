/**
 * Reports API Routes
 *
 * RESTful endpoints for generating various reports.
 * Business logic delegated to ReportService and InvoiceService.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InvoiceService, InvoiceError } from '../services/invoice.service';
import { ReportService } from '../services/report.service';
import type { SalesReportParams, PurchaseReportParams } from '@erp/shared';
import { salesReportParamsSchema, purchaseReportParamsSchema } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

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
 * Helper to create ReportService with tenant context
 */
function getReportService(req: Request): ReportService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ReportService(supabase, tenantId);
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
      const params = req.query as unknown as SalesReportParams;

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
      const params = req.query as unknown as PurchaseReportParams;

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

// =============================================================================
// INVENTORY REPORTS
// =============================================================================

/**
 * Inventory Report Query Schema
 */
const inventoryReportQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  lowStockOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  includeZeroStock: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  groupBy: z.enum(['warehouse', 'category', 'item']).default('item'),
  sortBy: z.enum(['itemName', 'quantity', 'value', 'sku']).default('itemName'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  format: z.enum(['json', 'pdf', 'csv']).default('json'),
});

/**
 * GET /reports/inventory
 * Generate comprehensive inventory report with optional filters.
 */
router.get(
  '/inventory',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = inventoryReportQuerySchema.parse(req.query);
      const reportService = getReportService(req);

      const report = await reportService.getInventoryReport(query);

      // Handle CSV format — use flat (ungrouped) data for tabular export
      if (query.format === 'csv') {
        const csvContent = reportService.generateInventoryCsv(report.flatData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.csv"`
        );
        return void res.send(csvContent);
      }

      // Handle PDF format
      if (query.format === 'pdf') {
        return void res.json({
          success: true,
          data: {
            type: 'pdf',
            report: {
              title: 'Inventory Report',
              generatedAt: report.generatedAt,
              filters: {
                warehouseId: query.warehouseId,
                categoryId: query.categoryId,
                lowStockOnly: query.lowStockOnly,
                groupBy: query.groupBy,
              },
              summary: report.summary,
              alertsSummary: report.alertsSummary,
              data: report.data,
            },
          },
        });
      }

      // Default JSON response
      res.json({
        success: true,
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/inventory/valuation
 * Get inventory valuation report grouped by warehouse.
 */
router.get(
  '/inventory/valuation',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportService = getReportService(req);
      const valuation = await reportService.getValuationReport();

      res.json({
        success: true,
        data: valuation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/low-stock
 * Get detailed low stock report with reorder suggestions.
 */
router.get(
  '/low-stock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const querySchema = z.object({
        warehouseId: z.string().uuid().optional(),
        severity: z.enum(['all', 'critical', 'warning', 'low']).default('all'),
      });

      const query = querySchema.parse(req.query);
      const reportService = getReportService(req);

      const report = await reportService.getLowStockReport(query.warehouseId, query.severity);

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
