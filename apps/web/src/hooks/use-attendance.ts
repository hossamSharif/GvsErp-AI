/**
 * useAttendance Hook
 *
 * TanStack Query hooks for attendance management with caching.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Attendance } from '@erp/shared';

interface AttendanceListResponse {
  success: boolean;
  data: Attendance[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface AttendanceQueryParams {
  date?: string;
  employeeId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (params: AttendanceQueryParams) => [...attendanceKeys.lists(), params] as const,
};

export function useAttendance(params: AttendanceQueryParams = {}) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: async () => {
      const response = await api.get<AttendanceListResponse>('/attendance', {
        date: params.date,
        employee_id: params.employeeId,
        status: params.status,
        page: params.page,
        limit: params.limit,
      });
      return response;
    },
  });
}
