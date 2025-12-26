/**
 * Expense Category Routes
 * API endpoints for expense category management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
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
 * GET /expense-categories
 * Get all expense categories
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    const categories = await expenseService.getCategories(tenantId);

    res.json({ data: categories });
  } catch (error: any) {
    console.error('Error fetching expense categories:', error);

    res.status(500).json({
      error: 'Failed to fetch expense categories',
      message: error.message,
    });
  }
});

/**
 * GET /expense-categories/root
 * Get root categories (categories without parent)
 */
router.get('/root', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    const categories = await expenseService.getRootCategories(tenantId);

    res.json({ data: categories });
  } catch (error: any) {
    console.error('Error fetching root categories:', error);

    res.status(500).json({
      error: 'Failed to fetch root categories',
      message: error.message,
    });
  }
});

/**
 * GET /expense-categories/:id
 * Get a single expense category by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    const category = await expenseService.getCategoryById(id, tenantId);

    res.json(category);
  } catch (error: any) {
    console.error('Error fetching expense category:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error.message === 'Category not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to fetch expense category',
      message: error.message,
    });
  }
});

/**
 * GET /expense-categories/:id/children
 * Get child categories of a parent category
 */
router.get('/:id/children', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    const children = await expenseService.getChildCategories(id, tenantId);

    res.json({ data: children });
  } catch (error: any) {
    console.error('Error fetching child categories:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to fetch child categories',
      message: error.message,
    });
  }
});

/**
 * POST /expense-categories
 * Create a new expense category
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate request body
    const validatedData = createExpenseCategorySchema.parse(req.body);

    const category = await expenseService.createCategory(tenantId, validatedData);

    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating expense category:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (error.message === 'Parent category not found') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to create expense category',
      message: error.message,
    });
  }
});

/**
 * PUT /expense-categories/:id
 * Update an existing expense category
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    // Validate request body
    const validatedData = updateExpenseCategorySchema.parse(req.body);

    const category = await expenseService.updateCategory(
      id,
      tenantId,
      validatedData
    );

    res.json(category);
  } catch (error: any) {
    console.error('Error updating expense category:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (
      error.message === 'Category not found' ||
      error.message === 'Parent category not found' ||
      error.message === 'Category cannot be its own parent'
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to update expense category',
      message: error.message,
    });
  }
});

/**
 * DELETE /expense-categories/:id
 * Delete an expense category
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const expenseService = getExpenseService(req);

    // Validate UUID parameter
    const { id } = uuidParamSchema.parse(req.params);

    await expenseService.deleteCategory(id, tenantId);

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting expense category:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    if (
      error.message === 'Category not found' ||
      error.message === 'Cannot delete category with subcategories' ||
      error.message === 'Cannot delete category that is used by expenses'
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to delete expense category',
      message: error.message,
    });
  }
});

export default router;
