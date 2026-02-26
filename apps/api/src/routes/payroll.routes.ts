/**
 * Payroll API Routes
 *
 * RESTful endpoints for payroll management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PayrollService, PayrollError } from '../services/payroll.service';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create PayrollService with tenant context
 */
function getPayrollService(req: Request): PayrollService {
  const { supabase, tenantId } = getTenantContext(req);
  return new PayrollService(supabase, tenantId);
}

/**
 * Helper to get user ID from request
 */
function getUserId(req: Request): string {
  const { userId } = getTenantContext(req);
  return userId;
}

/**
 * Error handler for payroll-specific errors
 */
function handlePayrollError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PayrollError) {
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
// PAYROLL RUN ENDPOINTS
// =============================================================================

/**
 * GET /payroll
 * List payroll runs with pagination and filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    const params = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sort_by: (req.query.sort_by as string) || 'created_at',
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      status: req.query.status as 'draft' | 'processing' | 'completed',
      period_start: req.query.period_start as string,
      period_end: req.query.period_end as string,
    };

    const result = await service.getPayrollRuns(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

/**
 * GET /payroll/latest
 * Get latest completed payroll run
 */
router.get('/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    const payrollRun = await service.getLatestPayrollRun();

    res.json({
      success: true,
      data: payrollRun,
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

/**
 * GET /payroll/summary
 * Get payroll summary for a period
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!startDate || !endDate) {
      return void res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'start_date and end_date are required',
        },
      });
    }

    const summary = await service.getPayrollSummary(startDate, endDate);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

/**
 * GET /payroll/:id
 * Get payroll run by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    const payrollRun = await service.getPayrollRun(req.params.id);

    res.json({
      success: true,
      data: payrollRun,
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

/**
 * POST /payroll
 * Create a new payroll run
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    const userId = getUserId(req);
    const { period_start, period_end } = req.body;

    if (!period_start || !period_end) {
      return void res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'period_start and period_end are required',
        },
      });
    }

    const payrollRun = await service.createPayrollRun(userId, {
      period_start,
      period_end,
    });

    res.status(201).json({
      success: true,
      data: payrollRun,
      message: 'Payroll run created successfully',
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

/**
 * POST /payroll/:id/calculate
 * Calculate payroll for a run
 */
router.post(
  '/:id/calculate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPayrollService(req);
      const payrollItems = await service.calculatePayroll(req.params.id);

      res.json({
        success: true,
        data: payrollItems,
        message: 'Payroll calculated successfully',
      });
    } catch (error) {
      handlePayrollError(error, res, next);
    }
  }
);

/**
 * POST /payroll/:id/process
 * Process payroll run (mark as completed and post to accounting)
 */
router.post(
  '/:id/process',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getPayrollService(req);
      const userId = getUserId(req);
      const result = await service.processPayrollRun(req.params.id, userId);

      res.json({
        success: true,
        data: result,
        message: 'Payroll processed successfully',
      });
    } catch (error) {
      handlePayrollError(error, res, next);
    }
  }
);

/**
 * DELETE /payroll/:id
 * Delete a payroll run (only if draft)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getPayrollService(req);
    await service.deletePayrollRun(req.params.id);

    res.json({
      success: true,
      message: 'Payroll run deleted successfully',
    });
  } catch (error) {
    handlePayrollError(error, res, next);
  }
});

export default router;
