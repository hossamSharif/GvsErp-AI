/**
 * useCostCenters Hook (Phase 7)
 *
 * React Query hooks for cost-category / cost-center CRUD plus the totals
 * report.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CostCategory,
  CostCenter,
  CostCenterWithCategory,
  CreateCostCategoryInput,
  UpdateCostCategoryInput,
  CreateCostCenterInput,
  UpdateCostCenterInput,
  CostCenterTotalsReport,
} from '@erp/shared';

export const costCenterKeys = {
  all: ['cost-centers'] as const,
  categories: () => [...costCenterKeys.all, 'categories'] as const,
  centers: () => [...costCenterKeys.all, 'centers'] as const,
  totals: (start: string, end: string) =>
    [...costCenterKeys.all, 'totals', start, end] as const,
};

// ---- Categories ----

export function useCostCategories() {
  return useQuery({
    queryKey: costCenterKeys.categories(),
    queryFn: async () => {
      const res = await api.get<{ data: CostCategory[] }>('/cost-centers/categories');
      return res.data;
    },
  });
}

export function useCreateCostCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCostCategoryInput) => {
      const res = await api.post<{ data: CostCategory }>(
        '/cost-centers/categories',
        input
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: costCenterKeys.categories() });
    },
  });
}

export function useUpdateCostCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCostCategoryInput }) => {
      const res = await api.put<{ data: CostCategory }>(
        `/cost-centers/categories/${id}`,
        input
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: costCenterKeys.categories() });
    },
  });
}

// ---- Centers ----

export function useCostCenters() {
  return useQuery({
    queryKey: costCenterKeys.centers(),
    queryFn: async () => {
      const res = await api.get<{ data: CostCenterWithCategory[] }>('/cost-centers');
      return res.data;
    },
  });
}

export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCostCenterInput) => {
      const res = await api.post<{ data: CostCenter }>('/cost-centers', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: costCenterKeys.centers() });
    },
  });
}

export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCostCenterInput }) => {
      const res = await api.put<{ data: CostCenter }>(`/cost-centers/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: costCenterKeys.centers() });
    },
  });
}

export function useDeactivateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cost-centers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: costCenterKeys.centers() });
    },
  });
}

// ---- Totals report ----

export function useCostCenterTotals(startDate: string, endDate: string) {
  return useQuery({
    queryKey: costCenterKeys.totals(startDate, endDate),
    queryFn: async () => {
      const res = await api.get<{ data: CostCenterTotalsReport }>(
        `/cost-centers/reports/totals?start_date=${startDate}&end_date=${endDate}`
      );
      return res.data;
    },
    enabled: !!startDate && !!endDate,
  });
}
