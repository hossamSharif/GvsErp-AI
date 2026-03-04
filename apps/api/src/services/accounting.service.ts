/**
 * Accounting Service
 *
 * Business logic for accounting module including:
 * - Chart of accounts management
 * - Journal entry processing
 * - Financial statement generation (Trial Balance, Income Statement, Balance Sheet)
 * - Auto-generation of journal entries from stock transactions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { AccountRepository } from '../repositories/account.repository';
import { JournalEntryRepository } from '../repositories/journal-entry.repository';
import type {
  Account,
  AccountType,
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  TrialBalance,
  TrialBalanceRow,
  IncomeStatement,
  IncomeStatementRow,
  BalanceSheet,
  BalanceSheetRow,
  GeneralLedgerReport,
  GeneralLedgerEntry,
  CreateAccountInput,
  UpdateAccountInput,
} from '@erp/shared';

/**
 * Application error for accounting-related operations
 */
/** Journal line joined with its parent journal entry (from *, journal_entries!inner(*) select) */
interface JournalLineWithEntry {
  debit: number;
  credit: number;
  description: string | null;
  journal_entries: {
    entry_date: string;
    entry_number: string;
    description: string | null;
  };
}

export class AccountingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AccountingError';
  }
}

export class AccountingService {
  private accountRepo: AccountRepository;
  private journalRepo: JournalEntryRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.accountRepo = new AccountRepository(supabase);
    this.journalRepo = new JournalEntryRepository(supabase);
  }

  // ==================== Chart of Accounts ====================

  /**
   * Get chart of accounts tree
   */
  async getChartOfAccounts(tenantId: string, type?: AccountType): Promise<Account[]> {
    return this.accountRepo.getAccountTree(tenantId, type);
  }

  /**
   * Get a single account by ID
   */
  async getAccount(tenantId: string, id: string) {
    return this.accountRepo.findById(tenantId, id);
  }

  /**
   * Get child accounts
   */
  async getAccountChildren(tenantId: string, parentId: string) {
    return this.accountRepo.getChildren(tenantId, parentId);
  }

  /**
   * List accounts with pagination
   */
  async listAccounts(tenantId: string, options: { page?: number; limit?: number; sort_by?: string; sort_order?: 'asc' | 'desc' }) {
    return this.accountRepo.findAll({ tenantId, ...options });
  }

  /**
   * Create account
   */
  async createAccount(
    tenantId: string,
    data: CreateAccountInput
  ): Promise<Account> {
    // Validate parent exists if provided
    if (data.parent_id) {
      const parent = await this.accountRepo.findById(tenantId, data.parent_id);
      if (!parent) {
        throw new AccountingError('Parent account not found', 'PARENT_NOT_FOUND', 404);
      }
      // Ensure parent is same type
      if (parent.type !== data.type) {
        throw new AccountingError('Parent account must be of the same type', 'TYPE_MISMATCH');
      }
    }

    // Check if code already exists
    const existing = await this.accountRepo.findByCode(tenantId, data.code);
    if (existing) {
      throw new AccountingError(`Account with code ${data.code} already exists`, 'CODE_EXISTS');
    }

    return this.accountRepo.create(tenantId, data);
  }

  /**
   * Update account
   */
  async updateAccount(
    tenantId: string,
    id: string,
    data: UpdateAccountInput
  ): Promise<Account | null> {
    const account = await this.accountRepo.findById(tenantId, id);
    if (!account) return null;

    // If updating code, check for duplicates
    if (data.code && data.code !== account.code) {
      const existing = await this.accountRepo.findByCode(tenantId, data.code);
      if (existing && existing.id !== id) {
        throw new AccountingError(`Account with code ${data.code} already exists`, 'CODE_EXISTS');
      }
    }

    // Validate parent
    if (data.parent_id) {
      const parent = await this.accountRepo.findById(tenantId, data.parent_id);
      if (!parent) {
        throw new AccountingError('Parent account not found', 'PARENT_NOT_FOUND', 404);
      }
      if (parent.type !== account.type) {
        throw new AccountingError('Parent account must be of the same type', 'TYPE_MISMATCH');
      }
      // Prevent circular references
      if (parent.id === id) {
        throw new AccountingError('Account cannot be its own parent', 'CIRCULAR_REFERENCE');
      }
    }

    return this.accountRepo.update(tenantId, id, data);
  }

  /**
   * Delete account (only if no transactions and no children)
   */
  async deleteAccount(tenantId: string, id: string): Promise<boolean> {
    // Check if account has children
    const hasChildren = await this.accountRepo.hasChildren(tenantId, id);
    if (hasChildren) {
      throw new AccountingError('Cannot delete account with child accounts', 'HAS_CHILDREN');
    }

    // Check if account has journal entries
    const entries = await this.journalRepo.findAllEntries({
      tenantId,
      account_id: id,
      limit: 1,
    });

    if (entries.meta.total > 0) {
      throw new AccountingError('Cannot delete account with journal entries', 'HAS_ENTRIES');
    }

    return this.accountRepo.delete(tenantId, id, true);
  }

  // ==================== Journal Entries ====================

  /**
   * Get journal entries with filters
   */
  async getJournalEntries(options: Parameters<typeof this.journalRepo.findAllEntries>[0]) {
    return this.journalRepo.findAllEntries(options);
  }

  /**
   * Get a single journal entry by ID
   */
  async getJournalEntry(tenantId: string, id: string) {
    return this.journalRepo.findEntryById(tenantId, id);
  }

  /**
   * Create journal entry
   */
  async createJournalEntry(
    tenantId: string,
    userId: string,
    data: CreateJournalEntryInput
  ): Promise<JournalEntry> {
    // Validate accounts exist
    for (const line of data.lines) {
      const account = await this.accountRepo.findById(tenantId, line.account_id);
      if (!account) {
        throw new AccountingError(`Account ${line.account_id} not found`, 'ACCOUNT_NOT_FOUND', 404);
      }
    }

    // Validate balance (debits = credits)
    const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new AccountingError(
        `Journal entry must be balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        'UNBALANCED_ENTRY'
      );
    }

    return this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: data.entry_date,
        description: data.description,
        source_type: 'manual',
      },
      data.lines
    );
  }

  /**
   * Update journal entry (only if not posted)
   */
  async updateJournalEntry(
    tenantId: string,
    id: string,
    data: UpdateJournalEntryInput
  ): Promise<JournalEntry | null> {
    const entry = await this.journalRepo.findEntryById(tenantId, id);
    if (!entry) return null;

    if (entry.is_posted) {
      throw new AccountingError('Cannot update posted journal entry', 'ENTRY_POSTED');
    }

    // Validate lines if provided
    if (data.lines) {
      for (const line of data.lines) {
        const account = await this.accountRepo.findById(tenantId, line.account_id);
        if (!account) {
          throw new AccountingError(`Account ${line.account_id} not found`, 'ACCOUNT_NOT_FOUND', 404);
        }
      }

      // Validate balance
      const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new AccountingError('Journal entry must be balanced', 'UNBALANCED_ENTRY');
      }
    }

    return this.journalRepo.updateWithLines(
      tenantId,
      id,
      {
        entry_date: data.entry_date,
        description: data.description,
      },
      data.lines
    );
  }

  /**
   * Post journal entry (finalize and update account balances)
   */
  async postJournalEntry(tenantId: string, id: string): Promise<JournalEntry | null> {
    return this.journalRepo.post(tenantId, id);
  }

  /**
   * Delete journal entry (only if not posted)
   */
  async deleteJournalEntry(tenantId: string, id: string): Promise<boolean> {
    return this.journalRepo.delete(tenantId, id);
  }

  // ==================== Financial Statements ====================

  /**
   * Generate Trial Balance
   */
  async generateTrialBalance(tenantId: string, asOfDate: string): Promise<TrialBalance> {
    // Get all accounts
    const accounts = await this.accountRepo.findAll({
      tenantId,
      limit: 10000,
      includeInactive: false,
    });

    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts.data) {
      // Get account balance from journal entries up to asOfDate
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        undefined,
        asOfDate
      );

      const debitSum = lines.reduce((sum, line) => sum + line.debit, 0);
      const creditSum = lines.reduce((sum, line) => sum + line.credit, 0);
      const balance = debitSum - creditSum;

      // Determine if this is a normal debit or credit balance account
      const isDebitNormal = ['asset', 'expense'].includes(account.type);
      const debit = isDebitNormal && balance > 0 ? balance : 0;
      const credit = !isDebitNormal && balance < 0 ? Math.abs(balance) :
                     isDebitNormal && balance < 0 ? Math.abs(balance) :
                     !isDebitNormal && balance > 0 ? balance : 0;

      if (debit !== 0 || credit !== 0) {
        rows.push({
          account_code: account.code,
          account_name: account.name,
          account_type: account.type,
          debit,
          credit,
        });

        totalDebits += debit;
        totalCredits += credit;
      }
    }

    // Sort by account code
    rows.sort((a, b) => a.account_code.localeCompare(b.account_code));

    return {
      as_of_date: asOfDate,
      rows,
      total_debits: totalDebits,
      total_credits: totalCredits,
    };
  }

  /**
   * Generate Income Statement
   */
  async generateIncomeStatement(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<IncomeStatement> {
    // Get revenue and expense accounts
    const revenueAccounts = await this.accountRepo.findAll({
      tenantId,
      type: 'revenue',
      limit: 10000,
    });

    const expenseAccounts = await this.accountRepo.findAll({
      tenantId,
      type: 'expense',
      limit: 10000,
    });

    const revenues: IncomeStatementRow[] = [];
    const expenses: IncomeStatementRow[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    // Calculate revenue
    for (const account of revenueAccounts.data) {
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        startDate,
        endDate
      );

      const amount = lines.reduce((sum, line) => sum + line.credit - line.debit, 0);

      if (amount !== 0) {
        revenues.push({
          account_code: account.code,
          account_name: account.name,
          amount,
        });
        totalRevenue += amount;
      }
    }

    // Calculate expenses
    for (const account of expenseAccounts.data) {
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        startDate,
        endDate
      );

      const amount = lines.reduce((sum, line) => sum + line.debit - line.credit, 0);

      if (amount !== 0) {
        expenses.push({
          account_code: account.code,
          account_name: account.name,
          amount,
        });
        totalExpenses += amount;
      }
    }

    return {
      start_date: startDate,
      end_date: endDate,
      revenues,
      expenses,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: totalRevenue - totalExpenses,
    };
  }

  /**
   * Generate Balance Sheet
   */
  async generateBalanceSheet(tenantId: string, asOfDate: string): Promise<BalanceSheet> {
    // Get asset, liability, and equity accounts
    const assetAccounts = await this.accountRepo.findAll({
      tenantId,
      type: 'asset',
      limit: 10000,
    });

    const liabilityAccounts = await this.accountRepo.findAll({
      tenantId,
      type: 'liability',
      limit: 10000,
    });

    const equityAccounts = await this.accountRepo.findAll({
      tenantId,
      type: 'equity',
      limit: 10000,
    });

    const assets: BalanceSheetRow[] = [];
    const liabilities: BalanceSheetRow[] = [];
    const equity: BalanceSheetRow[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Calculate assets
    for (const account of assetAccounts.data) {
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        undefined,
        asOfDate
      );

      const amount = lines.reduce((sum, line) => sum + line.debit - line.credit, 0);

      if (amount !== 0) {
        assets.push({
          account_code: account.code,
          account_name: account.name,
          amount,
        });
        totalAssets += amount;
      }
    }

    // Calculate liabilities
    for (const account of liabilityAccounts.data) {
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        undefined,
        asOfDate
      );

      const amount = lines.reduce((sum, line) => sum + line.credit - line.debit, 0);

      if (amount !== 0) {
        liabilities.push({
          account_code: account.code,
          account_name: account.name,
          amount,
        });
        totalLiabilities += amount;
      }
    }

    // Calculate equity
    for (const account of equityAccounts.data) {
      const lines = await this.journalRepo.getAccountLines(
        tenantId,
        account.id,
        undefined,
        asOfDate
      );

      const amount = lines.reduce((sum, line) => sum + line.credit - line.debit, 0);

      if (amount !== 0) {
        equity.push({
          account_code: account.code,
          account_name: account.name,
          amount,
        });
        totalEquity += amount;
      }
    }

    return {
      as_of_date: asOfDate,
      assets,
      liabilities,
      equity,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
    };
  }

  /**
   * Generate General Ledger Report for an account
   */
  async generateGeneralLedger(
    tenantId: string,
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<GeneralLedgerReport> {
    const account = await this.accountRepo.findById(tenantId, accountId);
    if (!account) {
      throw new AccountingError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
    }

    // Get beginning balance (before start date)
    const beginningLines = await this.journalRepo.getAccountLines(
      tenantId,
      accountId,
      undefined,
      startDate
    );

    const beginningBalance = beginningLines.reduce(
      (sum, line) => sum + line.debit - line.credit,
      0
    );

    // Get transactions within period
    const lines = await this.journalRepo.getAccountLines(
      tenantId,
      accountId,
      startDate,
      endDate
    );

    let runningBalance = beginningBalance;
    const entries: GeneralLedgerEntry[] = (lines as unknown as JournalLineWithEntry[]).map((line) => {
      runningBalance += line.debit - line.credit;
      return {
        date: line.journal_entries.entry_date,
        entry_number: line.journal_entries.entry_number,
        description: line.description || line.journal_entries.description || '',
        debit: line.debit,
        credit: line.credit,
        balance: runningBalance,
      };
    });

    return {
      account_code: account.code,
      account_name: account.name,
      start_date: startDate,
      end_date: endDate,
      beginning_balance: beginningBalance,
      entries,
      ending_balance: runningBalance,
    };
  }

  /**
   * Import default chart of accounts
   */
  async importDefaultChartOfAccounts(tenantId: string): Promise<Account[]> {
    const defaultAccounts: CreateAccountInput[] = [
      // Assets
      { code: '1000', name: 'Assets', type: 'asset' },
      { code: '1100', name: 'Current Assets', type: 'asset', parent_id: '1000' },
      { code: '1110', name: 'Cash', type: 'asset', parent_id: '1100' },
      { code: '1120', name: 'Accounts Receivable', type: 'asset', parent_id: '1100' },
      { code: '1130', name: 'Inventory', type: 'asset', parent_id: '1100' },
      { code: '1200', name: 'Fixed Assets', type: 'asset', parent_id: '1000' },
      { code: '1210', name: 'Equipment', type: 'asset', parent_id: '1200' },
      { code: '1220', name: 'Accumulated Depreciation', type: 'asset', parent_id: '1200' },

      // Liabilities
      { code: '2000', name: 'Liabilities', type: 'liability' },
      { code: '2100', name: 'Current Liabilities', type: 'liability', parent_id: '2000' },
      { code: '2110', name: 'Accounts Payable', type: 'liability', parent_id: '2100' },
      { code: '2120', name: 'Sales Tax Payable', type: 'liability', parent_id: '2100' },

      // Equity
      { code: '3000', name: 'Equity', type: 'equity' },
      { code: '3100', name: 'Retained Earnings', type: 'equity', parent_id: '3000' },

      // Revenue
      { code: '4000', name: 'Revenue', type: 'revenue' },
      { code: '4100', name: 'Sales Revenue', type: 'revenue', parent_id: '4000' },
      { code: '4200', name: 'Service Revenue', type: 'revenue', parent_id: '4000' },

      // Expenses
      { code: '5000', name: 'Expenses', type: 'expense' },
      { code: '5100', name: 'Cost of Goods Sold', type: 'expense', parent_id: '5000' },
      { code: '5200', name: 'Operating Expenses', type: 'expense', parent_id: '5000' },
      { code: '5210', name: 'Salaries Expense', type: 'expense', parent_id: '5200' },
      { code: '5220', name: 'Rent Expense', type: 'expense', parent_id: '5200' },
      { code: '5230', name: 'Utilities Expense', type: 'expense', parent_id: '5200' },
    ];

    const createdAccounts: Account[] = [];
    const accountMap = new Map<string, string>(); // code -> id mapping

    // Create accounts in order (parents before children)
    for (const accountData of defaultAccounts) {
      const createData: CreateAccountInput = {
        code: accountData.code,
        name: accountData.name,
        type: accountData.type,
      };

      // Resolve parent_id from code
      if (accountData.parent_id) {
        const parentId = accountMap.get(accountData.parent_id);
        if (parentId) {
          createData.parent_id = parentId;
        }
      }

      try {
        const account = await this.accountRepo.create(tenantId, createData);
        createdAccounts.push(account);
        accountMap.set(account.code, account.id);
      } catch (error) {
        // Skip if account already exists
        console.warn(`Skipping account ${accountData.code}: ${error}`);
      }
    }

    return createdAccounts;
  }

  // ==================== Auto-Generation from Stock Transactions ====================

  /**
   * Generate journal entry from sales invoice
   */
  async generateJournalEntryFromSale(
    tenantId: string,
    userId: string,
    invoiceId: string,
    invoice: {
      total: number;
      subtotal: number;
      tax_amount: number;
      party_id?: string;
    },
    defaultAccounts: {
      cash_account_id?: string;
      accounts_receivable_id?: string;
      sales_revenue_id?: string;
      sales_tax_payable_id?: string;
    }
  ): Promise<JournalEntry | null> {
    // Determine debit account (Cash or Accounts Receivable)
    const debitAccountId = invoice.party_id
      ? defaultAccounts.accounts_receivable_id
      : defaultAccounts.cash_account_id;

    if (!debitAccountId || !defaultAccounts.sales_revenue_id) {
      console.warn('Default accounts not configured for sales');
      return null;
    }

    const lines = [
      // Debit: Cash or Accounts Receivable
      {
        account_id: debitAccountId,
        debit: invoice.total,
        credit: 0,
        description: 'Sale transaction',
      },
      // Credit: Sales Revenue
      {
        account_id: defaultAccounts.sales_revenue_id,
        debit: 0,
        credit: invoice.subtotal,
        description: 'Sales revenue',
      },
    ];

    // Add sales tax if applicable
    if (invoice.tax_amount > 0 && defaultAccounts.sales_tax_payable_id) {
      lines.push({
        account_id: defaultAccounts.sales_tax_payable_id,
        debit: 0,
        credit: invoice.tax_amount,
        description: 'Sales tax',
      });
    }

    return this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Sale invoice`,
        source_type: 'sale',
        source_id: invoiceId,
      },
      lines
    );
  }

  /**
   * Generate journal entry from purchase invoice
   */
  async generateJournalEntryFromPurchase(
    tenantId: string,
    userId: string,
    invoiceId: string,
    invoice: {
      total: number;
      subtotal: number;
      tax_amount: number;
      party_id?: string;
    },
    defaultAccounts: {
      cash_account_id?: string;
      accounts_payable_id?: string;
      inventory_asset_id?: string;
      cogs_expense_id?: string;
    }
  ): Promise<JournalEntry | null> {
    // Determine credit account (Cash or Accounts Payable)
    const creditAccountId = invoice.party_id
      ? defaultAccounts.accounts_payable_id
      : defaultAccounts.cash_account_id;

    if (!creditAccountId || !defaultAccounts.inventory_asset_id) {
      console.warn('Default accounts not configured for purchases');
      return null;
    }

    const lines = [
      // Debit: Inventory
      {
        account_id: defaultAccounts.inventory_asset_id,
        debit: invoice.total,
        credit: 0,
        description: 'Inventory purchase',
      },
      // Credit: Cash or Accounts Payable
      {
        account_id: creditAccountId,
        debit: 0,
        credit: invoice.total,
        description: 'Purchase payment',
      },
    ];

    return this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Purchase invoice`,
        source_type: 'purchase',
        source_id: invoiceId,
      },
      lines
    );
  }

  /**
   * Generate journal entry from payment
   */
  async generateJournalEntryFromPayment(
    tenantId: string,
    userId: string,
    paymentId: string,
    payment: {
      amount: number;
      type: 'received' | 'made';
    },
    defaultAccounts: {
      cash_account_id?: string;
      accounts_receivable_id?: string;
      accounts_payable_id?: string;
    }
  ): Promise<JournalEntry | null> {
    if (!defaultAccounts.cash_account_id) {
      console.warn('Default cash account not configured');
      return null;
    }

    let lines;

    if (payment.type === 'received') {
      // Payment received from customer
      if (!defaultAccounts.accounts_receivable_id) return null;

      lines = [
        // Debit: Cash
        {
          account_id: defaultAccounts.cash_account_id,
          debit: payment.amount,
          credit: 0,
          description: 'Payment received',
        },
        // Credit: Accounts Receivable
        {
          account_id: defaultAccounts.accounts_receivable_id,
          debit: 0,
          credit: payment.amount,
          description: 'Customer payment',
        },
      ];
    } else {
      // Payment made to supplier
      if (!defaultAccounts.accounts_payable_id) return null;

      lines = [
        // Debit: Accounts Payable
        {
          account_id: defaultAccounts.accounts_payable_id,
          debit: payment.amount,
          credit: 0,
          description: 'Supplier payment',
        },
        // Credit: Cash
        {
          account_id: defaultAccounts.cash_account_id,
          debit: 0,
          credit: payment.amount,
          description: 'Payment made',
        },
      ];
    }

    return this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Payment ${payment.type}`,
        source_type: 'payment',
        source_id: paymentId,
      },
      lines
    );
  }

  /**
   * Generate journal entry from expense
   */
  async generateJournalEntryFromExpense(
    tenantId: string,
    userId: string,
    expenseId: string,
    expense: {
      amount: number;
      category_name: string;
    },
    defaultAccounts: {
      cash_account_id?: string;
      expense_account_id?: string;
    }
  ): Promise<JournalEntry | null> {
    if (!defaultAccounts.cash_account_id || !defaultAccounts.expense_account_id) {
      console.warn('Default accounts not configured for expenses');
      return null;
    }

    const lines = [
      // Debit: Expense
      {
        account_id: defaultAccounts.expense_account_id,
        debit: expense.amount,
        credit: 0,
        description: expense.category_name,
      },
      // Credit: Cash
      {
        account_id: defaultAccounts.cash_account_id,
        debit: 0,
        credit: expense.amount,
        description: 'Expense payment',
      },
    ];

    return this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Expense: ${expense.category_name}`,
        source_type: 'expense',
        source_id: expenseId,
      },
      lines
    );
  }
}
