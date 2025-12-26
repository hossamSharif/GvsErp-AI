/**
 * Attendance Repository
 *
 * Handles attendance data access operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
type AttendanceUpdate = Database['public']['Tables']['attendance']['Update'];

export interface AttendanceFilters {
  employee_id?: string;
  status?: 'present' | 'absent' | 'leave' | 'holiday';
  start_date?: string;
  end_date?: string;
}

export class AttendanceRepository extends BaseRepository<
  'attendance',
  AttendanceRow,
  AttendanceInsert,
  AttendanceUpdate
> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'attendance');
  }

  /**
   * Find attendance records with filtering
   */
  async findWithFilters(
    options: QueryOptions,
    filters?: AttendanceFilters
  ): Promise<QueryResult<AttendanceRow>> {
    const {
      tenantId,
      page = 1,
      limit = 50,
      sort_by = 'date',
      sort_order = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from(this.tableName)
      .select('*, employees(employee_number, full_name)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters) {
      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.start_date) {
        query = query.gte('date', filters.start_date);
      }

      if (filters.end_date) {
        query = query.lte('date', filters.end_date);
      }
    }

    query = query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as AttendanceRow[],
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find attendance record for a specific employee on a specific date
   */
  async findByEmployeeAndDate(
    tenantId: string,
    employeeId: string,
    date: string
  ): Promise<AttendanceRow | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as AttendanceRow;
  }

  /**
   * Get attendance records for an employee in a date range
   */
  async findByEmployeeAndDateRange(
    tenantId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as AttendanceRow[];
  }

  /**
   * Get attendance summary for an employee
   */
  async getAttendanceSummary(
    tenantId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_days: number;
    present: number;
    absent: number;
    leave: number;
    holiday: number;
  }> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw error;
    }

    const records = data || [];
    const summary = {
      total_days: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      leave: records.filter((r) => r.status === 'leave').length,
      holiday: records.filter((r) => r.status === 'holiday').length,
    };

    return summary;
  }

  /**
   * Get all attendance for a specific date (for daily reports)
   */
  async findByDate(tenantId: string, date: string): Promise<AttendanceRow[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, employees(employee_number, full_name, department)')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .order('employees(employee_number)');

    if (error) {
      throw error;
    }

    return (data || []) as AttendanceRow[];
  }

  /**
   * Calculate total work hours for an employee in a period
   */
  async calculateTotalHours(
    tenantId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('check_in, check_out')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('status', 'present')
      .gte('date', startDate)
      .lte('date', endDate)
      .not('check_in', 'is', null)
      .not('check_out', 'is', null);

    if (error) {
      throw error;
    }

    const records = data || [];
    let totalHours = 0;

    for (const record of records) {
      if (record.check_in && record.check_out) {
        const checkIn = new Date(record.check_in);
        const checkOut = new Date(record.check_out);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }

    return totalHours;
  }
}
