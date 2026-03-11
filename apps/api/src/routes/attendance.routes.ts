/**
 * Attendance API Routes
 *
 * RESTful endpoints for attendance management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create AttendanceService with tenant context
 */
function getAttendanceService(req: Request): AttendanceService {
  const { supabase, tenantId } = getTenantContext(req);
  return new AttendanceService(supabase, tenantId);
}

// =============================================================================
// ATTENDANCE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /attendance
 * List attendance records with pagination and filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const params = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      sort_by: (req.query.sort_by as string) || 'date',
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      employee_id: req.query.employee_id as string,
      status: req.query.status as 'present' | 'absent' | 'leave' | 'holiday',
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
    };

    const result = await service.getAttendanceRecords(params);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /attendance/statistics
 * Get attendance statistics for a period
 */
router.get('/statistics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
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

    const statistics = await service.getAttendanceStatistics(startDate, endDate);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /attendance/daily/:date
 * Get daily attendance report for a specific date
 */
router.get('/daily/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const report = await service.getDailyAttendanceReport(req.params.date);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /attendance/employee/:employeeId
 * Get attendance records for a specific employee
 */
router.get(
  '/employee/:employeeId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { employeeId } = req.params;
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

      const records = await service.getEmployeeAttendance(
        employeeId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /attendance/employee/:employeeId/summary
 * Get attendance summary for a specific employee
 */
router.get(
  '/employee/:employeeId/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { employeeId } = req.params;
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

      const summary = await service.getEmployeeAttendanceSummary(
        employeeId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /attendance/employee/:employeeId/work-hours
 * Calculate total work hours for an employee
 */
router.get(
  '/employee/:employeeId/work-hours',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { employeeId } = req.params;
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

      const hours = await service.calculateWorkHours(employeeId, startDate, endDate);

      res.json({
        success: true,
        data: { total_hours: hours },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /attendance/:id
 * Get attendance record by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const record = await service.getAttendanceRecord(req.params.id);

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance
 * Record attendance
 */
router.post('/', requirePermission('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const record = await service.recordAttendance(req.body);

    res.status(201).json({
      success: true,
      data: record,
      message: 'Attendance recorded successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance/check-in
 * Check in an employee
 */
router.post('/check-in', requirePermission('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const { employee_id, check_in } = req.body;

    if (!employee_id) {
      return void res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'employee_id is required',
        },
      });
    }

    const record = await service.checkIn(employee_id, check_in);

    res.json({
      success: true,
      data: record,
      message: 'Checked in successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance/check-out
 * Check out an employee
 */
router.post('/check-out', requirePermission('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const { employee_id, check_out } = req.body;

    if (!employee_id) {
      return void res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'employee_id is required',
        },
      });
    }

    const record = await service.checkOut(employee_id, check_out);

    res.json({
      success: true,
      data: record,
      message: 'Checked out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /attendance/mark-absent
 * Mark employee as absent
 */
router.post(
  '/mark-absent',
  requirePermission('attendance:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { employee_id, date, notes } = req.body;

      if (!employee_id || !date) {
        return void res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'employee_id and date are required',
          },
        });
      }

      const record = await service.markAbsent(employee_id, date, notes);

      res.json({
        success: true,
        data: record,
        message: 'Marked as absent successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /attendance/mark-leave
 * Mark employee on leave
 */
router.post(
  '/mark-leave',
  requirePermission('attendance:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { employee_id, date, notes } = req.body;

      if (!employee_id || !date) {
        return void res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'employee_id and date are required',
          },
        });
      }

      const record = await service.markOnLeave(employee_id, date, notes);

      res.json({
        success: true,
        data: record,
        message: 'Marked as on leave successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /attendance/mark-holiday
 * Mark day as holiday for all employees
 */
router.post(
  '/mark-holiday',
  requirePermission('attendance:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAttendanceService(req);
      const { date, notes } = req.body;

      if (!date) {
        return void res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'date is required',
          },
        });
      }

      const records = await service.markHoliday(date, notes);

      res.json({
        success: true,
        data: records,
        message: 'Holiday marked successfully for all employees',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /attendance/:id
 * Update attendance record
 */
router.put('/:id', requirePermission('attendance:write'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    const record = await service.updateAttendance(req.params.id, req.body);

    res.json({
      success: true,
      data: record,
      message: 'Attendance updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /attendance/:id
 * Delete attendance record
 */
router.delete('/:id', requirePermission('attendance:delete'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAttendanceService(req);
    await service.deleteAttendance(req.params.id);

    res.json({
      success: true,
      message: 'Attendance record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
