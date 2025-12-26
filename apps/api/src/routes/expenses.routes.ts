/**
 * Expense Routes
 * API endpoints for expense management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema,
  uuidParamSchema,
} from '@erp-saas/shared/validation/expenses';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to get expense service with tenant context
 */
function getExpenseService(req: Request): ExpenseService {
  const { supabase } = getTenantContext(req);
  return new ExpenseService(supabase);
}

/**
 * Helper to get tenant ID from request
 */
function getTenantId(req: Request): string {
  const { tenantId } = getTenantContext(req);
  return tenantId;
}

/**
 * Helper to get user ID from request
 */
function getUserId(req: Request): string {
  return (req as any).user?.id;
}

/**
 * GET /expenses
 * Get all expenses with filters and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate and parse query parameters
    const filters = expenseFiltersSchema.parse(req.query);

    const { page = 1, limit = 20, ...expenseFilters } = filters;

    const result = await expenseService.getExpenses(
      tenantId,
      expenseFilters,
      page,
      limit
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching expenses:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to fetch expenses',
      message: error.message,
    });
  }
});

/**
 * GET /expenses/:id
 * Get a single expense by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    const expense = await expenseService.getExpenseById(id, tenantId);

    res.json(expense);
  } catch (error: any) {
    console.error('Error fetching expense:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error.message === 'Expense not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to fetch expense',
      message: error.message,
    });
  }
});

/**
 * POST /expenses
 * Create a new expense
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const expenseService = getExpenseService(req);

    // Validate request body
    const validatedData = createExpenseSchema.parse(req.body);

    const expense = await expenseService.createExpense(
      tenantId,
      userId,
      validatedData
    );

    res.status(201).json(expense);
  } catch (error: any) {
    console.error('Error creating expense:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (
      error.message === 'Category not found' ||
      error.message === 'Expense date cannot be in the future'
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to create expense',
      message: error.message,
    });
  }
});

/**
 * PUT /expenses/:id
 * Update an existing expense
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    // Validate request body
    const validatedData = updateExpenseSchema.parse(req.body);

    const expense = await expenseService.updateExpense(id, tenantId, validatedData);

    res.json(expense);
  } catch (error: any) {
    console.error('Error updating expense:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (
      error.message === 'Expense not found' ||
      error.message === 'Category not found' ||
      error.message === 'Expense date cannot be in the future'
    ) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to update expense',
      message: error.message,
    });
  }
});

/**
 * DELETE /expenses/:id
 * Delete an expense
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    await expenseService.deleteExpense(id, tenantId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting expense:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error.message === 'Expense not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to delete expense',
      message: error.message,
    });
  }
});

/**
 * GET /expenses/summary
 * Get expense summary for reporting
 */
router.get('/summary/report', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    const { start_date, end_date, currency } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        error: 'start_date and end_date are required',
      });
    }

    const summary = await expenseService.getExpenseSummary(
      tenantId,
      start_date as string,
      end_date as string,
      currency as string | undefined
    );

    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching expense summary:', error);

    res.status(500).json({
      error: 'Failed to fetch expense summary',
      message: error.message,
    });
  }
});

export default router;
