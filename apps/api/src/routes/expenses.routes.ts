/**
 * Expenses API Routes
 *
 * RESTful endpoints for expense management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import type { ExpenseQueryParams, ExpenseCategoryQueryParams } from '@erp/shared';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  expenseReportParamsSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  expenseCategoryQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

router.use(requireAuth);

function getService(req: Request): ExpenseService {
  const { supabase, tenantId } = getTenantContext(req);
  return new ExpenseService(supabase, tenantId);
}

/**
 * GET /expenses
 * List expenses with pagination, search, and filters
 */
router.get(
  '/',
  requirePermission('expenses:read'),
  validateRequest({ query: expenseQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const params = req.query as unknown as ExpenseQueryParams;
      const result = await service.getExpenses(params);

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
      next(error);
    }
  }
);

// =============================================================================
// CATEGORY ENDPOINTS (declared before /:id)
// =============================================================================

/**
 * GET /expenses/categories
 * List this tenant's expense categories with usage counts
 */
router.get(
  '/categories',
  requirePermission('expenses:read'),
  validateRequest({ query: expenseCategoryQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const params = req.query as unknown as ExpenseCategoryQueryParams;
      const categories = await service.getCategories(params);
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /expenses/categories
 * Create an expense category
 */
router.post(
  '/categories',
  requirePermission('expenses:write'),
  validateRequest({ body: createExpenseCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const category = await service.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /expenses/categories/:id
 * Rename and/or activate/deactivate an expense category
 */
router.put(
  '/categories/:id',
  requirePermission('expenses:write'),
  validateRequest({ body: updateExpenseCategorySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const category = await service.updateCategory(req.params.id, req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /expenses/categories/:id
 * Delete an unused expense category
 */
router.delete(
  '/categories/:id',
  requirePermission('expenses:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      await service.deleteCategory(req.params.id);
      res.json({ success: true, message: 'Expense category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /expenses/reports/summary
 * Get expense report with summary
 */
router.get(
  '/reports/summary',
  requirePermission('expenses:read'),
  validateRequest({ query: expenseReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const params = req.query as unknown as {
        category?: string;
        paymentMethod?: string;
        dateFrom?: string;
        dateTo?: string;
        includeSummary?: boolean;
      };
      const report = await service.getReport(params);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /expenses
 * Create a new expense
 */
router.post(
  '/',
  requirePermission('expenses:write'),
  validateRequest({ body: createExpenseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const { userId } = getTenantContext(req);
      const expense = await service.createExpense(req.body, userId);
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /expenses/:id
 * Get a single expense by ID
 */
router.get(
  '/:id',
  requirePermission('expenses:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const expense = await service.getExpense(req.params.id);
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /expenses/:id
 * Update an expense
 */
router.put(
  '/:id',
  requirePermission('expenses:write'),
  validateRequest({ body: updateExpenseSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      const expense = await service.updateExpense(req.params.id, req.body);
      res.json({ success: true, data: expense });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /expenses/:id
 * Delete an expense
 */
router.delete(
  '/:id',
  requirePermission('expenses:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getService(req);
      await service.deleteExpense(req.params.id);
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
