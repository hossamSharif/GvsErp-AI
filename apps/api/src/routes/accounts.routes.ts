/**
 * Accounts API Routes
 *
 * RESTful endpoints for chart of accounts management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AccountingService } from '../services/accounting.service';
import { createAccountSchema, updateAccountSchema } from '@erp/shared';
import type { AccountType } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const validAccountTypes = new Set<string>(['asset', 'liability', 'equity', 'revenue', 'expense']);

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create AccountingService with tenant context
 */
function getAccountingService(req: Request): AccountingService {
  const { supabase } = getTenantContext(req);
  return new AccountingService(supabase);
}

/**
 * Helper to get tenant ID and user ID
 */
function getContext(req: Request): { tenantId: string; userId: string } {
  const { tenantId, userId } = getTenantContext(req);
  return { tenantId, userId };
}

// =============================================================================
// ACCOUNT CRUD ENDPOINTS
// =============================================================================

/**
 * GET /accounts
 * List accounts (optionally as tree structure)
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { type, tree } = req.query;
      const accountType = typeof type === 'string' && validAccountTypes.has(type)
        ? type as AccountType
        : undefined;

      if (tree === 'true') {
        const accounts = await service.getChartOfAccounts(tenantId, accountType);
        res.json({ success: true, data: accounts });
      } else {
        const accounts = await service.getFlatChartOfAccounts(tenantId, accountType);
        res.json({ success: true, data: accounts });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounts/:id
 * Get account by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const account = await service.getAccount(tenantId, id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /accounts
 * Create new account
 */
router.post(
  '/',
  requirePermission('accounts:write'),
  validateRequest({ body: createAccountSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);

      const account = await service.createAccount(tenantId, req.body);

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /accounts/:id
 * Update account
 */
router.put(
  '/:id',
  requirePermission('accounts:write'),
  validateRequest({ body: updateAccountSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const account = await service.updateAccount(tenantId, id, req.body);

      if (!account) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /accounts/:id
 * Delete account (only if no children and no transactions)
 */
router.delete(
  '/:id',
  requirePermission('accounts:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      await service.deleteAccount(tenantId, id);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounts/:id/children
 * Get child accounts
 */
router.get(
  '/:id/children',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const children = await service.getAccountChildren(tenantId, id);

      res.json({
        success: true,
        data: children,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
