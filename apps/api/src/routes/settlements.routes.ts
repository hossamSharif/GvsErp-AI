/**
 * Settlements API Routes
 *
 * RESTful endpoints for inventory settlement (stock adjustment) documents.
 */

import { Router, Request, Response } from 'express';
import { SettlementService } from '../services/settlement.service';
import {
  createSettlementSchema,
  updateSettlementSchema,
  settlementQuerySchema,
  countSheetQuerySchema,
} from '@erp/shared';
import type {
  CountSheetParams,
  SettlementQueryParams,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router: Router = Router();

router.use(requireAuth);
// Safe replay of offline-synced writes (Idempotency-Key header).
router.use(idempotencyMiddleware);

function getSettlementService(req: Request): SettlementService {
  const { supabase, tenantId } = getTenantContext(req);
  return new SettlementService(supabase, tenantId);
}

// =============================================================================
// COUNT SHEET
// =============================================================================

/**
 * GET /settlements/count-sheet
 * Physical-count worksheet for a warehouse: system quantity + suggested cost.
 *
 * Declared before /:id so 'count-sheet' is not swallowed as an id.
 */
router.get(
  '/count-sheet',
  requirePermission('settlements:read'),
  validateRequest({ query: countSheetQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const result = await service.getCountSheet(
      req.query as unknown as CountSheetParams
    );

    res.json({ success: true, data: result.data, meta: result.meta });
  })
);

// =============================================================================
// CRUD
// =============================================================================

/**
 * GET /settlements
 * List settlements with pagination, search, and filters.
 */
router.get(
  '/',
  requirePermission('settlements:read'),
  validateRequest({ query: settlementQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const result = await service.getSettlements(
      req.query as unknown as SettlementQueryParams
    );

    res.json({ success: true, data: result.data, meta: result.meta });
  })
);

/**
 * POST /settlements
 * Create a draft settlement.
 */
router.post(
  '/',
  requirePermission('settlements:write'),
  validateRequest({ body: createSettlementSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const { userId } = getTenantContext(req);
    const settlement = await service.createSettlement(req.body, userId);

    res.status(201).json({ success: true, data: settlement });
  })
);

/**
 * GET /settlements/:id
 */
router.get(
  '/:id',
  requirePermission('settlements:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const settlement = await service.getSettlement(req.params.id);

    res.json({ success: true, data: settlement });
  })
);

/**
 * PUT /settlements/:id
 * Update a draft settlement.
 */
router.put(
  '/:id',
  requirePermission('settlements:write'),
  validateRequest({ body: updateSettlementSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const settlement = await service.updateSettlement(req.params.id, req.body);

    res.json({ success: true, data: settlement });
  })
);

/**
 * DELETE /settlements/:id
 * Delete a draft settlement.
 */
router.delete(
  '/:id',
  requirePermission('settlements:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    await service.deleteSettlement(req.params.id);

    res.json({ success: true, data: { deleted: true } });
  })
);

// =============================================================================
// POSTING
// =============================================================================

/**
 * POST /settlements/:id/post
 * Apply the settlement: correct on-hand, maintain FIFO layers, post the JE.
 */
router.post(
  '/:id/post',
  requirePermission('settlements:post'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const { userId } = getTenantContext(req);
    const result = await service.postSettlement(req.params.id, userId);

    res.json({ success: true, data: result });
  })
);

/**
 * POST /settlements/:id/reverse
 * Undo a posted settlement via a mirror document plus a reversing JE.
 */
router.post(
  '/:id/reverse',
  requirePermission('settlements:post'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getSettlementService(req);
    const { userId } = getTenantContext(req);
    const result = await service.reverseSettlement(req.params.id, userId);

    res.json({ success: true, data: result });
  })
);

export default router;
