/**
 * useEmployees Hook
 *
 * TanStack Query hooks for employee management with caching.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface EmployeeResponse {
  success: boolean;
  data: Employee;
}

interface EmployeeQueryParams {
  search?: string;
  department?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeQueryParams) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  departments: () => [...employeeKeys.all, 'departments'] as const,
};

// =============================================================================
// EMPLOYEE QUERIES
// =============================================================================

export function useEmployees(params: EmployeeQueryParams = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      const response = await api.get<EmployeeListResponse>('/employees', {
        search: params.search,
        department: params.department,
        is_active: params.isActive,
        page: params.page,
        limit: params.limit,
      });
      return response;
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<EmployeeResponse>(`/employees/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

// =============================================================================
// EMPLOYEE MUTATIONS
// =============================================================================

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEmployeeInput) => {
      const response = await api.post<EmployeeResponse>('/employees', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeInput }) => {
      const response = await api.put<EmployeeResponse>(`/employees/${id}`, data);
      return response;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}
