/**
 * Employees API Routes
 *
 * RESTful endpoints for employee management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { EmployeeService, EmployeeError } from '../services/employee.service';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create EmployeeService with tenant context
 */
function getEmployeeService(req: Request): EmployeeService {
  const { supabase, tenantId } = getTenantContext(req);
  return new EmployeeService(supabase, tenantId);
}

/**
 * Error handler for employee-specific errors
 */
function handleEmployeeError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof EmployeeError) {
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
// EMPLOYEE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /employees
 * List employees with pagination, search, and filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const params = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sort_by: (req.query.sort_by as string) || 'created_at',
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      department: req.query.department as string,
      position: req.query.position as string,
      is_active:
        req.query.is_active !== undefined
          ? req.query.is_active === 'true'
          : undefined,
      search: req.query.search as string,
    };

    const result = await service.getEmployees(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * GET /employees/statistics
 * Get employee statistics
 */
router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const statistics = await service.getEmployeeStatistics();

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * GET /employees/departments
 * Get unique departments
 */
router.get('/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const departments = await service.getDepartments();

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * GET /employees/positions
 * Get unique positions
 */
router.get('/positions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const positions = await service.getPositions();

    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * GET /employees/generate-number
 * Generate next employee number
 */
router.get(
  '/generate-number',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getEmployeeService(req);
      const employeeNumber = await service.generateEmployeeNumber();

      res.json({
        success: true,
        data: { employee_number: employeeNumber },
      });
    } catch (error) {
      handleEmployeeError(error, res, next);
    }
  }
);

/**
 * GET /employees/:id
 * Get employee by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const employee = await service.getEmployee(req.params.id);

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * POST /employees
 * Create a new employee
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const employee = await service.createEmployee(req.body);

    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully',
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * PUT /employees/:id
 * Update an existing employee
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    const employee = await service.updateEmployee(req.params.id, req.body);

    res.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully',
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

/**
 * POST /employees/:id/deactivate
 * Deactivate an employee
 */
router.post(
  '/:id/deactivate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getEmployeeService(req);
      const employee = await service.deactivateEmployee(req.params.id);

      res.json({
        success: true,
        data: employee,
        message: 'Employee deactivated successfully',
      });
    } catch (error) {
      handleEmployeeError(error, res, next);
    }
  }
);

/**
 * POST /employees/:id/reactivate
 * Reactivate an employee
 */
router.post(
  '/:id/reactivate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getEmployeeService(req);
      const employee = await service.reactivateEmployee(req.params.id);

      res.json({
        success: true,
        data: employee,
        message: 'Employee reactivated successfully',
      });
    } catch (error) {
      handleEmployeeError(error, res, next);
    }
  }
);

/**
 * DELETE /employees/:id
 * Delete an employee (hard delete, only if no records)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getEmployeeService(req);
    await service.deleteEmployee(req.params.id);

    res.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    handleEmployeeError(error, res, next);
  }
});

export default router;
