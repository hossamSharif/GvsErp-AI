// Zod Validation Schemas for HR Module
import { z } from 'zod';

// Attendance status enum
export const attendanceStatusSchema = z.enum(['present', 'absent', 'leave', 'holiday']);

// Payroll status enum
export const payrollStatusSchema = z.enum(['draft', 'processing', 'completed']);

// Employee validation schemas
export const createEmployeeSchema = z.object({
  user_id: z.string().uuid().optional(),
  full_name: z.string().min(1).max(255),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // ISO date format
  salary: z.number().nonnegative().optional(),
  salary_currency: z.string().min(2).max(5).toUpperCase().optional().default('USD'),
});

export const updateEmployeeSchema = z.object({
  user_id: z.string().uuid().optional(),
  full_name: z.string().min(1).max(255).optional(),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salary: z.number().nonnegative().optional(),
  salary_currency: z.string().min(2).max(5).toUpperCase().optional(),
  is_active: z.boolean().optional(),
});

// Attendance validation schemas
export const createAttendanceSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format
  check_in: z.string().datetime().optional(),
  check_out: z.string().datetime().optional(),
  status: attendanceStatusSchema,
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.check_out && data.check_in) {
      return new Date(data.check_out) > new Date(data.check_in);
    }
    return true;
  },
  {
    message: 'check_out must be after check_in',
    path: ['check_out'],
  }
);

export const updateAttendanceSchema = z.object({
  check_in: z.string().datetime().optional(),
  check_out: z.string().datetime().optional(),
  status: attendanceStatusSchema.optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.check_out && data.check_in) {
      return new Date(data.check_out) > new Date(data.check_in);
    }
    return true;
  },
  {
    message: 'check_out must be after check_in',
    path: ['check_out'],
  }
);

// Payroll item validation
export const createPayrollItemSchema = z.object({
  employee_id: z.string().uuid(),
  gross_salary: z.number().nonnegative(),
  deductions: z.number().nonnegative().optional().default(0),
  currency: z.string().min(2).max(5).toUpperCase().optional().default('USD'),
  days_worked: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

// Payroll run validation schemas
export const createPayrollRunSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(createPayrollItemSchema).min(1),
}).refine(
  (data) => new Date(data.period_end) >= new Date(data.period_start),
  {
    message: 'period_end must be on or after period_start',
    path: ['period_end'],
  }
);

export const updatePayrollRunSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: payrollStatusSchema.optional(),
  items: z.array(createPayrollItemSchema).min(1).optional(),
}).refine(
  (data) => {
    if (data.period_start && data.period_end) {
      return new Date(data.period_end) >= new Date(data.period_start);
    }
    return true;
  },
  {
    message: 'period_end must be on or after period_start',
    path: ['period_end'],
  }
);

// Leave request validation schemas
export const createLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: z.string().min(1).max(50),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  }
);

export const updateLeaveRequestSchema = z.object({
  leave_type: z.string().min(1).max(50).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().max(500).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'end_date must be on or after start_date',
    path: ['end_date'],
  }
);

// Attendance report filters
export const attendanceReportQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  department: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  {
    message: 'end_date must be on or after start_date',
  }
);

// Payroll report filters
export const payrollReportQuerySchema = z.object({
  payroll_run_id: z.string().uuid().optional(),
  department: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: 'end_date must be on or after start_date',
  }
);

// Export all schemas
export const hrValidation = {
  createEmployee: createEmployeeSchema,
  updateEmployee: updateEmployeeSchema,
  createAttendance: createAttendanceSchema,
  updateAttendance: updateAttendanceSchema,
  createPayrollRun: createPayrollRunSchema,
  updatePayrollRun: updatePayrollRunSchema,
  createLeaveRequest: createLeaveRequestSchema,
  updateLeaveRequest: updateLeaveRequestSchema,
  attendanceReportQuery: attendanceReportQuerySchema,
  payrollReportQuery: payrollReportQuerySchema,
};
