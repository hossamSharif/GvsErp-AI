/**
 * Accounting Module Hook
 *
 * React Query hooks for accounting module activation and financial statements.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TrialBalance,
  IncomeStatement,
  BalanceSheet,
  GeneralLedgerReport,
  AccountingActivationInput,
} from '@erp/shared';
import { apiClient } from '@/lib/api-client';

// Query keys
export const accountingKeys = {
  all: ['accounting'] as const,
  status: () => [...accountingKeys.all, 'status'] as const,
  summary: () => [...accountingKeys.all, 'summary'] as const,
  trialBalance: (asOfDate: string) =>
    [...accountingKeys.all, 'trial-balance', asOfDate] as const,
  incomeStatement: (startDate: string, endDate: string) =>
    [...accountingKeys.all, 'income-statement', startDate, endDate] as const,
  balanceSheet: (asOfDate: string) =>
    [...accountingKeys.all, 'balance-sheet', asOfDate] as const,
  generalLedger: (accountId: string, startDate: string, endDate: string) =>
    [...accountingKeys.all, 'general-ledger', accountId, startDate, endDate] as const,
};

/**
 * Check accounting module activation status
 */
export function useAccountingStatus() {
  return useQuery({
    queryKey: accountingKeys.status(),
    queryFn: async () => {
      const response = await apiClient.get<{
        data: { is_activated: boolean; account_count: number };
      }>('/accounting/status');
      return response.data;
    },
  });
}

/**
 * Activate accounting module
 */
export function useActivateAccounting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AccountingActivationInput) => {
      const response = await apiClient.post<{
        data: { accounts_created: number; accounts: any[] };
      }>('/accounting/activate', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.status() });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Get accounting summary/dashboard
 */
export function useAccountingSummary() {
  return useQuery({
    queryKey: accountingKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<{
        data: {
          current_month_revenue: number;
          current_month_expenses: number;
          current_month_net_income: number;
          total_assets: number;
          total_liabilities: number;
          total_equity: number;
          recent_entries: any[];
        };
      }>('/accounting/summary');
      return response.data;
    },
  });
}

/**
 * Generate trial balance
 */
export function useTrialBalance(asOfDate: string) {
  return useQuery({
    queryKey: accountingKeys.trialBalance(asOfDate),
    queryFn: async () => {
      const response = await apiClient.get<{ data: TrialBalance }>(
        `/accounting/trial-balance?as_of_date=${asOfDate}`
      );
      return response.data;
    },
    enabled: !!asOfDate,
  });
}

/**
 * Generate income statement
 */
export function useIncomeStatement(startDate: string, endDate: string) {
  return useQuery({
    queryKey: accountingKeys.incomeStatement(startDate, endDate),
    queryFn: async () => {
      const response = await apiClient.get<{ data: IncomeStatement }>(
        `/accounting/income-statement?start_date=${startDate}&end_date=${endDate}`
      );
      return response.data;
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Generate balance sheet
 */
export function useBalanceSheet(asOfDate: string) {
  return useQuery({
    queryKey: accountingKeys.balanceSheet(asOfDate),
    queryFn: async () => {
      const response = await apiClient.get<{ data: BalanceSheet }>(
        `/accounting/balance-sheet?as_of_date=${asOfDate}`
      );
      return response.data;
    },
    enabled: !!asOfDate,
  });
}

/**
 * Generate general ledger report
 */
export function useGeneralLedger(
  accountId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: accountingKeys.generalLedger(accountId, startDate, endDate),
    queryFn: async () => {
      const response = await apiClient.get<{ data: GeneralLedgerReport }>(
        `/accounting/general-ledger?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
      );
      return response.data;
    },
    enabled: !!accountId && !!startDate && !!endDate,
  });
}
