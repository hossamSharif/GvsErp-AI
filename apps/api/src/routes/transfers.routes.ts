/**
 * Transfers API Routes
 *
 * RESTful endpoints for stock transfer management.
 */

import { Router, Request, Response } from 'express';
import { TransferService } from '../services/transfer.service';
import {
  createTransferSchema,
  updateTransferSchema,
  transferQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);
// Safe replay of offline-synced writes (Idempotency-Key header).
router.use(idempotencyMiddleware);

/**
 * Helper to create TransferService with tenant context
 */
function getTransferService(req: Request): TransferService {
  const { supabase, tenantId } = getTenantContext(req);
  return new TransferService(supabase, tenantId);
}

// =============================================================================
// TRANSFER CRUD ENDPOINTS
// =============================================================================

/**
 * GET /transfers
 * List transfers with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: transferQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const params = req.query as unknown as {
      status?: 'pending' | 'in_transit' | 'completed' | 'canceled';
      fromWarehouseId?: string;
      toWarehouseId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
      sortBy?: 'transferNumber' | 'status' | 'createdAt' | 'completedAt';
      sortDir?: 'asc' | 'desc';
    };

    const result = await service.getTransfers(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * POST /transfers
 * Create a new transfer
 */
router.post(
  '/',
  requirePermission('transfers:write'),
  validateRequest({ body: createTransferSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const { userId } = getTenantContext(req);
    const transfer = await service.createTransfer(req.body, userId);

    res.status(201).json({
      success: true,
      data: transfer,
    });
  })
);

/**
 * GET /transfers/:id
 * Get a single transfer by ID with details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.getTransfer(req.params.id);

    res.json({
      success: true,
      data: transfer,
    });
  })
);

/**
 * PUT /transfers/:id
 * Update a transfer (only pending transfers)
 */
router.put(
  '/:id',
  requirePermission('transfers:write'),
  validateRequest({ body: updateTransferSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.updateTransfer(req.params.id, req.body);

    res.json({
      success: true,
      data: transfer,
    });
  })
);

// =============================================================================
// TRANSFER STATE TRANSITIONS
// =============================================================================

/**
 * POST /transfers/:id/start
 * Start a transfer (pending -> in_transit)
 * Reserves stock at source warehouse
 */
router.post(
  '/:id/start',
  requirePermission('transfers:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.startTransfer(req.params.id);

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer started, stock reserved at source warehouse',
    });
  })
);

/**
 * POST /transfers/:id/complete
 * Complete a transfer (in_transit -> completed)
 * Moves stock from source to destination
 */
router.post(
  '/:id/complete',
  requirePermission('transfers:complete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.completeTransfer(req.params.id);

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer completed, stock moved to destination warehouse',
    });
  })
);

/**
 * POST /transfers/:id/quick-complete
 * Quick complete a transfer (pending -> completed)
 * For immediate transfers without transit period
 */
router.post(
  '/:id/quick-complete',
  requirePermission('transfers:complete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.quickComplete(req.params.id);

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer completed immediately',
    });
  })
);

/**
 * POST /transfers/:id/cancel
 * Cancel a transfer (pending or in_transit -> canceled)
 * Releases any reserved stock
 */
router.post(
  '/:id/cancel',
  requirePermission('transfers:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const transfer = await service.cancelTransfer(req.params.id);

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer canceled',
    });
  })
);

// =============================================================================
// CONVENIENCE ENDPOINTS
// =============================================================================

/**
 * GET /transfers/warehouse/:warehouseId
 * Get all transfers for a specific warehouse
 */
router.get(
  '/warehouse/:warehouseId',
  validateRequest({ query: transferQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const params = req.query as unknown as {
      status?: 'pending' | 'in_transit' | 'completed' | 'canceled';
      page?: number;
      limit?: number;
      sortBy?: 'transferNumber' | 'status' | 'createdAt' | 'completedAt';
      sortDir?: 'asc' | 'desc';
    };

    // Get transfers where warehouse is either source or destination
    const result = await service.getTransfers({
      ...params,
      warehouseId: req.params.warehouseId,
    });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /transfers/pending
 * Get all pending transfers
 */
router.get(
  '/status/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const result = await service.getTransfers({ status: 'pending' });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /transfers/in-transit
 * Get all in-transit transfers
 */
router.get(
  '/status/in-transit',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const result = await service.getTransfers({ status: 'in_transit' });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  })
);

/**
 * GET /transfers/item/:itemId/availability
 * Get available quantity for an item with pending transfers considered
 */
router.get(
  '/item/:itemId/availability',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getTransferService(req);
    const warehouseId = req.query.warehouseId as string;

    if (!warehouseId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'WAREHOUSE_ID_REQUIRED',
          message: 'warehouseId query parameter is required',
        },
      });
      return;
    }

    const availability = await service.getAvailableWithPending(
      req.params.itemId,
      warehouseId
    );

    res.json({
      success: true,
      data: availability,
    });
  })
);

export default router;
