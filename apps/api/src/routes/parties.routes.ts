/**
 * Parties API Routes
 *
 * RESTful endpoints for party (customer/supplier) management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PartyService, PartyError } from '../services/party.service';
import type { PartyQueryParams } from '@erp/shared';
import {
  createPartySchema,
  updatePartySchema,
  partyQuerySchema,
  customerBalanceReportParamsSchema,
  partyStatementParamsSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create PartyService with tenant context
 */
function getPartyService(req: Request): PartyService {
  const { supabase, tenantId } = getTenantContext(req);
  return new PartyService(supabase, tenantId);
}

/**
 * Error handler for party-specific errors
 */
function handlePartyError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PartyError) {
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
// PARTY CRUD ENDPOINTS
// =============================================================================

/**
 * GET /parties
 * List parties with pagination, search, and filters
 */
router.get(
  '/',
  validateRequest({ query: partyQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * POST /parties
 * Create a new party
 */
router.post(
  '/',
  validateRequest({ body: createPartySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const party = await service.createParty(req.body);

      res.status(201).json({
        success: true,
        data: party,
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * GET /parties/:id
 * Get a single party by ID with summary data
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const party = await service.getParty(req.params.id);

      res.json({
        success: true,
        data: party,
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * PUT /parties/:id
 * Update a party
 */
router.put(
  '/:id',
  validateRequest({ body: updatePartySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const party = await service.updateParty(req.params.id, req.body);

      res.json({
        success: true,
        data: party,
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * DELETE /parties/:id
 * Delete a party (soft delete)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      await service.deleteParty(req.params.id);

      res.json({
        success: true,
        message: 'Party deleted successfully',
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const balance = await service.getPartyBalance(req.params.id);

      res.json({
        success: true,
        data: { balance },
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * POST /parties/:id/recalculate-balance
 * Recalculate party balance from transactions
 */
router.post(
  '/:id/recalculate-balance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const balance = await service.recalculateBalance(req.params.id);

      res.json({
        success: true,
        data: { balance },
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

/**
 * GET /parties/balance-summary
 * Get balance summary for all parties
 */
router.get(
  '/summary/balances',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPartyService(req);
      const partyType = req.query.type as 'customer' | 'supplier' | undefined;
      const summary = await service.getBalanceSummary(partyType);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
      handlePartyError(error, res, next);
    }
  }
);

export default router;
