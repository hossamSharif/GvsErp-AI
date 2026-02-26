/**
 * Employee Service
 *
 * Business logic for employee management including validation,
 * employee data operations, and statistics.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { EmployeeRepository } from '../repositories/employee.repository';

/**
 * Application error for employee-related operations
 */
export class EmployeeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'EmployeeError';
  }
}

/**
 * Service for Employee business logic
 */
export class EmployeeService {
  private readonly employeeRepository: EmployeeRepository;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.employeeRepository = new EmployeeRepository(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // EMPLOYEE CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of employees with filters
   */
  async getEmployees(params: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    department?: string;
    position?: string;
    is_active?: boolean;
    search?: string;
  }) {
    const { page, limit, sort_by, sort_order, ...filters } = params;

    return this.employeeRepository.findWithFilters(
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
   * Get a single employee by ID
   */
  async getEmployee(id: string) {
    const employee = await this.employeeRepository.findById(this.tenantId, id);

    if (!employee) {
      throw new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
    }

    return employee;
  }

  /**
   * Create a new employee
   */
  async createEmployee(input: {
    user_id?: string;
    employee_number: string;
    full_name: string;
    department?: string;
    position?: string;
    hire_date?: string;
    salary?: number;
    salary_currency?: string;
    is_active?: boolean;
  }) {
    // Validate employee number uniqueness
    await this.validateEmployeeNumberUniqueness(input.employee_number);

    // If user_id provided, validate it's not already linked to another employee
    if (input.user_id) {
      await this.validateUserNotLinked(input.user_id);
    }

    return this.employeeRepository.create(this.tenantId, input);
  }

  /**
   * Update an existing employee
   */
  async updateEmployee(
    id: string,
    input: {
      employee_number?: string;
      full_name?: string;
      department?: string;
      position?: string;
      hire_date?: string;
      salary?: number;
      salary_currency?: string;
      is_active?: boolean;
    }
  ) {
    const existingEmployee = await this.getEmployee(id);

    // If updating employee number, validate uniqueness
    if (input.employee_number && input.employee_number !== existingEmployee.employee_number) {
      await this.validateEmployeeNumberUniqueness(input.employee_number);
    }

    const updated = await this.employeeRepository.update(this.tenantId, id, input);

    if (!updated) {
      throw new EmployeeError('Failed to update employee', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  /**
   * Deactivate an employee (soft delete)
   */
  async deactivateEmployee(id: string) {
    return this.employeeRepository.update(this.tenantId, id, { is_active: false });
  }

  /**
   * Reactivate an employee
   */
  async reactivateEmployee(id: string) {
    return this.employeeRepository.update(this.tenantId, id, { is_active: true });
  }

  /**
   * Delete an employee (hard delete)
   */
  async deleteEmployee(id: string) {
    // Check if employee has any attendance or payroll records
    const hasRecords = await this.hasEmployeeRecords(id);

    if (hasRecords) {
      throw new EmployeeError(
        'Cannot delete employee with existing records. Deactivate instead.',
        'HAS_RECORDS',
        400
      );
    }

    return this.employeeRepository.delete(this.tenantId, id, false);
  }

  // ==========================================================================
  // EMPLOYEE LOOKUPS & STATISTICS
  // ==========================================================================

  /**
   * Get employee by employee number
   */
  async getEmployeeByNumber(employeeNumber: string) {
    const employee = await this.employeeRepository.findByEmployeeNumber(
      this.tenantId,
      employeeNumber
    );

    if (!employee) {
      throw new EmployeeError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
    }

    return employee;
  }

  /**
   * Get employee by user ID
   */
  async getEmployeeByUserId(userId: string) {
    const employee = await this.employeeRepository.findByUserId(this.tenantId, userId);

    if (!employee) {
      throw new EmployeeError('Employee not found for this user', 'EMPLOYEE_NOT_FOUND', 404);
    }

    return employee;
  }

  /**
   * Get all active employees
   */
  async getActiveEmployees() {
    return this.employeeRepository.findActiveEmployees(this.tenantId);
  }

  /**
   * Get unique departments
   */
  async getDepartments() {
    return this.employeeRepository.getDepartments(this.tenantId);
  }

  /**
   * Get unique positions
   */
  async getPositions() {
    return this.employeeRepository.getPositions(this.tenantId);
  }

  /**
   * Get employee statistics
   */
  async getEmployeeStatistics() {
    const total = await this.employeeRepository.count(this.tenantId, true);
    const active = await this.employeeRepository.count(this.tenantId, false);
    const departments = await this.getDepartments();
    const positions = await this.getPositions();

    // Get department breakdown
    const allEmployees = await this.employeeRepository.findActiveEmployees(this.tenantId);
    const departmentCounts = allEmployees.reduce((acc, emp) => {
      const dept = emp.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      active,
      inactive: total - active,
      departments: departments.length,
      positions: positions.length,
      department_breakdown: departmentCounts,
    };
  }

  // ==========================================================================
  // VALIDATION HELPERS
  // ==========================================================================

  /**
   * Validate employee number uniqueness
   */
  private async validateEmployeeNumberUniqueness(employeeNumber: string): Promise<void> {
    const existing = await this.employeeRepository.findByEmployeeNumber(
      this.tenantId,
      employeeNumber
    );

    if (existing) {
      throw new EmployeeError(
        'Employee number already exists',
        'EMPLOYEE_NUMBER_EXISTS',
        400
      );
    }
  }

  /**
   * Validate user is not already linked to another employee
   */
  private async validateUserNotLinked(userId: string): Promise<void> {
    const existing = await this.employeeRepository.findByUserId(this.tenantId, userId);

    if (existing) {
      throw new EmployeeError(
        'User is already linked to another employee',
        'USER_ALREADY_LINKED',
        400
      );
    }
  }

  /**
   * Check if employee has attendance or payroll records
   */
  private async hasEmployeeRecords(employeeId: string): Promise<boolean> {
    // Check attendance records
    const { count: attendanceCount } = await this.supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', this.tenantId)
      .eq('employee_id', employeeId);

    if (attendanceCount && attendanceCount > 0) {
      return true;
    }

    return false;
  }

  /**
   * Generate next employee number
   */
  async generateEmployeeNumber(): Promise<string> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('employee_number')
      .eq('tenant_id', this.tenantId)
      .order('employee_number', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return 'EMP-0001';
    }

    const lastNumber = data[0].employee_number;
    const match = lastNumber.match(/EMP-(\d+)/);

    if (match) {
      const nextNumber = parseInt(match[1], 10) + 1;
      return `EMP-${nextNumber.toString().padStart(4, '0')}`;
    }

    return 'EMP-0001';
  }
}
