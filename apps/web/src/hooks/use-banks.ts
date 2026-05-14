/**
 * useBanks Hook
 *
 * React Query hooks for bank-account management (plan Phase 3).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  BankAccount,
  BankAccountWithLedger,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  GeneralLedgerReport,
} from '@erp/shared';

export const bankKeys = {
  all: ['banks'] as const,
  lists: () => [...bankKeys.all, 'list'] as const,
  details: () => [...bankKeys.all, 'detail'] as const,
  detail: (id: string) => [...bankKeys.details(), id] as const,
  statement: (id: string, start: string, end: string) =>
    [...bankKeys.all, 'statement', id, start, end] as const,
};

export function useBanks() {
  return useQuery({
    queryKey: bankKeys.lists(),
    queryFn: async () => {
      const res = await api.get<{ data: BankAccountWithLedger[] }>('/banks');
      return res.data;
    },
  });
}

export function useBank(id: string | undefined) {
  return useQuery({
    queryKey: bankKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await api.get<{ data: BankAccountWithLedger }>(`/banks/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useBankStatement(id: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: bankKeys.statement(id ?? '', startDate, endDate),
    queryFn: async () => {
      const res = await api.get<{ data: GeneralLedgerReport }>(
        `/banks/${id}/statement?start_date=${startDate}&end_date=${endDate}`
      );
      return res.data;
    },
    enabled: !!id && !!startDate && !!endDate,
  });
}

export function useCreateBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBankAccountInput) => {
      const res = await api.post<{ data: BankAccount }>('/banks', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bankKeys.lists() });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBankAccountInput }) => {
      const res = await api.put<{ data: BankAccount }>(`/banks/${id}`, input);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: bankKeys.lists() });
      qc.invalidateQueries({ queryKey: bankKeys.detail(vars.id) });
    },
  });
}

export function useDeactivateBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/banks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bankKeys.lists() });
    },
  });
}
