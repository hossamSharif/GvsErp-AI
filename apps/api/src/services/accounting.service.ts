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
  CreateJournalLineInput,
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
  DayBookReport,
  DayBookEntry,
  AgingReport,
  AgingBucket,
  AgingPartyRow,
} from '@erp/shared';

/**
 * Default aging buckets (in days) matching Tally's standard layout.
 * "to=null" means the bucket includes everything beyond `from` (e.g. 90+).
 */
const DEFAULT_AGING_BUCKETS: { label: string; from: number; to: number | null }[] = [
  { label: '0-30', from: 0, to: 31 },
  { label: '31-60', from: 31, to: 61 },
  { label: '61-90', from: 61, to: 91 },
  { label: '90+', from: 91, to: null },
];

function emptyBuckets(
  defs: { label: string; from: number; to: number | null }[]
): AgingBucket[] {
  return defs.map((d) => ({ label: d.label, from: d.from, to: d.to, amount: 0 }));
}

function bucketIndexFor(
  daysOld: number,
  defs: { label: string; from: number; to: number | null }[]
): number {
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const ok = daysOld >= d.from && (d.to === null || daysOld < d.to);
    if (ok) return i;
  }
  return defs.length - 1;
}

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

/**
 * Semantic roles that auto-posting flows resolve to a ledger account.
 * Must stay in sync with the CHECK constraint on
 * accounting_default_accounts.role (migration 021).
 */
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
  | 'service_purchase_expense'
  | 'opening_balance_equity';

export type AccountingDefaults = Partial<Record<AccountingDefaultRole, string>>;

/**
 * Mapping from semantic role to the account code seeded by
 * importDefaultChartOfAccounts(). Roles missing here (e.g. discount_allowed)
 * have no default account in the standard chart and are populated lazily by
 * the auto-posting flow or via the Settings UI.
 */
const DEFAULT_ROLE_TO_CODE: Partial<Record<AccountingDefaultRole, string>> = {
  cash_in_hand: '1110',
  accounts_receivable: '1120',
  inventory_asset: '1130',
  accounts_payable: '2110',
  sales_tax_payable: '2120',
  sales_revenue: '4100',
  cogs: '5100',
  general_expense: '5200',
  service_purchase_expense: '5200',
  salary_expense: '5210',
  opening_balance_equity: '3200',
};

/**
 * Daily Journal report shapes (simple owner/manager daily snapshot).
 * Kept local to the service — this report is not part of @erp/shared.
 */
export interface DailyJournalInvoiceItem {
  id: string;
  number: string;
  party: string | null;
  amount: number;
}

export interface DailyJournalSection {
  total: number;
  items: DailyJournalInvoiceItem[];
}

export interface DailyJournalExpenseItem {
  id: string;
  category: string | null;
  description: string | null;
  amount: number;
}

export interface DailyJournalExpenseSection {
  total: number;
  items: DailyJournalExpenseItem[];
}

export interface DailyJournalPaymentItem {
  id: string;
  party: string | null;
  /** 'Cash' or the specific bank account name. */
  method: string;
  amount: number;
}

export interface DailyJournalPaymentSection {
  total: number;
  items: DailyJournalPaymentItem[];
}

export interface DailyJournalReport {
  date: string;
  sales: DailyJournalSection;
  purchases: DailyJournalSection;
  expenses: DailyJournalExpenseSection;
  payments: {
    received: DailyJournalPaymentSection;
    made: DailyJournalPaymentSection;
  };
  kpis: {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    netCashFlow: number;
  };
  balances: {
    cash: number;
    /** Sum of all active bank-account ledger balances (kept for backward compat). */
    bank: number;
    /** Per-bank-account breakdown backing `bank` — one tenant may have several banks. */
    banks: Array<{ id: string; name: string; balance: number }>;
    totalLiquid: number;
  };
}

/**
 * Per-User Daily Summary report shapes. Not real shift tracking (no clock
 * in/out concept exists) — this is a per-user, per-day/range breakdown built
 * from the created_by columns already present on invoices/payments/expenses.
 */
export interface UserSummaryAmount {
  count: number;
  amount: number;
}

/**
 * Bank-account breakdown of a payments bucket, keyed by bank_account_id.
 * A tenant may have several bank accounts — `bank` stays as the lumped
 * total (backward-compatible), `byBank` lets a caller show per-bank figures.
 */
export type UserSummaryByBank = Record<string, UserSummaryAmount>;

export interface UserSummaryRow {
  /** 'unknown' for the created_by IS NULL bucket. */
  userId: string;
  /** 'Unknown / System' for the unknown bucket. */
  userName: string;
  isActive: boolean;
  sales: UserSummaryAmount;
  purchases: UserSummaryAmount;
  paymentsReceived: { cash: UserSummaryAmount; bank: UserSummaryAmount; byBank: UserSummaryByBank };
  paymentsMade: { cash: UserSummaryAmount; bank: UserSummaryAmount; byBank: UserSummaryByBank };
  expenses: UserSummaryAmount;
  net: number;
}

export interface UserDailySummaryReport {
  startDate: string;
  endDate: string;
  /** Active bank accounts referenced anywhere in `rows`, for labeling `byBank` keys. */
  banks: Array<{ id: string; name: string }>;
  rows: UserSummaryRow[];
  totals: {
    sales: UserSummaryAmount;
    purchases: UserSummaryAmount;
    paymentsReceived: { cash: number; bank: number; byBank: Record<string, number> };
    paymentsMade: { cash: number; bank: number; byBank: Record<string, number> };
    expenses: UserSummaryAmount;
    net: number;
  };
}

const UNKNOWN_USER_ID = 'unknown';
const UNKNOWN_USER_NAME = 'Unknown / System';

function emptyUserSummaryRow(userId: string, userName: string, isActive: boolean): UserSummaryRow {
  return {
    userId,
    userName,
    isActive,
    sales: { count: 0, amount: 0 },
    purchases: { count: 0, amount: 0 },
    paymentsReceived: {
      cash: { count: 0, amount: 0 },
      bank: { count: 0, amount: 0 },
      byBank: {},
    },
    paymentsMade: {
      cash: { count: 0, amount: 0 },
      bank: { count: 0, amount: 0 },
      byBank: {},
    },
    expenses: { count: 0, amount: 0 },
    net: 0,
  };
}

function addToByBank(byBank: UserSummaryByBank, bankAccountId: string, amount: number): void {
  const bucket = byBank[bankAccountId] ?? { count: 0, amount: 0 };
  bucket.count += 1;
  bucket.amount += amount;
  byBank[bankAccountId] = bucket;
}

export class AccountingService {
  private accountRepo: AccountRepository;
  private journalRepo: JournalEntryRepository;
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
    this.accountRepo = new AccountRepository(supabase);
    this.journalRepo = new JournalEntryRepository(supabase);
  }

  // ==================== Module Settings & Defaults ====================

  /**
   * Check whether the accounting module is enabled for this tenant. Used by
   * auto-posting flows to silently skip when accounting is off — tenants who
   * haven't activated the module see no behavior change.
   */
  async isEnabled(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    const settings = (data.settings ?? {}) as Record<string, any>;
    // Tolerate both schemas:
    //   modern: settings.modules.accounting.enabled (set by accounting/activate)
    //   legacy: settings.accounting_module_enabled (flat boolean, set by
    //   settings.service.ts:toggleAccountingModule for tenants created
    //   before the modules object schema landed).
    // settings.modules.accounting may also literally be a boolean true/false
    // from resetSettings() initialization; treat true === enabled, object
    // → read .enabled.
    const mod = settings?.modules?.accounting;
    if (mod === true) return true;
    if (mod && typeof mod === 'object' && mod.enabled) return true;
    if (settings?.accounting_module_enabled === true) return true;
    return false;
  }

  /**
   * Resolve all configured default-role -> account_id mappings for a tenant.
   * Roles without a configured mapping are simply absent from the returned
   * object — callers must handle missing values (typically by skipping the
   * post and warning).
   */
  async getDefaultAccountIds(tenantId: string): Promise<AccountingDefaults> {
    const { data, error } = await this.supabase
      .from('accounting_default_accounts' as any)
      .select('role, account_id')
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }

    const out: AccountingDefaults = {};
    for (const row of ((data as unknown) as { role: string; account_id: string }[]) ?? []) {
      out[row.role as AccountingDefaultRole] = row.account_id;
    }
    return out;
  }

  /**
   * Upsert a single role -> account mapping.
   */
  async setDefaultAccount(
    tenantId: string,
    role: AccountingDefaultRole,
    accountId: string
  ): Promise<void> {
    // Validate account exists and belongs to the tenant
    const account = await this.accountRepo.findById(tenantId, accountId);
    if (!account) {
      throw new AccountingError('Account not found', 'ACCOUNT_NOT_FOUND', 404);
    }

    const { error } = await this.supabase
      .from('accounting_default_accounts' as any)
      .upsert(
        { tenant_id: tenantId, role, account_id: accountId },
        { onConflict: 'tenant_id,role' }
      );

    if (error) {
      throw error;
    }
  }

  /**
   * Get or lazily create the Opening Balance Equity account (code 3200) and
   * ensure it is mapped to the 'opening_balance_equity' default role.
   * Returns the account ID.
   */
  async getOrCreateOpeningBalanceEquityAccount(tenantId: string): Promise<string> {
    const defaults = await this.getDefaultAccountIds(tenantId);
    if (defaults.opening_balance_equity) {
      return defaults.opening_balance_equity;
    }

    const existing = await this.accountRepo.findByCode(tenantId, '3200');
    let accountId: string;
    if (existing) {
      accountId = existing.id;
    } else {
      // Resolve the Equity parent (3000) if it exists.
      const equityParent = await this.accountRepo.findByCode(tenantId, '3000');
      const created = await this.accountRepo.create(tenantId, {
        code: '3200',
        name: 'Opening Balance Equity',
        type: 'equity',
        parent_id: equityParent?.id,
      });
      accountId = created.id;
    }

    await this.setDefaultAccount(tenantId, 'opening_balance_equity', accountId);
    return accountId;
  }

  /**
   * Internal: seed the default role mappings for a tenant after a chart of
   * accounts has been imported. Idempotent — uses upsert. Skips roles whose
   * mapped account_code wasn't created (e.g. tenant pruned the default
   * chart).
   */
  private async seedDefaultAccountMappings(
    tenantId: string,
    accountMap: Map<string, string>
  ): Promise<void> {
    const rows: { tenant_id: string; role: string; account_id: string }[] = [];
    for (const [role, code] of Object.entries(DEFAULT_ROLE_TO_CODE)) {
      const accountId = accountMap.get(code);
      if (accountId) {
        rows.push({ tenant_id: tenantId, role, account_id: accountId });
      }
    }

    if (rows.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from('accounting_default_accounts' as any)
      .upsert(rows, { onConflict: 'tenant_id,role' });

    if (error) {
      throw error;
    }
  }

  // ==================== Party Ledgers (Phase 4) ====================

  /**
   * Ensure the given party owns a dedicated ledger account under the
   * tenant's Sundry Debtors (customers) or Sundry Creditors (suppliers).
   *
   * The "every party is a ledger" pattern is Tally's defining choice: the
   * trial balance and balance sheet expand to show one line per party
   * instead of a single AR/AP total.
   *
   * Idempotent — if the party already has `ledger_account_id`, returns it
   * untouched. Returns null when accounting is disabled or the parent
   * default account isn't mapped yet (in which case auto-posting falls
   * back to the legacy default).
   */
  async ensurePartyLedger(
    tenantId: string,
    partyId: string,
    partyType: 'customer' | 'supplier'
  ): Promise<string | null> {
    // Fast path: already linked.
    const { data: party, error: pErr } = await this.supabase
      .from('parties')
      .select('id, name, type, is_active, ledger_account_id')
      .eq('tenant_id', tenantId)
      .eq('id', partyId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!party) return null;
    const partyRow = party as unknown as {
      id: string;
      name: string;
      ledger_account_id: string | null;
    };
    if (partyRow.ledger_account_id) {
      return partyRow.ledger_account_id;
    }

    if (!(await this.isEnabled(tenantId))) {
      return null;
    }

    // Resolve the appropriate parent group account.
    const defaults = await this.getDefaultAccountIds(tenantId);
    const parentId =
      partyType === 'customer' ? defaults.accounts_receivable : defaults.accounts_payable;
    if (!parentId) {
      console.warn(
        `[accounting] Cannot create party ledger for ${partyId}: ${
          partyType === 'customer' ? 'accounts_receivable' : 'accounts_payable'
        } default unmapped`
      );
      return null;
    }

    // Code: PTY-<first 8 of party uuid>. Deterministic so re-running the
    // logic doesn't double-insert (UNIQUE on tenant_id+code is the guard).
    const code = `PTY-${partyId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    // Try create; if conflict, look up the existing one.
    let ledgerAccountId: string;
    try {
      const account = await this.accountRepo.create(tenantId, {
        code,
        name: partyRow.name,
        type: partyType === 'customer' ? 'asset' : 'liability',
        parent_id: parentId,
      });
      ledgerAccountId = account.id;
    } catch (err) {
      const existing = await this.accountRepo.findByCode(tenantId, code);
      if (!existing) throw err;
      ledgerAccountId = existing.id;
    }

    // Link the party.
    const { error: uErr } = await this.supabase
      .from('parties')
      .update({ ledger_account_id: ledgerAccountId } as any)
      .eq('tenant_id', tenantId)
      .eq('id', partyId);
    if (uErr) throw uErr;

    // Promote the parent to a group account so future direct postings are
    // rejected — only party-specific leaf ledgers should accept JEs.
    await this.supabase
      .from('accounts')
      .update({ is_group: true } as any)
      .eq('id', parentId)
      .eq('is_group', false);

    return ledgerAccountId;
  }

  /**
   * Sync the linked ledger's name when a party is renamed. Tally renames
   * the underlying ledger when the party is renamed.
   */
  async syncPartyLedgerName(
    tenantId: string,
    partyId: string,
    newName: string
  ): Promise<void> {
    const { data: party, error } = await this.supabase
      .from('parties')
      .select('ledger_account_id')
      .eq('tenant_id', tenantId)
      .eq('id', partyId)
      .maybeSingle();
    if (error || !party) return;
    const ledgerId = (party as unknown as { ledger_account_id: string | null }).ledger_account_id;
    if (!ledgerId) return;
    await this.accountRepo.update(tenantId, ledgerId, { name: newName });
  }

  /**
   * Resolve the party's specific ledger ID, falling back to the
   * tenant-wide default (accounts_receivable / accounts_payable) when the
   * party hasn't been linked yet. Used by auto-posting flows.
   */
  async getPartyLedgerOrDefault(
    tenantId: string,
    partyId: string | null | undefined,
    side: 'receivable' | 'payable'
  ): Promise<string | null> {
    if (partyId) {
      const { data, error } = await this.supabase
        .from('parties')
        .select('ledger_account_id')
        .eq('tenant_id', tenantId)
        .eq('id', partyId)
        .maybeSingle();
      if (!error && data) {
        const id = (data as unknown as { ledger_account_id: string | null }).ledger_account_id;
        if (id) return id;
      }
    }
    const defaults = await this.getDefaultAccountIds(tenantId);
    return (side === 'receivable' ? defaults.accounts_receivable : defaults.accounts_payable) ?? null;
  }

  // ==================== Reversal ====================

  /**
   * Create a reversing journal entry for the JE that originated from
   * (sourceType, sourceId). Posted entries are immutable — to undo their
   * effect we post a mirror entry with debits/credits swapped. Used by the
   * invoice / payment / expense delete paths.
   *
   * Returns null if no original entry exists (e.g. tenant didn't have
   * accounting enabled when the source was created).
   */
  async reverseEntry(
    tenantId: string,
    userId: string | null,
    sourceType: string,
    sourceId: string,
    reason: string
  ): Promise<JournalEntry | null> {
    const original = await this.journalRepo.findBySource(
      tenantId,
      sourceType,
      sourceId
    );
    if (!original || !original.lines || original.lines.length === 0) {
      return null;
    }

    // Don't double-reverse — if a reversal already exists, no-op.
    const existingReversal = await this.journalRepo.findBySource(
      tenantId,
      `${sourceType}-reversal`,
      original.id
    );
    if (existingReversal) {
      return existingReversal;
    }

    const today = new Date().toISOString().split('T')[0];
    const reverseLines: CreateJournalLineInput[] = original.lines.map((line) => ({
      account_id: line.account_id,
      debit: line.credit,
      credit: line.debit,
      description: line.description,
    }));

    const reversal = await this.journalRepo.createWithLines(
      tenantId,
      userId,
      {
        entry_date: today,
        description: `Reversal of ${original.entry_number}: ${reason}`,
        source_type: `${sourceType}-reversal`,
        source_id: original.id,
        // Phase 2: stamp the reversal voucher type so it gets a REV-
        // prefix and shows distinctly in the day book.
        voucher_type: 'reversal',
        narration: `Reversal of ${original.entry_number}: ${reason}`,
      },
      reverseLines
    );

    return this.journalRepo.post(tenantId, reversal.id);
  }

  // ==================== Chart of Accounts ====================

  /**
   * Get chart of accounts tree
   */
  async getChartOfAccounts(tenantId: string, type?: AccountType): Promise<Account[]> {
    return this.accountRepo.getAccountTree(tenantId, type);
  }

  /**
   * Get chart of accounts as flat list with depth indicator
   */
  async getFlatChartOfAccounts(tenantId: string, type?: AccountType): Promise<(Account & { depth: number })[]> {
    const tree = await this.accountRepo.getAccountTree(tenantId, type);
    const result: (Account & { depth: number })[] = [];

    const traverse = (nodes: Account[], depth: number = 0) => {
      for (const node of nodes) {
        const { children, ...account } = node as Account & { children?: Account[] };
        result.push({ ...account, children, depth } as Account & { depth: number });
        if (children && children.length > 0) {
          traverse(children, depth + 1);
        }
      }
    };

    traverse(tree);
    return result;
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
        // Phase 2: manual entries default to 'journal' voucher type (F7).
        voucher_type: 'journal',
        narration: data.description,
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
      { code: '3200', name: 'Opening Balance Equity', type: 'equity', parent_id: '3000' },

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
        // Account may already exist from a prior activation. Look it up so
        // the role-mapping seed below can still populate.
        const existing = await this.accountRepo.findByCode(tenantId, accountData.code);
        if (existing) {
          accountMap.set(existing.code, existing.id);
        } else {
          console.warn(`Skipping account ${accountData.code}: ${error}`);
        }
      }
    }

    // Seed the role -> account mapping so auto-posting flows have defaults.
    await this.seedDefaultAccountMappings(tenantId, accountMap);

    return createdAccounts;
  }

  // ==================== Auto-Generation from Stock Transactions ====================

  /**
   * If a posted journal entry already exists for this (source_type, source_id),
   * fetch and return it instead of erroring on the partial unique index from
   * migration 021. Lets callers retry safely.
   */
  private async findExistingPostedEntry(
    tenantId: string,
    sourceType: string,
    sourceId: string
  ): Promise<JournalEntry | null> {
    const existing = await this.journalRepo.findBySource(tenantId, sourceType, sourceId);
    return existing && existing.is_posted ? existing : null;
  }

  /**
   * Phase 2: derive a Tally voucher_type from the auto-posting source_type.
   * Returns 'journal' as a safe fallback for unknown source_types.
   */
  private sourceTypeToVoucherType(sourceType: string): string {
    if (sourceType.endsWith('-reversal')) return 'reversal';
    switch (sourceType) {
      case 'sale':
        return 'sales';
      case 'purchase':
        return 'purchase';
      case 'payment':
        return 'payment';
      case 'expense':
        return 'payment';
      case 'cogs':
        return 'cogs';
      case 'manual':
        return 'journal';
      default:
        return 'journal';
    }
  }

  /**
   * Recognise Postgres unique-violation (23505) raised by the
   * uq_journal_entries_source_posted partial index — fall back to fetching
   * the entry that already won the race.
   */
  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }

  /**
   * Create + post a journal entry derived from a sales invoice.
   *
   *   Dr  Cash / Accounts Receivable    (total)
   *   Cr  Sales Revenue                 (total - tax_amount)
   *   Cr  Sales Tax Payable             (tax_amount)              [if tax > 0]
   *
   * Note: previously the credit side used `subtotal` which left the entry
   * unbalanced whenever a discount or rounding was applied. Using
   * `total - tax_amount` is always balanced against the `total` debit.
   *
   * Returns null if accounting is not enabled or required defaults are
   * unmapped. Idempotent: a second call for the same invoice returns the
   * existing entry.
   */
  async generateJournalEntryFromSale(
    tenantId: string,
    userId: string | null,
    invoiceId: string,
    invoice: {
      total: number;
      subtotal: number;
      tax_amount: number;
      party_id?: string | null;
    },
    entryDate?: string
  ): Promise<JournalEntry | null> {
    const existing = await this.findExistingPostedEntry(tenantId, 'sale', invoiceId);
    if (existing) return existing;

    const defaults = await this.getDefaultAccountIds(tenantId);
    // Phase 4: prefer the party's specific ledger (under Sundry Debtors)
    // over the generic accounts_receivable default.
    const debitAccountId = invoice.party_id
      ? await this.getPartyLedgerOrDefault(tenantId, invoice.party_id, 'receivable')
      : defaults.cash_in_hand;

    if (!debitAccountId || !defaults.sales_revenue) {
      console.warn(
        `[accounting] Skipping sale JE for invoice ${invoiceId}: missing default accounts (cash_in_hand/accounts_receivable, sales_revenue)`
      );
      return null;
    }

    const taxAmount = invoice.tax_amount || 0;
    const revenueAmount = invoice.total - taxAmount;

    const lines: CreateJournalLineInput[] = [
      {
        account_id: debitAccountId,
        debit: invoice.total,
        credit: 0,
        description: 'Sale',
      },
      {
        account_id: defaults.sales_revenue,
        debit: 0,
        credit: revenueAmount,
        description: 'Sales revenue',
      },
    ];

    if (taxAmount > 0) {
      if (!defaults.sales_tax_payable) {
        console.warn(
          `[accounting] Sale invoice ${invoiceId} has tax but sales_tax_payable role is unmapped. Bundling tax into revenue.`
        );
        lines[1].credit = invoice.total;
      } else {
        lines.push({
          account_id: defaults.sales_tax_payable,
          debit: 0,
          credit: taxAmount,
          description: 'Sales tax',
        });
      }
    }

    return this.createAndPost(tenantId, userId, {
      entry_date: entryDate ?? new Date().toISOString().split('T')[0],
      description: `Sale invoice`,
      source_type: 'sale',
      source_id: invoiceId,
      lines,
    });
  }

  /**
   * Create + post a journal entry derived from a purchase invoice.
   *
   *   Dr  Inventory                     (total)
   *   Cr  Cash / Accounts Payable       (total)
   *
   * Tax stays bundled with inventory in v1 — per-jurisdiction tax split is
   * deferred (see plan Phase 5). Idempotent.
   */
  async generateJournalEntryFromPurchase(
    tenantId: string,
    userId: string | null,
    invoiceId: string,
    invoice: {
      total: number;
      subtotal: number;
      tax_amount: number;
      party_id?: string | null;
    },
    entryDate?: string
  ): Promise<JournalEntry | null> {
    const existing = await this.findExistingPostedEntry(tenantId, 'purchase', invoiceId);
    if (existing) return existing;

    const defaults = await this.getDefaultAccountIds(tenantId);
    // Phase 4: prefer the supplier's specific ledger (under Sundry
    // Creditors) over the generic accounts_payable default.
    const creditAccountId = invoice.party_id
      ? await this.getPartyLedgerOrDefault(tenantId, invoice.party_id, 'payable')
      : defaults.cash_in_hand;

    if (!creditAccountId || !defaults.inventory_asset) {
      console.warn(
        `[accounting] Skipping purchase JE for invoice ${invoiceId}: missing default accounts (accounts_payable/cash_in_hand, inventory_asset)`
      );
      return null;
    }

    const lines: CreateJournalLineInput[] = [
      {
        account_id: defaults.inventory_asset,
        debit: invoice.total,
        credit: 0,
        description: 'Inventory purchase',
      },
      {
        account_id: creditAccountId,
        debit: 0,
        credit: invoice.total,
        description: 'Purchase',
      },
    ];

    return this.createAndPost(tenantId, userId, {
      entry_date: entryDate ?? new Date().toISOString().split('T')[0],
      description: `Purchase invoice`,
      source_type: 'purchase',
      source_id: invoiceId,
      lines,
    });
  }

  /**
   * Create + post a journal entry derived from a payment.
   *
   * Received from customer:
   *   Dr  Cash
   *   Cr  Accounts Receivable
   *
   * Made to supplier:
   *   Dr  Accounts Payable
   *   Cr  Cash
   *
   * Idempotent.
   */
  async generateJournalEntryFromPayment(
    tenantId: string,
    userId: string | null,
    paymentId: string,
    payment: {
      amount: number;
      type: 'received' | 'made';
      /**
       * Party that the payment belongs to. Phase 4: when provided, the
       * AR/AP side of the JE lands on the party's specific ledger
       * (Sundry Debtors/Creditors) instead of the tenant-wide default.
       */
      party_id?: string | null;
      /**
       * Bank-account ledger to use instead of the default cash_in_hand.
       * Plan Phase 3: payments routed through a bank_account land on that
       * bank's ledger rather than generic cash.
       */
      cash_account_id_override?: string | null;
    },
    entryDate?: string
  ): Promise<JournalEntry | null> {
    const existing = await this.findExistingPostedEntry(tenantId, 'payment', paymentId);
    if (existing) return existing;

    const defaults = await this.getDefaultAccountIds(tenantId);
    const cashAccountId = payment.cash_account_id_override ?? defaults.cash_in_hand;
    if (!cashAccountId) {
      console.warn(
        `[accounting] Skipping payment JE for ${paymentId}: cash_in_hand role unmapped`
      );
      return null;
    }

    let lines: CreateJournalLineInput[];
    if (payment.type === 'received') {
      // Phase 4: prefer party-specific ledger over generic AR default.
      const arAccountId = await this.getPartyLedgerOrDefault(
        tenantId,
        payment.party_id ?? null,
        'receivable'
      );
      if (!arAccountId) {
        console.warn(
          `[accounting] Skipping payment JE for ${paymentId}: accounts_receivable role unmapped and no party ledger`
        );
        return null;
      }
      lines = [
        {
          account_id: cashAccountId,
          debit: payment.amount,
          credit: 0,
          description: 'Payment received',
        },
        {
          account_id: arAccountId,
          debit: 0,
          credit: payment.amount,
          description: 'Customer payment',
        },
      ];
    } else {
      const apAccountId = await this.getPartyLedgerOrDefault(
        tenantId,
        payment.party_id ?? null,
        'payable'
      );
      if (!apAccountId) {
        console.warn(
          `[accounting] Skipping payment JE for ${paymentId}: accounts_payable role unmapped and no party ledger`
        );
        return null;
      }
      lines = [
        {
          account_id: apAccountId,
          debit: payment.amount,
          credit: 0,
          description: 'Supplier payment',
        },
        {
          account_id: cashAccountId,
          debit: 0,
          credit: payment.amount,
          description: 'Payment made',
        },
      ];
    }

    return this.createAndPost(tenantId, userId, {
      entry_date: entryDate ?? new Date().toISOString().split('T')[0],
      description: `Payment ${payment.type}`,
      source_type: 'payment',
      source_id: paymentId,
      // Phase 2: received-from-customer → receipt voucher (Tally F6);
      // made-to-supplier → payment voucher (F5).
      voucher_type: payment.type === 'received' ? 'receipt' : 'payment',
      lines,
    });
  }

  /**
   * Create + post a journal entry derived from an expense.
   *
   *   Dr  Expense (general or category-mapped)
   *   Cr  Cash
   *
   * Idempotent.
   */
  async generateJournalEntryFromExpense(
    tenantId: string,
    userId: string | null,
    expenseId: string,
    expense: {
      amount: number;
      category_name: string;
    },
    entryDate?: string
  ): Promise<JournalEntry | null> {
    const existing = await this.findExistingPostedEntry(tenantId, 'expense', expenseId);
    if (existing) return existing;

    const defaults = await this.getDefaultAccountIds(tenantId);
    const expenseAccountId = defaults.general_expense;

    if (!defaults.cash_in_hand || !expenseAccountId) {
      console.warn(
        `[accounting] Skipping expense JE for ${expenseId}: missing default accounts (cash_in_hand, general_expense)`
      );
      return null;
    }

    const lines: CreateJournalLineInput[] = [
      {
        account_id: expenseAccountId,
        debit: expense.amount,
        credit: 0,
        description: expense.category_name,
      },
      {
        account_id: defaults.cash_in_hand,
        debit: 0,
        credit: expense.amount,
        description: 'Expense payment',
      },
    ];

    return this.createAndPost(tenantId, userId, {
      entry_date: entryDate ?? new Date().toISOString().split('T')[0],
      description: `Expense: ${expense.category_name}`,
      source_type: 'expense',
      source_id: expenseId,
      lines,
    });
  }

  /**
   * Shared helper: create a journal entry, post it, handle the
   * idempotency unique-violation cleanly.
   *
   * Phase 2: stamps voucher_type so each auto-posted entry gets the right
   * Tally prefix (SAL-, PUR-, RCT-, PAY-, COGS-, REV-) on entry_number.
   */
  private async createAndPost(
    tenantId: string,
    userId: string | null,
    args: {
      entry_date: string;
      description: string;
      source_type: string;
      source_id: string;
      voucher_type?: string;
      lines: CreateJournalLineInput[];
    }
  ): Promise<JournalEntry | null> {
    // Map source_type → voucher_type when caller didn't supply one.
    const voucherType =
      args.voucher_type ?? this.sourceTypeToVoucherType(args.source_type);
    try {
      const entry = await this.journalRepo.createWithLines(
        tenantId,
        userId,
        {
          entry_date: args.entry_date,
          description: args.description,
          source_type: args.source_type,
          source_id: args.source_id,
          voucher_type: voucherType,
          narration: args.description,
        },
        args.lines
      );
      return await this.journalRepo.post(tenantId, entry.id);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        const existing = await this.journalRepo.findBySource(
          tenantId,
          args.source_type,
          args.source_id
        );
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * Phase 5: Post the COGS leg for a finalized sale.
   *
   *   Dr  Cost of Goods Sold     (cogsAmount)
   *   Cr  Inventory Asset        (cogsAmount)
   *
   * Distinct from the revenue JE (source_type='sale') — this one uses
   * source_type='cogs' and the same source_id so reversal on delete can
   * find it cleanly. Idempotent via the partial unique index.
   */
  async generateJournalEntryFromCogs(
    tenantId: string,
    userId: string | null,
    invoiceId: string,
    cogsAmount: number,
    entryDate?: string
  ): Promise<JournalEntry | null> {
    if (cogsAmount <= 0.01) return null;

    const existing = await this.findExistingPostedEntry(tenantId, 'cogs', invoiceId);
    if (existing) return existing;

    const defaults = await this.getDefaultAccountIds(tenantId);
    if (!defaults.cogs || !defaults.inventory_asset) {
      console.warn(
        `[accounting] Skipping COGS JE for invoice ${invoiceId}: cogs or inventory_asset role unmapped`
      );
      return null;
    }

    const lines: CreateJournalLineInput[] = [
      {
        account_id: defaults.cogs,
        debit: cogsAmount,
        credit: 0,
        description: 'Cost of goods sold',
      },
      {
        account_id: defaults.inventory_asset,
        debit: 0,
        credit: cogsAmount,
        description: 'Inventory consumed',
      },
    ];

    return this.createAndPost(tenantId, userId, {
      entry_date: entryDate ?? new Date().toISOString().split('T')[0],
      description: 'COGS for sale',
      source_type: 'cogs',
      source_id: invoiceId,
      lines,
    });
  }

  /**
   * Phase 5: Convenience predicate. Per-tenant feature flag stored at
   * tenants.settings.modules.accounting.cogs_enabled (boolean). When off
   * (default), COGS is skipped entirely and the system behaves as
   * pre-Phase-5.
   */
  async isCogsEnabled(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();
    if (error || !data) return false;
    const settings = (data.settings ?? {}) as Record<string, any>;
    return Boolean(settings?.modules?.accounting?.cogs_enabled);
  }

  /**
   * Flip the COGS feature flag. Cutover semantics: enabling at time T
   * means sales finalized after T post COGS against any layers that
   * exist at that point. Pre-T sales are NOT retroactively COGS'd —
   * historical revenue and inventory remain as they were posted.
   */
  async setCogsEnabled(tenantId: string, enabled: boolean): Promise<void> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw error;

    const settings = ((data?.settings as Record<string, any>) ?? {});
    settings.modules = settings.modules ?? {};
    // Coerce legacy boolean shape to object before writing cogs_enabled
    // (see isEnabled() for the dual-schema notes).
    if (typeof settings.modules.accounting !== 'object' || settings.modules.accounting === null) {
      const wasEnabled = settings.modules.accounting === true;
      settings.modules.accounting = { enabled: wasEnabled };
    }
    settings.modules.accounting.cogs_enabled = enabled;

    const { error: uErr } = await this.supabase
      .from('tenants')
      .update({ settings } as any)
      .eq('id', tenantId);
    if (uErr) throw uErr;
  }

  // ==================== Day Book (Phase 6) ====================

  /**
   * Day Book: every posted journal entry in a date range, with per-entry
   * debit/credit totals. This is the centre-piece daily view in Tally —
   * the accountant reviews what happened across all voucher types in
   * chronological order.
   */
  async generateDayBook(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<DayBookReport> {
    const { data, error } = await this.supabase
      .from('journal_entries')
      .select('id, entry_number, entry_date, description, source_type, source_id, is_posted, journal_lines(debit, credit)')
      .eq('tenant_id', tenantId)
      .eq('is_posted', true)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: true })
      .order('entry_number', { ascending: true });

    if (error) throw error;

    type Row = {
      id: string;
      entry_number: string;
      entry_date: string;
      description: string | null;
      source_type: string | null;
      source_id: string | null;
      is_posted: boolean | null;
      journal_lines: { debit: number | null; credit: number | null }[];
    };

    const entries: DayBookEntry[] = ((data ?? []) as unknown as Row[]).map((row) => {
      const debit = (row.journal_lines ?? []).reduce(
        (s, l) => s + Number(l.debit ?? 0),
        0
      );
      const credit = (row.journal_lines ?? []).reduce(
        (s, l) => s + Number(l.credit ?? 0),
        0
      );
      return {
        entry_id: row.id,
        entry_number: row.entry_number,
        entry_date: row.entry_date,
        description: row.description,
        source_type: row.source_type,
        source_id: row.source_id,
        total_debit: debit,
        total_credit: credit,
        is_posted: row.is_posted ?? false,
      };
    });

    const totalDebit = entries.reduce((s, e) => s + e.total_debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.total_credit, 0);

    return {
      start_date: startDate,
      end_date: endDate,
      entries,
      total_debit: totalDebit,
      total_credit: totalCredit,
      count: entries.length,
    };
  }

  // ==================== Daily Journal (simple owner view) ====================

  /**
   * Daily Journal: a deliberately simple, read-only snapshot of a single
   * day's money movement for owners/managers — NOT the double-entry day book.
   *
   * For the chosen date it returns the day's final sales, final purchases and
   * expenses (each a total plus a compact line list), a few headline KPIs, and
   * the *current* cash & bank balances (live stored ledger balances, not
   * as-of-date). Cash = the tenant's `cash_in_hand` default ledger; bank = the
   * sum of all bank-account ledgers.
   */
  async generateDailyJournal(
    tenantId: string,
    date: string
  ): Promise<DailyJournalReport> {
    // --- Sales & purchases: final invoices dated on `date` ---
    const { data: invoiceRows, error: invErr } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, type, total, party_id, invoice_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'final')
      .eq('invoice_date', date)
      .is('returned_from_id', null);
    if (invErr) throw invErr;

    const invoices = (invoiceRows ?? []) as Array<{
      id: string;
      invoice_number: string;
      type: 'sale' | 'purchase';
      total: number | null;
      party_id: string | null;
      invoice_date: string;
    }>;

    // --- Payments dated on `date` (fetched early so its party_ids can join the shared lookup) ---
    const { data: paymentRows, error: payErr } = await this.supabase
      .from('payments')
      .select('id, type, amount, party_id, bank_account_id, payment_date')
      .eq('tenant_id', tenantId)
      .eq('payment_date', date);
    if (payErr) throw payErr;

    const payments = (paymentRows ?? []) as unknown as Array<{
      id: string;
      type: 'received' | 'made';
      amount: number | null;
      party_id: string | null;
      bank_account_id: string | null;
    }>;

    // Attach party names in one round-trip (invoices + payments share this lookup).
    const partyIds = Array.from(
      new Set(
        [...invoices.map((i) => i.party_id), ...payments.map((p) => p.party_id)].filter(
          (x): x is string => !!x
        )
      )
    );
    const partyMap = new Map<string, string>();
    if (partyIds.length > 0) {
      const { data: parties, error: pErr } = await this.supabase
        .from('parties')
        .select('id, name')
        .in('id', partyIds);
      if (pErr) throw pErr;
      for (const p of parties ?? []) partyMap.set(p.id, p.name);
    }

    // Bank names for the payment method label ('Cash' when bank_account_id is null).
    const paymentBankIds = Array.from(
      new Set(payments.map((p) => p.bank_account_id).filter((x): x is string => !!x))
    );
    const paymentBankNameMap = new Map<string, string>();
    if (paymentBankIds.length > 0) {
      const { data: paymentBanks, error: pbErr } = await this.supabase
        .from('bank_accounts' as any)
        .select('id, name')
        .in('id', paymentBankIds);
      if (pbErr) throw pbErr;
      for (const b of ((paymentBanks as unknown) as Array<{ id: string; name: string }>) ?? []) {
        paymentBankNameMap.set(b.id, b.name);
      }
    }

    const buildPaymentSection = (type: 'received' | 'made'): DailyJournalPaymentSection => {
      const items = payments
        .filter((p) => p.type === type)
        .map((p) => ({
          id: p.id,
          party: p.party_id ? partyMap.get(p.party_id) ?? null : null,
          method: p.bank_account_id ? paymentBankNameMap.get(p.bank_account_id) ?? 'Bank' : 'Cash',
          amount: Number(p.amount ?? 0),
        }));
      const total = items.reduce((s, i) => s + i.amount, 0);
      return { total, items };
    };

    const paymentsReceived = buildPaymentSection('received');
    const paymentsMade = buildPaymentSection('made');

    const buildInvoiceSection = (type: 'sale' | 'purchase'): DailyJournalSection => {
      const items = invoices
        .filter((i) => i.type === type)
        .map((i) => ({
          id: i.id,
          number: i.invoice_number,
          party: i.party_id ? partyMap.get(i.party_id) ?? null : null,
          amount: Number(i.total ?? 0),
        }));
      const total = items.reduce((s, i) => s + i.amount, 0);
      return { total, items };
    };

    const sales = buildInvoiceSection('sale');
    const purchases = buildInvoiceSection('purchase');

    // --- Expenses dated on `date` ---
    const { data: expenseRows, error: expErr } = await this.supabase
      .from('expenses')
      .select('id, category, description, amount, expense_date')
      .eq('tenant_id', tenantId)
      .eq('expense_date', date);
    if (expErr) throw expErr;

    const expenseItems = ((expenseRows ?? []) as Array<{
      id: string;
      category: string | null;
      description: string | null;
      amount: number | null;
    }>).map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: Number(e.amount ?? 0),
    }));
    const expensesTotal = expenseItems.reduce((s, e) => s + e.amount, 0);
    const expenses: DailyJournalExpenseSection = {
      total: expensesTotal,
      items: expenseItems,
    };

    // --- Current cash & bank balances (live stored ledger balances) ---
    const defaults = await this.getDefaultAccountIds(tenantId);
    let cash = 0;
    const cashAccountId = defaults.cash_in_hand;
    if (cashAccountId) {
      const { data: cashAcc, error: cErr } = await this.supabase
        .from('accounts')
        .select('balance')
        .eq('tenant_id', tenantId)
        .eq('id', cashAccountId)
        .maybeSingle();
      if (cErr) throw cErr;
      cash = Number(cashAcc?.balance ?? 0);
    }

    let bank = 0;
    const banksBreakdown: Array<{ id: string; name: string; balance: number }> = [];
    const { data: bankAccounts, error: bErr } = await this.supabase
      .from('bank_accounts' as any)
      .select('id, name, ledger_account_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (bErr) throw bErr;
    const bankAccountRows = (bankAccounts as unknown) as Array<{
      id: string;
      name: string;
      ledger_account_id: string;
    }>;
    const bankLedgerIds = bankAccountRows.map((b) => b.ledger_account_id).filter(Boolean);
    if (bankLedgerIds.length > 0) {
      const { data: bankLedgers, error: blErr } = await this.supabase
        .from('accounts')
        .select('id, balance')
        .in('id', bankLedgerIds);
      if (blErr) throw blErr;
      const ledgerBalanceMap = new Map(
        (bankLedgers ?? []).map((l) => [l.id, Number(l.balance ?? 0)])
      );
      for (const b of bankAccountRows) {
        const balance = ledgerBalanceMap.get(b.ledger_account_id) ?? 0;
        banksBreakdown.push({ id: b.id, name: b.name, balance });
        bank += balance;
      }
    }

    const kpis = {
      totalSales: sales.total,
      totalPurchases: purchases.total,
      totalExpenses: expenses.total,
      netCashFlow: sales.total - purchases.total - expenses.total,
    };

    return {
      date,
      sales,
      purchases,
      expenses,
      payments: { received: paymentsReceived, made: paymentsMade },
      kpis,
      balances: { cash, bank, banks: banksBreakdown, totalLiquid: cash + bank },
    };
  }

  // ==================== Per-User Daily Summary ====================

  /**
   * Per-user, per-day (or range) breakdown of sales/purchases/payments/
   * expenses — NOT real shift tracking (no clock-in/out exists). Built
   * entirely from the created_by columns already present on invoices,
   * payments and expenses. Records with created_by IS NULL are bucketed
   * into an explicit "Unknown / System" row so totals reconcile with the
   * tenant-wide Daily Journal totals for the same range, instead of being
   * silently dropped.
   */
  async generateUserDailySummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<UserDailySummaryReport> {
    const rows = new Map<string, UserSummaryRow>();
    const getRow = (userId: string | null): UserSummaryRow => {
      const key = userId ?? UNKNOWN_USER_ID;
      let row = rows.get(key);
      if (!row) {
        row = emptyUserSummaryRow(key, key === UNKNOWN_USER_ID ? UNKNOWN_USER_NAME : key, true);
        rows.set(key, row);
      }
      return row;
    };

    const { data: invoiceRows, error: invErr } = await this.supabase
      .from('invoices')
      .select('id, type, total, created_by, invoice_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'final')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .is('returned_from_id', null);
    if (invErr) throw invErr;

    for (const inv of ((invoiceRows ?? []) as Array<{
      type: 'sale' | 'purchase';
      total: number | null;
      created_by: string | null;
    }>)) {
      const row = getRow(inv.created_by);
      const bucket = inv.type === 'sale' ? row.sales : row.purchases;
      bucket.count += 1;
      bucket.amount += Number(inv.total ?? 0);
    }

    const { data: paymentRows, error: payErr } = await this.supabase
      .from('payments')
      .select('id, type, amount, created_by, bank_account_id, payment_date')
      .eq('tenant_id', tenantId)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);
    if (payErr) throw payErr;

    const usedBankAccountIds = new Set<string>();
    for (const p of ((paymentRows ?? []) as unknown as Array<{
      type: 'received' | 'made';
      amount: number | null;
      created_by: string | null;
      bank_account_id: string | null;
    }>)) {
      const row = getRow(p.created_by);
      const section = p.type === 'received' ? row.paymentsReceived : row.paymentsMade;
      const amount = Number(p.amount ?? 0);
      if (p.bank_account_id) {
        section.bank.count += 1;
        section.bank.amount += amount;
        addToByBank(section.byBank, p.bank_account_id, amount);
        usedBankAccountIds.add(p.bank_account_id);
      } else {
        section.cash.count += 1;
        section.cash.amount += amount;
      }
    }

    // Bank names for labeling byBank keys.
    let banks: Array<{ id: string; name: string }> = [];
    if (usedBankAccountIds.size > 0) {
      const { data: bankAccounts, error: baErr } = await this.supabase
        .from('bank_accounts' as any)
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('id', Array.from(usedBankAccountIds));
      if (baErr) throw baErr;
      banks = ((bankAccounts as unknown) as Array<{ id: string; name: string }>) ?? [];
    }

    const { data: expenseRows, error: expErr } = await this.supabase
      .from('expenses')
      .select('id, amount, created_by, expense_date')
      .eq('tenant_id', tenantId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);
    if (expErr) throw expErr;

    for (const e of ((expenseRows ?? []) as Array<{
      amount: number | null;
      created_by: string | null;
    }>)) {
      const row = getRow(e.created_by);
      row.expenses.count += 1;
      row.expenses.amount += Number(e.amount ?? 0);
    }

    // Hydrate real user names/active flags in one round-trip.
    const userIds = Array.from(rows.keys()).filter((id) => id !== UNKNOWN_USER_ID);
    if (userIds.length > 0) {
      const { data: users, error: uErr } = await this.supabase
        .from('users')
        .select('id, full_name, email, is_active')
        .eq('tenant_id', tenantId)
        .in('id', userIds);
      if (uErr) throw uErr;
      for (const u of (users ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string;
        is_active: boolean | null;
      }>) {
        const row = rows.get(u.id);
        if (row) {
          row.userName = u.full_name || u.email;
          row.isActive = u.is_active ?? true;
        }
      }
    }

    for (const row of rows.values()) {
      row.net =
        row.sales.amount +
        row.paymentsReceived.cash.amount +
        row.paymentsReceived.bank.amount -
        row.purchases.amount -
        row.paymentsMade.cash.amount -
        row.paymentsMade.bank.amount -
        row.expenses.amount;
    }

    const sortedRows = Array.from(rows.values()).sort((a, b) => {
      if (a.userId === UNKNOWN_USER_ID) return 1;
      if (b.userId === UNKNOWN_USER_ID) return -1;
      return a.userName.localeCompare(b.userName);
    });

    const addByBankTotals = (target: Record<string, number>, source: UserSummaryByBank) => {
      for (const [bankAccountId, bucket] of Object.entries(source)) {
        target[bankAccountId] = (target[bankAccountId] ?? 0) + bucket.amount;
      }
    };

    const totals = sortedRows.reduce(
      (acc, row) => {
        acc.sales.count += row.sales.count;
        acc.sales.amount += row.sales.amount;
        acc.purchases.count += row.purchases.count;
        acc.purchases.amount += row.purchases.amount;
        acc.paymentsReceived.cash += row.paymentsReceived.cash.amount;
        acc.paymentsReceived.bank += row.paymentsReceived.bank.amount;
        addByBankTotals(acc.paymentsReceived.byBank, row.paymentsReceived.byBank);
        acc.paymentsMade.cash += row.paymentsMade.cash.amount;
        acc.paymentsMade.bank += row.paymentsMade.bank.amount;
        addByBankTotals(acc.paymentsMade.byBank, row.paymentsMade.byBank);
        acc.expenses.count += row.expenses.count;
        acc.expenses.amount += row.expenses.amount;
        acc.net += row.net;
        return acc;
      },
      {
        sales: { count: 0, amount: 0 },
        purchases: { count: 0, amount: 0 },
        paymentsReceived: { cash: 0, bank: 0, byBank: {} as Record<string, number> },
        paymentsMade: { cash: 0, bank: 0, byBank: {} as Record<string, number> },
        expenses: { count: 0, amount: 0 },
        net: 0,
      }
    );

    return { startDate, endDate, banks, rows: sortedRows, totals };
  }

  // ==================== Stock Summary (Phase 5) ====================

  /**
   * Phase 5: Tally Stock Summary. For each item with remaining FIFO
   * layers, sums qty_remaining and qty_remaining * unit_cost to give a
   * current valuation. Items with zero remaining qty (fully consumed)
   * are omitted.
   */
  async generateStockSummary(
    tenantId: string
  ): Promise<{
    items: Array<{
      item_id: string;
      item_name: string;
      sku: string | null;
      total_qty: number;
      total_value: number;
      avg_unit_cost: number;
    }>;
    grand_total_value: number;
  }> {
    const { data: layers, error } = await this.supabase
      .from('stock_valuation_layers' as any)
      .select('item_id, qty_remaining, unit_cost')
      .eq('tenant_id', tenantId)
      .gt('qty_remaining', 0);
    if (error) throw error;

    type LayerRow = { item_id: string; qty_remaining: number; unit_cost: number };
    const byItem = new Map<string, { qty: number; value: number }>();
    for (const l of ((layers as unknown) as LayerRow[]) ?? []) {
      const cur = byItem.get(l.item_id) ?? { qty: 0, value: 0 };
      cur.qty += Number(l.qty_remaining);
      cur.value += Number(l.qty_remaining) * Number(l.unit_cost);
      byItem.set(l.item_id, cur);
    }

    if (byItem.size === 0) {
      return { items: [], grand_total_value: 0 };
    }

    const itemIds = Array.from(byItem.keys());
    const { data: items, error: iErr } = await this.supabase
      .from('items')
      .select('id, name, sku')
      .in('id', itemIds);
    if (iErr) throw iErr;

    const itemMap = new Map((items ?? []).map((i) => [i.id, i]));

    let grand = 0;
    const rows = Array.from(byItem.entries())
      .map(([itemId, agg]) => {
        const item = itemMap.get(itemId);
        const totalValue = Math.round(agg.value * 100) / 100;
        grand += totalValue;
        return {
          item_id: itemId,
          item_name: item?.name ?? 'Unknown',
          sku: (item?.sku as string | null) ?? null,
          total_qty: agg.qty,
          total_value: totalValue,
          avg_unit_cost: agg.qty > 0 ? totalValue / agg.qty : 0,
        };
      })
      .sort((a, b) => b.total_value - a.total_value);

    return { items: rows, grand_total_value: grand };
  }

  // ==================== Aging (Phase 6) ====================

  /**
   * Aging report: outstanding receivables (customers) or payables
   * (suppliers) bucketed by age. Drives the Tally outstanding statements
   * accountants check daily for follow-up.
   *
   * Outstanding per invoice = invoice.total − Σ(payment_allocations).
   * Age = asOfDate − invoice.finalized_at (falls back to created_at).
   *
   * @param tenantId
   * @param asOfDate   Cutoff for both invoice eligibility and allocation totals.
   * @param partyType  'customer' for receivables, 'supplier' for payables.
   * @param buckets    Optional override. Defaults to 0-30 / 31-60 / 61-90 / 90+.
   */
  async generateAgingReport(
    tenantId: string,
    asOfDate: string,
    partyType: 'customer' | 'supplier',
    buckets?: { label: string; from: number; to: number | null }[]
  ): Promise<AgingReport> {
    const bucketDefs = buckets ?? DEFAULT_AGING_BUCKETS;

    // Pull all finalized invoices for parties of this type, up to as-of date.
    const { data: invoices, error: iErr } = await this.supabase
      .from('invoices')
      .select('id, party_id, total, finalized_at, created_at, returned_from_id, type')
      .eq('tenant_id', tenantId)
      .eq('status', 'final')
      .is('returned_from_id', null)
      .lte('finalized_at', asOfDate + 'T23:59:59');
    if (iErr) throw iErr;

    const eligibleInvoices = (invoices ?? []).filter((i) =>
      partyType === 'customer' ? i.type === 'sale' : i.type === 'purchase'
    );

    const invoiceIds = eligibleInvoices.map((i) => i.id);

    // Opening balances are not invoices, so they have to be pulled separately —
    // otherwise a tenant that migrated in balances but has not yet raised an
    // invoice would see an empty aging report.
    const { data: openingRows, error: obErr } = await this.supabase
      .from('parties')
      .select('id, name, type, opening_balance, opening_balance_date')
      .eq('tenant_id', tenantId)
      .eq('type', partyType)
      .neq('opening_balance', 0)
      .lte('opening_balance_date', asOfDate);
    if (obErr) throw obErr;

    const openingParties =
      ((openingRows as unknown) as {
        id: string;
        name: string;
        type: string;
        opening_balance: number;
        opening_balance_date: string;
      }[]) ?? [];

    if (invoiceIds.length === 0 && openingParties.length === 0) {
      return {
        as_of_date: asOfDate,
        bucket_definitions: bucketDefs.map((d) => ({ label: d.label, from: d.from, to: d.to })),
        parties: [],
        totals: { total_outstanding: 0, buckets: emptyBuckets(bucketDefs) },
      };
    }

    // Pull all matching parties so we can attach names/types
    const partyIds = Array.from(new Set(eligibleInvoices.map((i) => i.party_id).filter((x): x is string => !!x)));
    const partyMap = new Map<string, { id: string; name: string; type: string }>();
    if (partyIds.length > 0) {
      const { data: parties, error: pErr } = await this.supabase
        .from('parties')
        .select('id, name, type')
        .in('id', partyIds);
      if (pErr) throw pErr;
      for (const p of parties ?? []) partyMap.set(p.id, p);
    }
    // Opening-balance parties may have no invoices at all, so seed them too.
    for (const p of openingParties) {
      if (!partyMap.has(p.id)) partyMap.set(p.id, { id: p.id, name: p.name, type: p.type });
    }

    // Sum allocations up to asOfDate per invoice
    const allocMap = new Map<string, number>();
    if (invoiceIds.length > 0) {
      const { data: allocations, error: aErr } = await this.supabase
        .from('payment_allocations' as any)
        .select('invoice_id, amount, allocated_at')
        .in('invoice_id', invoiceIds)
        .lte('allocated_at', asOfDate + 'T23:59:59');
      if (aErr) throw aErr;

      for (const row of ((allocations as unknown) as { invoice_id: string; amount: number }[]) ?? []) {
        allocMap.set(row.invoice_id, (allocMap.get(row.invoice_id) ?? 0) + Number(row.amount));
      }
    }

    // Aggregate per party
    const partyRows = new Map<string, AgingPartyRow>();
    const asOf = new Date(asOfDate);
    const totals: AgingBucket[] = emptyBuckets(bucketDefs);
    let grandTotal = 0;

    for (const inv of eligibleInvoices) {
      if (!inv.party_id) continue;
      const allocated = allocMap.get(inv.id) ?? 0;
      const outstanding = Number(inv.total ?? 0) - allocated;
      if (outstanding <= 0.01) continue;

      const rawDate = inv.finalized_at ?? inv.created_at;
      const invDate = rawDate ? new Date(rawDate) : asOf;
      const daysOld = Math.max(0, Math.floor((asOf.getTime() - invDate.getTime()) / 86_400_000));
      const bucketIdx = bucketIndexFor(daysOld, bucketDefs);

      let row = partyRows.get(inv.party_id);
      if (!row) {
        const party = partyMap.get(inv.party_id);
        row = {
          party_id: inv.party_id,
          party_name: party?.name ?? 'Unknown',
          party_type: (party?.type as 'customer' | 'supplier') ?? partyType,
          total_outstanding: 0,
          buckets: emptyBuckets(bucketDefs),
        };
        partyRows.set(inv.party_id, row);
      }
      row.buckets[bucketIdx].amount += outstanding;
      row.total_outstanding += outstanding;
      totals[bucketIdx].amount += outstanding;
      grandTotal += outstanding;
    }

    // Fold opening balances into the same party rows, aged from their as-of
    // date. `opening_balance` is already signed in the natural direction for
    // this party type (the query filters on it), so no sign flip is needed.
    // Credit balances are skipped for the same reason over-allocated invoices
    // are: aging reports what is owed, not what is held.
    for (const p of openingParties) {
      const outstanding = Number(p.opening_balance ?? 0);
      if (outstanding <= 0.01) continue;

      const obDate = p.opening_balance_date ? new Date(p.opening_balance_date) : asOf;
      const daysOld = Math.max(0, Math.floor((asOf.getTime() - obDate.getTime()) / 86_400_000));
      const bucketIdx = bucketIndexFor(daysOld, bucketDefs);

      let row = partyRows.get(p.id);
      if (!row) {
        row = {
          party_id: p.id,
          party_name: p.name ?? 'Unknown',
          party_type: (p.type as 'customer' | 'supplier') ?? partyType,
          total_outstanding: 0,
          buckets: emptyBuckets(bucketDefs),
        };
        partyRows.set(p.id, row);
      }
      row.buckets[bucketIdx].amount += outstanding;
      row.total_outstanding += outstanding;
      totals[bucketIdx].amount += outstanding;
      grandTotal += outstanding;
    }

    const partyList = Array.from(partyRows.values()).sort(
      (a, b) => b.total_outstanding - a.total_outstanding
    );

    return {
      as_of_date: asOfDate,
      bucket_definitions: bucketDefs.map((d) => ({ label: d.label, from: d.from, to: d.to })),
      parties: partyList,
      totals: { total_outstanding: grandTotal, buckets: totals },
    };
  }
}
