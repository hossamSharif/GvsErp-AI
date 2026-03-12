/**
 * Parties API Routes
 *
 * RESTful endpoints for party (customer/supplier) management.
 */

import { Router, Request, Response } from 'express';
import { PartyService } from '../services/party.service';
import type { PartyQueryParams } from '@erp/shared';
import {
  createPartySchema,
  updatePartySchema,
  partyQuerySchema,
  customerBalanceReportParamsSchema,
  partyStatementParamsSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create PartyService with tenant context
 */
function getPartyService(req: Request): PartyService {
  const { supabase, tenantId } = getTenantContext(req);
  return new PartyService(supabase, tenantId);
}

// =============================================================================
// PARTY CRUD ENDPOINTS
// =============================================================================

/**
 * GET /parties
 * List parties with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: partyQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const params = req.query as unknown as PartyQueryParams;

    const result = await service.getParties(params);

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
  })
);

/**
 * POST /parties
 * Create a new party
 */
router.post(
  '/',
  requirePermission('parties:write'),
  validateRequest({ body: createPartySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const party = await service.createParty(req.body);

    res.status(201).json({
      success: true,
      data: party,
    });
  })
);

/**
 * GET /parties/:id
 * Get a single party by ID with summary data
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const party = await service.getParty(req.params.id);

    res.json({
      success: true,
      data: party,
    });
  })
);

/**
 * PUT /parties/:id
 * Update a party
 */
router.put(
  '/:id',
  requirePermission('parties:write'),
  validateRequest({ body: updatePartySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const party = await service.updateParty(req.params.id, req.body);

    res.json({
      success: true,
      data: party,
    });
  })
);

/**
 * DELETE /parties/:id
 * Delete a party (soft delete)
 */
router.delete(
  '/:id',
  requirePermission('parties:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    await service.deleteParty(req.params.id);

    res.json({
      success: true,
      message: 'Party deleted successfully',
    });
  })
);

// =============================================================================
// BALANCE ENDPOINTS
// =============================================================================

/**
 * GET /parties/:id/balance
 * Get party balance
 */
router.get(
  '/:id/balance',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const balance = await service.getPartyBalance(req.params.id);

    res.json({
      success: true,
      data: { balance },
    });
  })
);

/**
 * POST /parties/:id/recalculate-balance
 * Recalculate party balance from transactions
 */
router.post(
  '/:id/recalculate-balance',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const balance = await service.recalculateBalance(req.params.id);

    res.json({
      success: true,
      data: { balance },
    });
  })
);

/**
 * GET /parties/balance-summary
 * Get balance summary for all parties
 */
router.get(
  '/summary/balances',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const partyType = req.query.type as 'customer' | 'supplier' | undefined;
    const summary = await service.getBalanceSummary(partyType);

    res.json({
      success: true,
      data: summary,
    });
  })
);

// =============================================================================
// STATEMENT ENDPOINT
// =============================================================================

/**
 * GET /parties/:id/statement
 * Get party statement (transaction history)
 */
router.get(
  '/:id/statement',
  validateRequest({ query: partyStatementParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const params = {
      partyId: req.params.id,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const statement = await service.getPartyStatement(params);

    res.json({
      success: true,
      data: statement,
    });
  })
);

// =============================================================================
// REPORT ENDPOINTS
// =============================================================================

/**
 * GET /parties/reports/customer-balances
 * Get customer balance report
 */
router.get(
  '/reports/customer-balances',
  validateRequest({ query: customerBalanceReportParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getPartyService(req);
    const params = req.query as unknown as {
      hasBalance?: boolean;
      minBalance?: number;
      maxBalance?: number;
      includeInactive?: boolean;
    };

    const report = await service.getCustomerBalanceReport(params);

    res.json({
      success: true,
      data: report,
    });
  })
);

export default router;
