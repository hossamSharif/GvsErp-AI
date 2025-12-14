// Accounting Module Types for Modular ERP SaaS
// Optional add-on module for double-entry accounting

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string;
  parent?: Account;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string;
}

export interface UpdateAccountInput {
  code?: string;
  name?: string;
  type?: AccountType;
  parent_id?: string;
  is_active?: boolean;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  entry_date: string; // ISO date string
  description?: string;
  source_type?: string; // 'manual', 'sale', 'purchase', 'payment'
  source_id?: string;
  is_posted: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  tenant_id: string;
  account_id: string;
  account?: Account;
  debit: number;
  credit: number;
  description?: string;
  created_at: string;
}

export interface CreateJournalEntryInput {
  entry_date: string; // ISO date string
  description?: string;
  lines: CreateJournalLineInput[];
}

export interface CreateJournalLineInput {
  account_id: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface UpdateJournalEntryInput {
  entry_date?: string;
  description?: string;
  lines?: CreateJournalLineInput[];
}

// Financial Statement Types
export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  as_of_date: string;
  rows: TrialBalanceRow[];
  total_debits: number;
  total_credits: number;
}

export interface IncomeStatementRow {
  account_code: string;
  account_name: string;
  amount: number;
  is_subtotal?: boolean;
  indent_level?: number;
}

export interface IncomeStatement {
  start_date: string;
  end_date: string;
  revenues: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  total_revenue: number;
  total_expenses: number;
  net_income: number;
}

export interface BalanceSheetRow {
  account_code: string;
  account_name: string;
  amount: number;
  is_subtotal?: boolean;
  indent_level?: number;
}

export interface BalanceSheet {
  as_of_date: string;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

export interface CashFlowStatement {
  start_date: string;
  end_date: string;
  operating_activities: CashFlowRow[];
  investing_activities: CashFlowRow[];
  financing_activities: CashFlowRow[];
  net_cash_from_operating: number;
  net_cash_from_investing: number;
  net_cash_from_financing: number;
  net_change_in_cash: number;
  beginning_cash: number;
  ending_cash: number;
}

export interface CashFlowRow {
  description: string;
  amount: number;
  is_subtotal?: boolean;
}

// General Ledger
export interface GeneralLedgerEntry {
  date: string;
  entry_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GeneralLedgerReport {
  account_code: string;
  account_name: string;
  start_date: string;
  end_date: string;
  beginning_balance: number;
  entries: GeneralLedgerEntry[];
  ending_balance: number;
}

// Activation wizard
export interface AccountingActivationInput {
  fiscal_year_start: string; // MM-DD format
  default_accounts: {
    cash_account_id?: string;
    accounts_receivable_id?: string;
    accounts_payable_id?: string;
    inventory_asset_id?: string;
    sales_revenue_id?: string;
    cogs_expense_id?: string;
  };
  import_default_chart?: boolean; // Import standard chart of accounts
}
