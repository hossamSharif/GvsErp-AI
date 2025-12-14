// HR Module Types for Modular ERP SaaS
// Optional add-on module for human resources management

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'holiday';
export type PayrollStatus = 'draft' | 'processing' | 'completed';

export interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;
  employee_number: string;
  full_name: string;
  department?: string;
  position?: string;
  hire_date?: string; // ISO date string
  salary?: number;
  salary_currency?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeInput {
  user_id?: string;
  full_name: string;
  department?: string;
  position?: string;
  hire_date?: string; // ISO date string
  salary?: number;
  salary_currency?: string;
}

export interface UpdateEmployeeInput {
  user_id?: string;
  full_name?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  salary?: number;
  salary_currency?: string;
  is_active?: boolean;
}

export interface Attendance {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee?: Employee;
  date: string; // ISO date string
  check_in?: string; // ISO datetime string
  check_out?: string; // ISO datetime string
  status: AttendanceStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAttendanceInput {
  employee_id: string;
  date: string; // ISO date string
  check_in?: string; // ISO datetime string
  check_out?: string; // ISO datetime string
  status: AttendanceStatus;
  notes?: string;
}

export interface UpdateAttendanceInput {
  check_in?: string;
  check_out?: string;
  status?: AttendanceStatus;
  notes?: string;
}

export interface PayrollRun {
  id: string;
  tenant_id: string;
  period_start: string; // ISO date string
  period_end: string; // ISO date string
  status: PayrollStatus;
  total_gross?: number;
  total_deductions?: number;
  total_net?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  tenant_id: string;
  employee_id: string;
  employee?: Employee;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  currency: string;
  days_worked?: number;
  notes?: string;
  created_at: string;
}

export interface CreatePayrollRunInput {
  period_start: string; // ISO date string
  period_end: string; // ISO date string
  items: CreatePayrollItemInput[];
}

export interface CreatePayrollItemInput {
  employee_id: string;
  gross_salary: number;
  deductions?: number;
  currency?: string;
  days_worked?: number;
  notes?: string;
}

export interface UpdatePayrollRunInput {
  period_start?: string;
  period_end?: string;
  status?: PayrollStatus;
  items?: CreatePayrollItemInput[];
}

// Attendance summary for reporting
export interface AttendanceSummary {
  employee_id: string;
  employee_name: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  holiday_days: number;
  late_count: number;
  early_leave_count: number;
}

// Payroll summary for reporting
export interface PayrollSummary {
  period_start: string;
  period_end: string;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  by_department?: {
    department: string;
    employee_count: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
  }[];
}

// Leave request types
export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee?: Employee;
  leave_type: string; // 'sick', 'vacation', 'personal', etc.
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLeaveRequestInput {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface UpdateLeaveRequestInput {
  leave_type?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected';
}
