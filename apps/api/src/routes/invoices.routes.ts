/**
 * Invoices API Routes
 *
 * RESTful endpoints for invoice management (sales and purchases).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceShareService } from '../services/invoice-share.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
  finalizeInvoiceSchema,
  returnInvoiceSchema,
} from '@erp/shared';
import type { InvoiceQueryParams, Permission } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);
// Safe replay of offline-synced writes (Idempotency-Key header).
router.use(idempotencyMiddleware);

/**
 * Helper to create InvoiceService with tenant context
 */
function getInvoiceService(req: Request): InvoiceService {
  const { supabase, tenantId, userId } = getTenantContext(req);
  return new InvoiceService(supabase, tenantId, userId);
}

/**
 * Read the `?deletePayments=true|1` opt-in shared by the edit and delete
 * endpoints. Cascading into payments needs the `payments:delete` permission on
 * top of the endpoint's own guard — when the caller opted in without it this
 * responds 403 itself and returns `handled: true`, meaning stop.
 */
function resolveDeletePayments(
  req: Request,
  res: Response
): { deletePayments: boolean; handled: boolean } {
  const deletePayments =
    req.query.deletePayments === 'true' || req.query.deletePayments === '1';

  if (deletePayments) {
    const perms = req.user?.permissions ?? [];
    if (!perms.includes('*' as Permission) && !perms.includes('payments:delete')) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Required permission: payments:delete',
      });
      return { deletePayments, handled: true };
    }
  }

  return { deletePayments, handled: false };
}

const createInvoiceShareSchema = z.object({
  // ~8 MB of PDF once decoded; express.json caps the body at 10 MB.
  pdfBase64: z.string().min(1).max(11_200_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  phone: z.string().regex(/^\d{6,15}$/).optional(),
});

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
      next(error);
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
      next(error);
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
      next(error);
    }
  }
);

/**
 * GET /invoices/:id/balance-snapshot
 * The party's balance before/after this invoice and what was paid with it,
 * as printed by the statement ("كشف بيان") template.
 */
router.get(
  '/:id/balance-snapshot',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const snapshot = await service.getBalanceSnapshot(req.params.id);

      res.json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /invoices/:id/shares
 * Store a browser-rendered invoice PDF and return a short share token for the
 * WhatsApp link (/s/<token>).
 */
router.post(
  '/:id/shares',
  requirePermission('invoices:read'),
  validateRequest({ body: createInvoiceShareSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supabase, tenantId, userId } = getTenantContext(req);
      const service = new InvoiceShareService(supabase, tenantId, userId);
      const share = await service.createShare(req.params.id, req.body);

      res.status(201).json({
        success: true,
        data: share,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /invoices/:id
 * Update an invoice. Drafts are edited freely; finalized invoices are re-mapped
 * with full stock + party-balance reversal/reapply, and are blocked when they
 * have linked payments.
 *
 * Pass `?deletePayments=true` to also delete payments linked *solely* to this
 * invoice before applying the edit (requires the `payments:delete` permission).
 * Payments shared with other invoices are still refused.
 */
router.put(
  '/:id',
  requirePermission('invoices:write'),
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deletePayments, handled } = resolveDeletePayments(req, res);
      if (handled) return;

      const service = getInvoiceService(req);
      const invoice = await service.updateInvoice(req.params.id, req.body, {
        deletePayments,
      });

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /invoices/:id
 * Hard-delete an invoice. Reverses stock + party-balance side effects
 * before removing the row. Blocked when the invoice has linked payments
 * or, for finalized invoices, when a return invoice references it.
 *
 * Pass `?deletePayments=true` to also delete payments linked *solely* to this
 * invoice (requires the `payments:delete` permission). Payments shared with
 * other invoices are still refused.
 */
router.delete(
  '/:id',
  requirePermission('invoices:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deletePayments, handled } = resolveDeletePayments(req, res);
      if (handled) return;

      const service = getInvoiceService(req);
      const result = await service.deleteInvoice(req.params.id, { deletePayments });

      res.json({
        success: true,
        data: result,
        message: 'Invoice deleted successfully',
      });
    } catch (error) {
      next(error);
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
      next(error);
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
      next(error);
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
      next(error);
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
      next(error);
    }
  }
);

export default router;
