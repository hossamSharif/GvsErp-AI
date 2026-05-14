/**
 * Accounting Module Hook
 *
 * React Query hooks for accounting module activation and financial statements.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Account,
  JournalEntry,
  TrialBalance,
  IncomeStatement,
  BalanceSheet,
  GeneralLedgerReport,
  AccountingActivationInput,
  DayBookReport,
  AgingReport,
} from '@erp/shared';
import { api } from '@/lib/api-client';

export type AccountingDefaultRole =
  | 'cash_in_hand'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'sales_revenue'
  | 'sales_tax_payable'
  | 'inventory_asset'
  | 'cogs'
  | 'discount_allowed'
  | 'discount_received'
  | 'salary_expense'
  | 'salary_payable'
  | 'general_expense'
  | 'service_purchase_expense';

export interface AccountingDefaultsResponse {
  roles: AccountingDefaultRole[];
  mapping: Partial<Record<AccountingDefaultRole, string>>;
}

// Query keys
export const accountingKeys = {
  all: ['accounting'] as const,
  status: () => [...accountingKeys.all, 'status'] as const,
  summary: () => [...accountingKeys.all, 'summary'] as const,
  defaults: () => [...accountingKeys.all, 'defaults'] as const,
  trialBalance: (asOfDate: string) =>
    [...accountingKeys.all, 'trial-balance', asOfDate] as const,
  incomeStatement: (startDate: string, endDate: string) =>
    [...accountingKeys.all, 'income-statement', startDate, endDate] as const,
  balanceSheet: (asOfDate: string) =>
    [...accountingKeys.all, 'balance-sheet', asOfDate] as const,
  generalLedger: (accountId: string, startDate: string, endDate: string) =>
    [...accountingKeys.all, 'general-ledger', accountId, startDate, endDate] as const,
  dayBook: (start: string, end: string) =>
    [...accountingKeys.all, 'day-book', start, end] as const,
  agingReceivables: (asOf: string) =>
    [...accountingKeys.all, 'aging-receivables', asOf] as const,
  agingPayables: (asOf: string) =>
    [...accountingKeys.all, 'aging-payables', asOf] as const,
  stockSummary: () => [...accountingKeys.all, 'stock-summary'] as const,
  cogsFlag: () => [...accountingKeys.all, 'cogs-flag'] as const,
};

/**
 * Phase 5: Stock Summary report — qty + value per item from FIFO layers.
 */
export interface StockSummaryItem {
  item_id: string;
  item_name: string;
  sku: string | null;
  total_qty: number;
  total_value: number;
  avg_unit_cost: number;
}

export interface StockSummaryResponse {
  items: StockSummaryItem[];
  grand_total_value: number;
}

export function useStockSummary() {
  return useQuery({
    queryKey: accountingKeys.stockSummary(),
    queryFn: async () => {
      const res = await api.get<{ data: StockSummaryResponse }>(
        '/accounting/reports/stock-summary'
      );
      return res.data;
    },
  });
}

/**
 * Phase 5: COGS feature flag (per tenant).
 */
export function useCogsFlag() {
  return useQuery({
    queryKey: accountingKeys.cogsFlag(),
    queryFn: async () => {
      const res = await api.get<{ data: { enabled: boolean } }>('/accounting/cogs');
      return res.data;
    },
  });
}

export function useSetCogsFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await api.put<{ data: { enabled: boolean } }>('/accounting/cogs', {
        enabled,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.cogsFlag() });
    },
  });
}

/**
 * Day Book — every posted voucher in a date range, oldest first.
 */
export function useDayBook(startDate: string, endDate: string) {
  return useQuery({
    queryKey: accountingKeys.dayBook(startDate, endDate),
    queryFn: async () => {
      const res = await api.get<{ data: DayBookReport }>(
        `/accounting/reports/day-book?start_date=${startDate}&end_date=${endDate}`
      );
      return res.data;
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Aging report — receivables (party = customer) or payables (supplier).
 */
export function useAgingReceivables(asOf: string) {
  return useQuery({
    queryKey: accountingKeys.agingReceivables(asOf),
    queryFn: async () => {
      const res = await api.get<{ data: AgingReport }>(
        `/accounting/reports/aging-receivables?as_of=${asOf}`
      );
      return res.data;
    },
    enabled: !!asOf,
  });
}

export function useAgingPayables(asOf: string) {
  return useQuery({
    queryKey: accountingKeys.agingPayables(asOf),
    queryFn: async () => {
      const res = await api.get<{ data: AgingReport }>(
        `/accounting/reports/aging-payables?as_of=${asOf}`
      );
      return res.data;
    },
    enabled: !!asOf,
  });
}

/**
 * Get the per-tenant default-role to ledger-account mapping. Drives the
 * Accounting Settings page and the auto-posting flows on the API.
 */
export function useAccountingDefaults() {
  return useQuery({
    queryKey: accountingKeys.defaults(),
    queryFn: async () => {
      const response = await api.get<{ data: AccountingDefaultsResponse }>(
        '/accounting/defaults'
      );
      return response.data;
    },
  });
}

/**
 * Assign an account to one of the default roles.
 */
export function useSetAccountingDefault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      role,
      accountId,
    }: {
      role: AccountingDefaultRole;
      accountId: string;
    }) => {
      await api.put(`/accounting/defaults/${role}`, { account_id: accountId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.defaults() });
    },
  });
}

/**
 * Check accounting module activation status
 */
export function useAccountingStatus() {
  return useQuery({
    queryKey: accountingKeys.status(),
    queryFn: async () => {
      const response = await api.get<{
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
      const response = await api.post<{
        data: { accounts_created: number; accounts: Account[] };
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
      const response = await api.get<{
        data: {
          current_month_revenue: number;
          current_month_expenses: number;
          current_month_net_income: number;
          total_assets: number;
          total_liabilities: number;
          total_equity: number;
          recent_entries: JournalEntry[];
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
      const response = await api.get<{ data: TrialBalance }>(
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
      const response = await api.get<{ data: IncomeStatement }>(
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
      const response = await api.get<{ data: BalanceSheet }>(
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
      const response = await api.get<{ data: GeneralLedgerReport }>(
        `/accounting/general-ledger?account_id=${accountId}&start_date=${startDate}&end_date=${endDate}`
      );
      return response.data;
    },
    enabled: !!accountId && !!startDate && !!endDate,
  });
}
