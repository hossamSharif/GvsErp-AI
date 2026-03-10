/**
 * Invoices API Routes
 *
 * RESTful endpoints for invoice management (sales and purchases).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { InvoiceService, InvoiceError } from '../services/invoice.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
  finalizeInvoiceSchema,
  returnInvoiceSchema,
} from '@erp/shared';
import type { InvoiceQueryParams } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
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
 * Error handler for invoice-specific errors
 */
function handleInvoiceError(error: unknown, res: Response, next: NextFunction): void {
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
// INVOICE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /invoices
 * List invoices with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: invoiceQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const params = req.query as unknown as InvoiceQueryParams;

      const result = await service.getInvoices(params);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

/**
 * POST /invoices
 * Create a new invoice (draft status)
 */
router.post(
  '/',
  requirePermission('invoices:write'),
  validateRequest({ body: createInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const invoice = await service.createInvoice(req.body);

      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

/**
 * GET /invoices/:id
 * Get a single invoice by ID with all relations
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const invoice = await service.getInvoice(req.params.id);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

/**
 * PUT /invoices/:id
 * Update a draft invoice
 */
router.put(
  '/:id',
  requirePermission('invoices:write'),
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const invoice = await service.updateInvoice(req.params.id, req.body);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

/**
 * DELETE /invoices/:id
 * Cancel a draft invoice (soft delete via status change)
 */
router.delete(
  '/:id',
  requirePermission('invoices:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const invoice = await service.cancelInvoice(req.params.id);

      res.json({
        success: true,
        data: invoice,
        message: 'Invoice canceled successfully',
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

// =============================================================================
// FINALIZATION ENDPOINTS
// =============================================================================

/**
 * POST /invoices/:id/finalize
 * Finalize an invoice - apply stock movements and update party balance
 */
router.post(
  '/:id/finalize',
  requirePermission('invoices:finalize'),
  validateRequest({ body: finalizeInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const result = await service.finalizeInvoice(req.params.id, req.body);

      res.json({
        success: true,
        data: result.invoice,
        meta: {
          stockMovements: result.stockMovements,
          partyBalanceUpdate: result.partyBalanceUpdate,
        },
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

// =============================================================================
// RETURN ENDPOINTS
// =============================================================================

/**
 * POST /invoices/:id/return
 * Create a return invoice from a finalized invoice
 */
router.post(
  '/:id/return',
  requirePermission('invoices:write'),
  validateRequest({ body: returnInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const result = await service.createReturn(req.params.id, req.body);

      res.status(201).json({
        success: true,
        data: {
          returnInvoice: result.returnInvoice,
          originalInvoice: result.originalInvoice,
        },
        meta: {
          stockMovements: result.stockMovements,
        },
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

// =============================================================================
// LOOKUP ENDPOINTS
// =============================================================================

/**
 * GET /invoices/by-number/:invoiceNumber
 * Find invoice by invoice number
 */
router.get(
  '/by-number/:invoiceNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const invoice = await service.getInvoiceByNumber(req.params.invoiceNumber);

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INVOICE_NOT_FOUND',
            message: 'Invoice with this number not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

// =============================================================================
// STOCK AVAILABILITY ENDPOINT
// =============================================================================

/**
 * POST /invoices/stock-availability
 * Get stock availability for items in a warehouse
 */
router.post(
  '/stock-availability',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const { warehouseId, itemIds } = req.body as {
        warehouseId: string;
        itemIds: string[];
      };

      if (!warehouseId || !Array.isArray(itemIds) || itemIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'warehouseId and itemIds array are required',
          },
        });
        return;
      }

      const availability = await service.getStockAvailability(warehouseId, itemIds);

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      handleInvoiceError(error, res, next);
    }
  }
);

export default router;
