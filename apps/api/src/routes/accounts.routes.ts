/**
 * Accounts API Routes
 *
 * RESTful endpoints for chart of accounts management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AccountingService, AccountingError } from '../services/accounting.service';
import { createAccountSchema, updateAccountSchema } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

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

/**
 * Error handler for accounting-specific errors
 */
function handleAccountingError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AccountingError) {
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

      if (tree === 'true') {
        // Return hierarchical tree structure
        const accounts = await service.getChartOfAccounts(
          tenantId,
          type as any
        );
        res.json({
          success: true,
          data: accounts,
        });
      } else {
        // Return flat list
        const accounts = await service.getChartOfAccounts(tenantId, type as any);
        // Flatten the tree
        const flatAccounts = flattenTree(accounts);
        res.json({
          success: true,
          data: flatAccounts,
        });
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
      handleAccountingError(error, res, next);
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
      handleAccountingError(error, res, next);
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
      handleAccountingError(error, res, next);
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Flatten hierarchical account tree to flat array
 */
function flattenTree(accounts: any[]): any[] {
  const result: any[] = [];

  function traverse(nodes: any[], depth: number = 0) {
    for (const node of nodes) {
      const { children, ...account } = node;
      result.push({ ...account, depth });
      if (children && children.length > 0) {
        traverse(children, depth + 1);
      }
    }
  }

  traverse(accounts);
  return result;
}

export default router;
