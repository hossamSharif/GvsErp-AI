/**
 * Payroll Service
 *
 * Business logic for payroll management including:
 * - Payroll run creation and processing
 * - Salary calculations with deductions
 * - Integration with attendance for work hours
 * - Auto-posting to accounting module
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { PayrollRepository } from '../repositories/payroll.repository';
import { EmployeeRepository } from '../repositories/employee.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AccountingService } from './accounting.service';

/**
 * Application error for payroll-related operations
 */
export class PayrollError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PayrollError';
  }
}

/**
 * Payroll item for an employee
 */
export interface PayrollItem {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  base_salary: number;
  currency: string;
  work_days: number;
  work_hours: number;
  overtime_hours: number;
  overtime_pay: number;
  bonuses: number;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  notes?: string;
}

/**
 * Service for Payroll business logic
 */
export class PayrollService {
  private readonly payrollRepository: PayrollRepository;
  private readonly employeeRepository: EmployeeRepository;
  private readonly attendanceRepository: AttendanceRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.payrollRepository = new PayrollRepository(supabase);
    this.employeeRepository = new EmployeeRepository(supabase);
    this.attendanceRepository = new AttendanceRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // PAYROLL RUN OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of payroll runs with filters
   */
  async getPayrollRuns(params: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    status?: 'draft' | 'processing' | 'completed';
    period_start?: string;
    period_end?: string;
  }) {
    const { page, limit, sort_by, sort_order, ...filters } = params;

    return this.payrollRepository.findWithFilters(
      {
        tenantId: this.tenantId,
        page,
        limit,
        sort_by,
        sort_order,
      },
      filters
    );
  }

  /**
   * Get a single payroll run by ID
   */
  async getPayrollRun(id: string) {
    const payrollRun = await this.payrollRepository.findById(this.tenantId, id);

    if (!payrollRun) {
      throw new PayrollError('Payroll run not found', 'PAYROLL_NOT_FOUND', 404);
    }

    return payrollRun;
  }

  /**
   * Create a new payroll run
   */
  async createPayrollRun(
    userId: string,
    input: {
      period_start: string;
      period_end: string;
    }
  ) {
    // Validate dates
    const startDate = new Date(input.period_start);
    const endDate = new Date(input.period_end);

    if (endDate < startDate) {
      throw new PayrollError(
        'Period end date must be after start date',
        'INVALID_PERIOD',
        400
      );
    }

    // Check if payroll already exists for this period
    const exists = await this.payrollRepository.existsForPeriod(
      this.tenantId,
      input.period_start,
      input.period_end
    );

    if (exists) {
      throw new PayrollError(
        'Payroll run already exists for this period',
        'PAYROLL_EXISTS',
        400
      );
    }

    // Create draft payroll run
    return this.payrollRepository.create(this.tenantId, {
      period_start: input.period_start,
      period_end: input.period_end,
      status: 'draft',
      created_by: userId,
    });
  }

  /**
   * Calculate payroll for all active employees
   */
  async calculatePayroll(payrollRunId: string): Promise<PayrollItem[]> {
    const payrollRun = await this.getPayrollRun(payrollRunId);

    if (payrollRun.status === 'completed') {
      throw new PayrollError(
        'Cannot recalculate completed payroll run',
        'PAYROLL_COMPLETED',
        400
      );
    }

    // Get all active employees
    const employees = await this.employeeRepository.findActiveEmployees(this.tenantId);

    const payrollItems: PayrollItem[] = [];

    for (const employee of employees) {
      // Get attendance summary for the period
      const attendanceSummary = await this.attendanceRepository.getAttendanceSummary(
        this.tenantId,
        employee.id,
        payrollRun.period_start,
        payrollRun.period_end
      );

      // Calculate work hours
      const workHours = await this.attendanceRepository.calculateTotalHours(
        this.tenantId,
        employee.id,
        payrollRun.period_start,
        payrollRun.period_end
      );

      // Calculate overtime (assuming standard 8 hours per day)
      const standardHours = attendanceSummary.present * 8;
      const overtimeHours = Math.max(0, workHours - standardHours);

      // Calculate salary (assuming monthly salary is in employee record)
      const baseSalary = employee.salary || 0;
      const overtimeRate = 1.5; // 1.5x base hourly rate
      const hourlyRate = baseSalary / (30 * 8); // Assuming 30 days, 8 hours per day
      const overtimePay = overtimeHours * hourlyRate * overtimeRate;

      // Calculate gross pay (base + overtime + bonuses)
      const bonuses = 0; // Can be extended to include bonuses
      const grossPay = baseSalary + overtimePay + bonuses;

      // Calculate deductions (can be extended for tax, insurance, etc.)
      const deductions = 0;

      // Calculate net pay
      const netPay = grossPay - deductions;

      payrollItems.push({
        employee_id: employee.id,
        employee_number: employee.employee_number,
        employee_name: employee.full_name,
        base_salary: baseSalary,
        currency: employee.salary_currency || 'USD',
        work_days: attendanceSummary.present,
        work_hours: workHours,
        overtime_hours: overtimeHours,
        overtime_pay: overtimePay,
        bonuses,
        gross_pay: grossPay,
        deductions,
        net_pay: netPay,
      });
    }

    // Calculate totals
    const totalGross = payrollItems.reduce((sum, item) => sum + item.gross_pay, 0);
    const totalDeductions = payrollItems.reduce((sum, item) => sum + item.deductions, 0);
    const totalNet = payrollItems.reduce((sum, item) => sum + item.net_pay, 0);

    // Update payroll run with totals
    await this.payrollRepository.updateTotals(this.tenantId, payrollRunId, {
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
    });

    return payrollItems;
  }

  /**
   * Process payroll run (mark as completed and post to accounting)
   */
  async processPayrollRun(payrollRunId: string, userId: string) {
    const payrollRun = await this.getPayrollRun(payrollRunId);

    if (payrollRun.status === 'completed') {
      throw new PayrollError('Payroll run already completed', 'ALREADY_COMPLETED', 400);
    }

    // Update status to processing
    await this.payrollRepository.updateStatus(this.tenantId, payrollRunId, 'processing');

    try {
      // Calculate payroll if not already calculated
      const payrollItems = await this.calculatePayroll(payrollRunId);

      // Post to accounting module if enabled
      await this.postPayrollToAccounting(payrollRun, payrollItems, userId);

      // Mark as completed
      await this.payrollRepository.updateStatus(this.tenantId, payrollRunId, 'completed');

      return {
        success: true,
        message: 'Payroll processed successfully',
        payroll_items: payrollItems,
      };
    } catch (error) {
      // Revert to draft on error
      await this.payrollRepository.updateStatus(this.tenantId, payrollRunId, 'draft');
      throw error;
    }
  }

  /**
   * Delete payroll run (only if draft)
   */
  async deletePayrollRun(id: string) {
    const payrollRun = await this.getPayrollRun(id);

    if (payrollRun.status !== 'draft') {
      throw new PayrollError(
        'Cannot delete non-draft payroll run',
        'CANNOT_DELETE',
        400
      );
    }

    return this.payrollRepository.delete(this.tenantId, id, false);
  }

  // ==========================================================================
  // ACCOUNTING INTEGRATION (T234)
  // ==========================================================================

  /**
   * Post payroll to accounting module (auto-generate journal entry)
   */
  private async postPayrollToAccounting(
    payrollRun: any,
    payrollItems: PayrollItem[],
    userId: string
  ) {
    try {
      // Check if accounting module is enabled
      const { data: tenantSettings } = await this.supabase
        .from('tenants')
        .select('settings')
        .eq('id', this.tenantId)
        .single();

      const accountingEnabled =
        tenantSettings?.settings?.modules?.accounting?.enabled || false;

      if (!accountingEnabled) {
        // Accounting module not enabled, skip posting
        return;
      }

      // Get or create payroll expense account
      const salaryExpenseAccount = await this.getOrCreateSalaryExpenseAccount();
      const payableAccount = await this.getOrCreatePayableAccount();

      // Calculate total payroll
      const totalGross = payrollRun.total_gross || 0;
      const totalNet = payrollRun.total_net || 0;
      const totalDeductions = payrollRun.total_deductions || 0;

      // Create journal entry lines
      const lines = [
        {
          account_id: salaryExpenseAccount.id,
          debit: totalGross,
          credit: 0,
          description: `Salary expense for period ${payrollRun.period_start} to ${payrollRun.period_end}`,
        },
        {
          account_id: payableAccount.id,
          debit: 0,
          credit: totalNet,
          description: `Salary payable for period ${payrollRun.period_start} to ${payrollRun.period_end}`,
        },
      ];

      // If there are deductions, add deduction liability account
      if (totalDeductions > 0) {
        const deductionAccount = await this.getOrCreateDeductionAccount();
        lines.push({
          account_id: deductionAccount.id,
          debit: 0,
          credit: totalDeductions,
          description: `Salary deductions for period ${payrollRun.period_start} to ${payrollRun.period_end}`,
        });
      }

      // Create journal entry
      await this.accountingService.createJournalEntry(this.tenantId, userId, {
        entry_date: payrollRun.period_end,
        description: `Payroll for period ${payrollRun.period_start} to ${payrollRun.period_end}`,
        source_type: 'payroll',
        source_id: payrollRun.id,
        lines,
      });
    } catch (error) {
      console.error('Failed to post payroll to accounting:', error);
      // Don't throw error, just log it - payroll processing should continue
    }
  }

  /**
   * Get or create salary expense account
   */
  private async getOrCreateSalaryExpenseAccount() {
    const { data: account } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('code', '6100')
      .single();

    if (account) {
      return account;
    }

    // Create salary expense account
    return this.accountingService.createAccount(this.tenantId, {
      code: '6100',
      name: 'Salary Expense',
      type: 'expense',
    });
  }

  /**
   * Get or create salary payable account
   */
  private async getOrCreatePayableAccount() {
    const { data: account } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('code', '2100')
      .single();

    if (account) {
      return account;
    }

    // Create salary payable account
    return this.accountingService.createAccount(this.tenantId, {
      code: '2100',
      name: 'Salary Payable',
      type: 'liability',
    });
  }

  /**
   * Get or create deduction liability account
   */
  private async getOrCreateDeductionAccount() {
    const { data: account } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('code', '2110')
      .single();

    if (account) {
      return account;
    }

    // Create deduction liability account
    return this.accountingService.createAccount(this.tenantId, {
      code: '2110',
      name: 'Salary Deductions Payable',
      type: 'liability',
    });
  }

  // ==========================================================================
  // PAYROLL REPORTS
  // ==========================================================================

  /**
   * Get latest payroll run
   */
  async getLatestPayrollRun() {
    return this.payrollRepository.getLatestCompleted(this.tenantId);
  }

  /**
   * Get payroll summary for a period
   */
  async getPayrollSummary(startDate: string, endDate: string) {
    const { data: runs } = await this.payrollRepository.findWithFilters(
      {
        tenantId: this.tenantId,
        page: 1,
        limit: 100,
      },
      {
        period_start: startDate,
        period_end: endDate,
        status: 'completed',
      }
    );

    const summary = {
      total_runs: runs.length,
      total_gross: runs.reduce((sum, run) => sum + (run.total_gross || 0), 0),
      total_deductions: runs.reduce((sum, run) => sum + (run.total_deductions || 0), 0),
      total_net: runs.reduce((sum, run) => sum + (run.total_net || 0), 0),
      runs: runs.map((run) => ({
        id: run.id,
        period_start: run.period_start,
        period_end: run.period_end,
        total_gross: run.total_gross,
        total_net: run.total_net,
        status: run.status,
      })),
    };

    return summary;
  }
}
