/**
 * Attendance Service
 *
 * Business logic for attendance management including check-in/check-out,
 * leave tracking, and attendance reports.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { EmployeeRepository } from '../repositories/employee.repository';

/**
 * Application error for attendance-related operations
 */
export class AttendanceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AttendanceError';
  }
}

/**
 * Service for Attendance business logic
 */
export class AttendanceService {
  private readonly attendanceRepository: AttendanceRepository;
  private readonly employeeRepository: EmployeeRepository;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.attendanceRepository = new AttendanceRepository(supabase);
    this.employeeRepository = new EmployeeRepository(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // ATTENDANCE CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of attendance records with filters
   */
  async getAttendanceRecords(params: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    employee_id?: string;
    status?: 'present' | 'absent' | 'leave' | 'holiday';
    start_date?: string;
    end_date?: string;
  }) {
    const { page, limit, sort_by, sort_order, ...filters } = params;

    return this.attendanceRepository.findWithFilters(
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
   * Get a single attendance record by ID
   */
  async getAttendanceRecord(id: string) {
    const record = await this.attendanceRepository.findById(this.tenantId, id);

    if (!record) {
      throw new AttendanceError('Attendance record not found', 'RECORD_NOT_FOUND', 404);
    }

    return record;
  }

  /**
   * Create or update attendance record for a date
   */
  async recordAttendance(input: {
    employee_id: string;
    date: string;
    check_in?: string;
    check_out?: string;
    status: 'present' | 'absent' | 'leave' | 'holiday';
    notes?: string;
  }) {
    // Validate employee exists and is active
    await this.validateEmployee(input.employee_id);

    // Check if record already exists for this date
    const existing = await this.attendanceRepository.findByEmployeeAndDate(
      this.tenantId,
      input.employee_id,
      input.date
    );

    if (existing) {
      // Update existing record
      return this.attendanceRepository.update(this.tenantId, existing.id, input);
    }

    // Create new record
    return this.attendanceRepository.create(this.tenantId, input);
  }

  /**
   * Check in an employee
   */
  async checkIn(employeeId: string, checkInTime?: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkIn = checkInTime || new Date().toISOString();

    // Validate employee
    await this.validateEmployee(employeeId);

    // Check if already checked in today
    const existing = await this.attendanceRepository.findByEmployeeAndDate(
      this.tenantId,
      employeeId,
      today
    );

    if (existing && existing.check_in) {
      throw new AttendanceError('Already checked in today', 'ALREADY_CHECKED_IN', 400);
    }

    return this.recordAttendance({
      employee_id: employeeId,
      date: today,
      check_in: checkIn,
      status: 'present',
    });
  }

  /**
   * Check out an employee
   */
  async checkOut(employeeId: string, checkOutTime?: string) {
    const today = new Date().toISOString().split('T')[0];
    const checkOut = checkOutTime || new Date().toISOString();

    // Validate employee
    await this.validateEmployee(employeeId);

    // Get today's record
    const existing = await this.attendanceRepository.findByEmployeeAndDate(
      this.tenantId,
      employeeId,
      today
    );

    if (!existing || !existing.check_in) {
      throw new AttendanceError('No check-in found for today', 'NO_CHECK_IN', 400);
    }

    if (existing.check_out) {
      throw new AttendanceError('Already checked out today', 'ALREADY_CHECKED_OUT', 400);
    }

    return this.attendanceRepository.update(this.tenantId, existing.id, {
      check_out: checkOut,
    });
  }

  /**
   * Mark employee as absent
   */
  async markAbsent(employeeId: string, date: string, notes?: string) {
    await this.validateEmployee(employeeId);

    return this.recordAttendance({
      employee_id: employeeId,
      date,
      status: 'absent',
      notes,
    });
  }

  /**
   * Mark employee on leave
   */
  async markOnLeave(employeeId: string, date: string, notes?: string) {
    await this.validateEmployee(employeeId);

    return this.recordAttendance({
      employee_id: employeeId,
      date,
      status: 'leave',
      notes,
    });
  }

  /**
   * Mark day as holiday
   */
  async markHoliday(date: string, notes?: string) {
    // Get all active employees
    const employees = await this.employeeRepository.findActiveEmployees(this.tenantId);

    const results = [];

    for (const employee of employees) {
      const record = await this.recordAttendance({
        employee_id: employee.id,
        date,
        status: 'holiday',
        notes,
      });
      results.push(record);
    }

    return results;
  }

  /**
   * Update attendance record
   */
  async updateAttendance(
    id: string,
    input: {
      check_in?: string;
      check_out?: string;
      status?: 'present' | 'absent' | 'leave' | 'holiday';
      notes?: string;
    }
  ) {
    const existing = await this.getAttendanceRecord(id);

    const updated = await this.attendanceRepository.update(this.tenantId, id, input);

    if (!updated) {
      throw new AttendanceError('Failed to update attendance record', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Delete attendance record
   */
  async deleteAttendance(id: string) {
    return this.attendanceRepository.delete(this.tenantId, id, false);
  }

  // ==========================================================================
  // ATTENDANCE REPORTS & STATISTICS
  // ==========================================================================

  /**
   * Get attendance summary for an employee
   */
  async getEmployeeAttendanceSummary(
    employeeId: string,
    startDate: string,
    endDate: string
  ) {
    await this.validateEmployee(employeeId);

    return this.attendanceRepository.getAttendanceSummary(
      this.tenantId,
      employeeId,
      startDate,
      endDate
    );
  }

  /**
   * Get attendance records for an employee in a period
   */
  async getEmployeeAttendance(employeeId: string, startDate: string, endDate: string) {
    await this.validateEmployee(employeeId);

    return this.attendanceRepository.findByEmployeeAndDateRange(
      this.tenantId,
      employeeId,
      startDate,
      endDate
    );
  }

  /**
   * Get daily attendance report
   */
  async getDailyAttendanceReport(date: string) {
    return this.attendanceRepository.findByDate(this.tenantId, date);
  }

  /**
   * Calculate total work hours for an employee
   */
  async calculateWorkHours(employeeId: string, startDate: string, endDate: string) {
    await this.validateEmployee(employeeId);

    return this.attendanceRepository.calculateTotalHours(
      this.tenantId,
      employeeId,
      startDate,
      endDate
    );
  }

  /**
   * Get overall attendance statistics
   */
  async getAttendanceStatistics(startDate: string, endDate: string) {
    const { data: records } = await this.attendanceRepository.findWithFilters(
      {
        tenantId: this.tenantId,
        page: 1,
        limit: 10000,
      },
      {
        start_date: startDate,
        end_date: endDate,
      }
    );

    const stats = {
      total_records: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      leave: records.filter((r) => r.status === 'leave').length,
      holiday: records.filter((r) => r.status === 'holiday').length,
    };

    return {
      ...stats,
      present_percentage:
        stats.total_records > 0
          ? ((stats.present / stats.total_records) * 100).toFixed(2)
          : '0.00',
      absent_percentage:
        stats.total_records > 0
          ? ((stats.absent / stats.total_records) * 100).toFixed(2)
          : '0.00',
    };
  }

  // ==========================================================================
  // VALIDATION HELPERS
  // ==========================================================================

  /**
   * Validate employee exists and is active
   */
  private async validateEmployee(employeeId: string): Promise<void> {
    const employee = await this.employeeRepository.findById(this.tenantId, employeeId);

    if (!employee) {
      throw new AttendanceError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
    }

    if (!employee.is_active) {
      throw new AttendanceError('Employee is not active', 'EMPLOYEE_INACTIVE', 400);
    }
  }
}
