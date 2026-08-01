/**
 * Party Service
 *
 * Business logic for party (customer/supplier) management including validation,
 * balance calculations, and transaction history.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { PartyRepository } from '../repositories/party.repository';
import { BaseRepository } from '../repositories/base.repository';
import { AccountingService } from './accounting.service';
import {
  naturalDirection,
  toSignedOpeningBalance,
} from '@erp/shared';
import type {
  Party,
  PartyWithSummary,
  PartyType,
  PartyQueryParams,
  CreatePartyInput,
  UpdatePartyInput,
  PartyBalanceSummary,
  PartyTransaction,
  PartyStatement,
  PartyStatementParams,
  CustomerBalanceReportParams,
  CustomerBalanceReportResponse,
  CustomerBalanceReportEntry,
} from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for party-related operations
 */
export class PartyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PartyError';
  }
}

/** DB row shape from the parties table */
interface PartyRow {
  id: string;
  tenant_id: string;
  type: PartyType;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  balance: number;
  is_active: boolean;
  notes: string | null;
  /** Optional until DB types are regenerated after migration 023 */
  ledger_account_id?: string | null;
  /** Optional until DB types are regenerated after migration 035 */
  opening_balance?: number | null;
  opening_balance_date?: string | null;
  created_at: string;
  updated_at: string;
}

/** RPC result from get_party_balance_summary */
interface BalanceSummaryRow {
  party_id: string;
  party_name: string;
  party_type: string;
  opening_balance: number;
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
}

/** A single debit/credit line of a journal entry */
interface JournalLineInput {
  account_id: string;
  debit: number;
  credit: number;
}

/** Amounts below this are treated as zero (DECIMAL(15,2) rounding noise) */
const OPENING_BALANCE_EPSILON = 0.005;

/** Today as a plain calendar date (YYYY-MM-DD) */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build the two journal lines for an opening balance adjustment.
 *
 * `delta` is signed in the party's natural direction, so it has to be flipped
 * for suppliers to work out which side of the ledger moves:
 *   customer, delta > 0 -> the party owes us more   -> debit the party ledger
 *   supplier, delta > 0 -> we owe the party more    -> credit the party ledger
 *
 * Exported for unit testing — it is pure and covers all four sign/type cases.
 */
export function buildOpeningBalanceLines(
  type: PartyType,
  delta: number,
  partyLedgerAccountId: string,
  equityAccountId: string
): JournalLineInput[] {
  const amount = Math.round(Math.abs(delta) * 100) / 100;
  const debitsPartyLedger = (type === 'customer' ? delta : -delta) > 0;

  return debitsPartyLedger
    ? [
        { account_id: partyLedgerAccountId, debit: amount, credit: 0 },
        { account_id: equityAccountId, debit: 0, credit: amount },
      ]
    : [
        { account_id: equityAccountId, debit: amount, credit: 0 },
        { account_id: partyLedgerAccountId, debit: 0, credit: amount },
      ];
}

/**
 * Service for Party business logic
 */
export class PartyService {
  private readonly partyRepository: PartyRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;
  /** Attributed as the author of any journal entry this service posts */
  private readonly userId: string | null;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    userId: string | null = null
  ) {
    this.supabase = supabase;
    this.partyRepository = new PartyRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
    this.userId = userId;
  }

  // ==========================================================================
  // PARTY CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of parties with filters
   */
  async getParties(params: PartyQueryParams): Promise<QueryResult<Party>> {
    return this.partyRepository.findAllWithFilters({
      tenantId: this.tenantId,
      page: params.page,
      limit: params.limit,
      sort_by: this.mapSortField(params.sortBy),
      sort_order: params.sortDir,
      type: params.type,
      search: params.search,
      isActive: params.isActive,
      hasBalance: params.hasBalance,
    });
  }

  /**
   * Get a single party by ID
   */
  async getParty(id: string): Promise<PartyWithSummary> {
    const party = await this.partyRepository.findByIdWithSummary(this.tenantId, id);

    if (!party) {
      throw new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    return party;
  }

  /**
   * Create a new party
   */
  async createParty(input: CreatePartyInput): Promise<Party> {
    // Validate email uniqueness if provided
    if (input.email) {
      await this.validateEmailUniqueness(input.email, input.type);
    }

    const partyData = {
      type: input.type,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      tax_number: input.taxNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      balance: 0,
      is_active: true,
    };

    const row = await this.partyRepository.create(this.tenantId, partyData);

    // Phase 4: auto-create the party's dedicated ledger under Sundry
    // Debtors (customer) / Sundry Creditors (supplier). Silently no-ops
    // when accounting is disabled for the tenant.
    try {
      await this.accountingService.ensurePartyLedger(
        this.tenantId,
        row.id,
        input.type
      );
    } catch (error) {
      console.error(
        `[party] Failed to auto-create ledger for party ${row.id}:`,
        error
      );
    }

    // Opening balance is applied after the ledger exists, so the journal entry
    // has somewhere to post to. The row is inserted with balance 0 and the RPC
    // moves it, keeping create and edit on one code path.
    if (input.openingBalance) {
      const signed = toSignedOpeningBalance(
        input.type,
        input.openingBalance,
        input.openingBalanceDirection ?? naturalDirection(input.type)
      );
      const asOfDate = input.openingBalanceDate ?? todayIso();
      const delta = await this.applyOpeningBalance(row.id, signed, asOfDate);
      await this.postOpeningBalanceJournalEntry(row.id, input.name.trim(), input.type, delta, asOfDate);

      // Reflect what the RPC just wrote, rather than re-reading the row.
      // (These columns are absent from the pre-035 generated types.)
      const openingRow = row as unknown as PartyRow;
      openingRow.opening_balance = signed;
      openingRow.opening_balance_date = signed === 0 ? null : asOfDate;
      openingRow.balance = Number(row.balance ?? 0) + delta;
    }

    return this.mapRow(row);
  }

  /**
   * Update an existing party
   */
  async updateParty(id: string, input: UpdatePartyInput): Promise<Party> {
    // Check if party exists
    const existing = await this.partyRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    // Validate email uniqueness if changed
    if (input.email !== undefined && input.email !== existing.email) {
      await this.validateEmailUniqueness(input.email, existing.type as PartyType, id);
    }

    const updates: Partial<typeof existing> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.email !== undefined) updates.email = input.email?.trim() || null;
    if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
    if (input.address !== undefined) updates.address = input.address?.trim() || null;
    if (input.taxNumber !== undefined) updates.tax_number = input.taxNumber?.trim() || null;
    if (input.isActive !== undefined) updates.is_active = input.isActive;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;

    const row = await this.partyRepository.update(this.tenantId, id, updates);

    if (!row) {
      throw new PartyError('Failed to update party', 'UPDATE_FAILED', 500);
    }

    // Phase 4: keep the linked ledger's name in sync on party rename.
    // Also ensure a ledger exists for parties created pre-P4 (lazy
    // backfill — first edit after migration triggers creation).
    if (input.name !== undefined) {
      try {
        await this.accountingService.syncPartyLedgerName(
          this.tenantId,
          id,
          input.name.trim()
        );
      } catch (error) {
        console.error(
          `[party] Failed to sync ledger name for ${id}:`,
          error
        );
      }
    }
    try {
      await this.accountingService.ensurePartyLedger(
        this.tenantId,
        id,
        existing.type as PartyType
      );
    } catch (error) {
      console.error(
        `[party] Failed to ensure ledger for ${id}:`,
        error
      );
    }

    // Opening balance never goes through `updates` — the RPC owns those columns
    // so it can adjust the running balance by the delta atomically.
    const wantsOpeningBalanceChange =
      input.openingBalance !== undefined ||
      input.openingBalanceDirection !== undefined ||
      input.openingBalanceDate !== undefined;

    if (wantsOpeningBalanceChange) {
      const partyType = existing.type as PartyType;
      const signed = toSignedOpeningBalance(
        partyType,
        input.openingBalance ?? 0,
        input.openingBalanceDirection ?? naturalDirection(partyType)
      );
      const asOfDate = input.openingBalanceDate ?? todayIso();
      const delta = await this.applyOpeningBalance(id, signed, asOfDate);

      // A date-only edit yields a zero delta: the reporting position of the
      // opening balance moves, but its value — and therefore the GL — does not.
      if (Math.abs(delta) > OPENING_BALANCE_EPSILON) {
        await this.postOpeningBalanceJournalEntry(
          id,
          row.name,
          partyType,
          delta,
          asOfDate
        );
      }

      // The row returned by the update above predates the RPC, so re-read it.
      const refreshed = await this.partyRepository.findById(this.tenantId, id);
      if (refreshed) {
        return this.mapRow(refreshed as unknown as PartyRow);
      }
    }

    return this.mapRow(row);
  }

  // ==========================================================================
  // OPENING BALANCE
  // ==========================================================================

  /**
   * Persist a new opening balance and fold the difference into the running
   * balance. Returns the delta applied, which drives the adjusting journal
   * entry. Failures propagate — an unrecorded balance change is not something
   * to swallow.
   */
  private async applyOpeningBalance(
    partyId: string,
    signedAmount: number,
    asOfDate: string
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'set_party_opening_balance' as never,
      {
        p_tenant_id: this.tenantId,
        p_party_id: partyId,
        p_amount: signedAmount,
        p_date: signedAmount === 0 ? null : asOfDate,
      } as never
    );

    if (error) {
      throw new PartyError(
        `Failed to set opening balance: ${error.message}`,
        'OPENING_BALANCE_FAILED',
        500
      );
    }

    return Number(data ?? 0);
  }

  /**
   * Post an adjusting journal entry for an opening balance change, against the
   * party's own ledger and Opening Balance Equity (3200).
   *
   * Edits post the *delta* rather than reversing and re-posting, mirroring
   * `OpeningStockService.setOpeningStock`. That also sidesteps
   * `uq_journal_entries_source_posted`: a fixed source_type/source_id pair would
   * let the first edit post and then collide on every subsequent one, so these
   * entries go in as plain manual vouchers and are traced via the per-party
   * ledger account plus the description.
   *
   * Never throws — a misconfigured chart of accounts must not block saving a
   * party, which is how every other accounting hook in this codebase behaves.
   */
  private async postOpeningBalanceJournalEntry(
    partyId: string,
    partyName: string,
    type: PartyType,
    delta: number,
    asOfDate: string
  ): Promise<string | null> {
    if (Math.abs(delta) <= OPENING_BALANCE_EPSILON) return null;

    try {
      if (!(await this.accountingService.isEnabled(this.tenantId))) return null;

      const ledgerAccountId = await this.accountingService.ensurePartyLedger(
        this.tenantId,
        partyId,
        type
      );
      if (!ledgerAccountId) {
        console.warn(
          `[party] Opening balance JE skipped for ${partyId}: no ledger account ` +
            `(is accounts_${type === 'customer' ? 'receivable' : 'payable'} mapped?)`
        );
        return null;
      }

      const equityAccountId =
        await this.accountingService.getOrCreateOpeningBalanceEquityAccount(
          this.tenantId
        );

      const entry = await this.accountingService.createJournalEntry(
        this.tenantId,
        this.userId ?? 'system',
        {
          entry_date: asOfDate,
          description: `Opening balance — ${partyName} (${asOfDate})`,
          lines: buildOpeningBalanceLines(type, delta, ledgerAccountId, equityAccountId),
        }
      );

      await this.accountingService.postJournalEntry(this.tenantId, entry.id);
      return entry.id;
    } catch (error) {
      console.error(
        `[party] Failed to post opening balance JE for party ${partyId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a party (soft delete by setting is_active = false)
   */
  async deleteParty(id: string): Promise<void> {
    const existing = await this.partyRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    // Check if party has transactions
    const hasTransactions = await this.hasTransactions(id);
    if (hasTransactions) {
      throw new PartyError(
        'Cannot delete party with existing transactions. Deactivate instead.',
        'HAS_TRANSACTIONS',
        400
      );
    }

    const deleted = await this.partyRepository.delete(this.tenantId, id);
    if (!deleted) {
      throw new PartyError('Failed to delete party', 'DELETE_FAILED', 500);
    }
  }

  // ==========================================================================
  // BALANCE OPERATIONS
  // ==========================================================================

  /**
   * Get party balance
   */
  async getPartyBalance(id: string): Promise<number> {
    const party = await this.partyRepository.findById(this.tenantId, id);
    if (!party) {
      throw new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    return Number(party.balance || 0);
  }

  /**
   * Recalculate party balance from transactions
   */
  async recalculateBalance(id: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('recalculate_party_balance', {
      p_party_id: id,
    });

    if (error) {
      throw new PartyError(
        `Failed to recalculate balance: ${error.message || error.code || 'unknown'}`,
        'RECALCULATE_FAILED',
        500,
      );
    }

    return Number(data || 0);
  }

  /**
   * Get party balance summary for all parties of a type
   */
  async getBalanceSummary(partyType?: PartyType): Promise<PartyBalanceSummary[]> {
    const { data, error } = await this.supabase.rpc('get_party_balance_summary', {
      p_tenant_id: this.tenantId,
      p_party_type: partyType || null,
    });

    if (error) {
      throw new PartyError('Failed to get balance summary', 'SUMMARY_FAILED', 500);
    }

    return (data || []).map((row: BalanceSummaryRow) => ({
      partyId: row.party_id,
      partyName: row.party_name,
      partyType: row.party_type as PartyType,
      openingBalance: Number(row.opening_balance || 0),
      totalInvoiced: Number(row.total_invoiced || 0),
      totalPaid: Number(row.total_paid || 0),
      // The RPC column is current_balance; reading row.balance here previously
      // yielded undefined, so every summary reported a zero balance.
      currentBalance: Number(row.current_balance || 0),
    }));
  }

  // ==========================================================================
  // TRANSACTION HISTORY
  // ==========================================================================

  /**
   * Get party statement (transaction history)
   */
  async getPartyStatement(params: PartyStatementParams): Promise<PartyStatement> {
    const party = await this.partyRepository.findById(this.tenantId, params.partyId);
    if (!party) {
      throw new PartyError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    const dateFrom = params.dateFrom || '1900-01-01';
    const dateTo = params.dateTo || '2099-12-31';

    // The party carries its own opening balance, so pass the row we already
    // loaded down rather than re-querying it twice below.
    const partyRow = party as unknown as PartyRow;

    // Get opening balance (balance at dateFrom)
    const openingBalance = await this.getBalanceAtDate(params.partyId, dateFrom, partyRow);

    // Get transactions (invoices and payments)
    const transactions = await this.getTransactions(params.partyId, dateFrom, dateTo, partyRow);

    // Calculate running balance
    let runningBalance = openingBalance;
    const transactionsWithBalance = transactions.map((txn) => {
      runningBalance += txn.debit - txn.credit;
      return {
        ...txn,
        balance: runningBalance,
      };
    });

    const totalDebits = transactions.reduce((sum, txn) => sum + txn.debit, 0);
    const totalCredits = transactions.reduce((sum, txn) => sum + txn.credit, 0);

    return {
      party: this.mapRow(party),
      openingBalance,
      transactions: transactionsWithBalance,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get balance at a specific date
   */
  private async getBalanceAtDate(
    partyId: string,
    date: string,
    party: PartyRow
  ): Promise<number> {
    // Opening balance counts toward the brought-forward figure only when it
    // predates the window. Strict `<` matches the .lt() used for invoices and
    // payments below, so a balance dated exactly on `date` shows up as a
    // transaction row instead — counted once either way, never twice.
    const openingBalance = Number(party.opening_balance || 0);
    const openingBalanceDate = party.opening_balance_date ?? null;
    const openingApplies =
      openingBalance !== 0 && openingBalanceDate !== null && openingBalanceDate < date;

    // Get all invoices finalized before date
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('total, exchange_rate')
      .eq('tenant_id', this.tenantId)
      .eq('party_id', partyId)
      .eq('status', 'final')
      .lt('finalized_at', date);

    const invoiceTotal = (invoices || []).reduce(
      (sum, inv) => sum + Number(inv.total) * Number(inv.exchange_rate),
      0
    );

    // Get all payments before date
    const { data: payments } = await this.supabase
      .from('payments')
      .select('amount, exchange_rate')
      .eq('tenant_id', this.tenantId)
      .eq('party_id', partyId)
      .lt('created_at', date);

    const paymentTotal = (payments || []).reduce(
      (sum, pay) => sum + Number(pay.amount) * Number(pay.exchange_rate),
      0
    );

    return (openingApplies ? openingBalance : 0) + invoiceTotal - paymentTotal;
  }

  /**
   * Get transactions for a party in date range
   */
  private async getTransactions(
    partyId: string,
    dateFrom: string,
    dateTo: string,
    party: PartyRow
  ): Promise<Omit<PartyTransaction, 'balance'>[]> {
    const transactions: Omit<PartyTransaction, 'balance'>[] = [];

    // Opening balance, when it falls inside the window. debit/credit follow the
    // statement's own natural-direction convention (running balance is
    // debit - credit), so this needs no per-party-type branch.
    const openingBalance = Number(party.opening_balance || 0);
    const openingBalanceDate = party.opening_balance_date ?? null;
    if (
      openingBalance !== 0 &&
      openingBalanceDate !== null &&
      openingBalanceDate >= dateFrom &&
      openingBalanceDate <= dateTo
    ) {
      transactions.push({
        id: `opening-${partyId}`,
        type: 'opening',
        date: openingBalanceDate,
        reference: 'OB',
        description: 'Opening balance',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? -openingBalance : 0,
      });
    }

    // Get invoices
    const { data: invoices } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, total, exchange_rate, status, finalized_at')
      .eq('tenant_id', this.tenantId)
      .eq('party_id', partyId)
      .eq('status', 'final')
      .gte('finalized_at', dateFrom)
      .lte('finalized_at', dateTo)
      .order('finalized_at', { ascending: true });

    for (const invoice of invoices || []) {
      const amount = Number(invoice.total) * Number(invoice.exchange_rate);
      transactions.push({
        id: invoice.id,
        type: 'invoice',
        date: invoice.finalized_at || '',
        reference: invoice.invoice_number,
        description: `Invoice ${invoice.invoice_number}`,
        debit: amount,
        credit: 0,
      });
    }

    // Get payments
    const { data: payments } = await this.supabase
      .from('payments')
      .select('id, reference, amount, exchange_rate, payment_date, notes')
      .eq('tenant_id', this.tenantId)
      .eq('party_id', partyId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .order('payment_date', { ascending: true });

    for (const payment of payments || []) {
      const amount = Number(payment.amount) * Number(payment.exchange_rate);
      transactions.push({
        id: payment.id,
        type: 'payment',
        date: payment.payment_date,
        reference: payment.reference || 'N/A',
        description: payment.notes || 'Payment',
        debit: 0,
        credit: amount,
      });
    }

    // Sort by date, with the opening balance pinned ahead of same-day activity.
    // The tiebreaker matters because the opening date is a bare YYYY-MM-DD
    // (parsed as UTC midnight) while invoices carry a full timestamp.
    return transactions.sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) return byDate;
      return (a.type === 'opening' ? 0 : 1) - (b.type === 'opening' ? 0 : 1);
    });
  }

  // ==========================================================================
  // REPORTS
  // ==========================================================================

  /**
   * Get customer balance report
   */
  async getCustomerBalanceReport(
    params: CustomerBalanceReportParams
  ): Promise<CustomerBalanceReportResponse> {
    const queryParams: PartyQueryParams = {
      type: 'customer',
      isActive: !params.includeInactive,
      hasBalance: params.hasBalance,
      page: 1,
      limit: 1000, // Get all for report
    };

    const result = await this.getParties(queryParams);
    const parties = result.data;

    // Get detailed information for each customer
    const entries: CustomerBalanceReportEntry[] = await Promise.all(
      parties.map(async (party: Party) => {
        // Get last invoice date
        const { data: lastInvoice } = await this.supabase
          .from('invoices')
          .select('finalized_at')
          .eq('party_id', party.id)
          .eq('status', 'final')
          .order('finalized_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get last payment date
        const { data: lastPayment } = await this.supabase
          .from('payments')
          .select('payment_date')
          .eq('party_id', party.id)
          .order('payment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Calculate totals
        const { data: invoiceSum } = await this.supabase
          .from('invoices')
          .select('total, exchange_rate')
          .eq('party_id', party.id)
          .eq('status', 'final');

        const totalInvoiced = (invoiceSum || []).reduce(
          (sum, inv) => sum + Number(inv.total) * Number(inv.exchange_rate),
          0
        );

        const { data: paymentSum } = await this.supabase
          .from('payments')
          .select('amount, exchange_rate')
          .eq('party_id', party.id);

        const totalPaid = (paymentSum || []).reduce(
          (sum, pay) => sum + Number(pay.amount) * Number(pay.exchange_rate),
          0
        );

        return {
          id: party.id,
          name: party.name,
          email: party.email,
          phone: party.phone,
          isActive: party.isActive,
          totalInvoiced,
          totalPaid,
          balance: Number(party.balance),
          lastInvoiceDate: lastInvoice?.finalized_at || null,
          lastPaymentDate: lastPayment?.payment_date || null,
        };
      })
    );

    // Filter by balance range if specified
    let filteredEntries = entries;
    if (params.minBalance !== undefined) {
      filteredEntries = filteredEntries.filter((e) => e.balance >= params.minBalance!);
    }
    if (params.maxBalance !== undefined) {
      filteredEntries = filteredEntries.filter((e) => e.balance <= params.maxBalance!);
    }

    // Calculate summary
    const totalReceivable = filteredEntries
      .filter((e) => e.balance > 0)
      .reduce((sum, e) => sum + e.balance, 0);

    const totalOverpaid = Math.abs(
      filteredEntries
        .filter((e) => e.balance < 0)
        .reduce((sum, e) => sum + e.balance, 0)
    );

    const summary = {
      totalCustomers: filteredEntries.length,
      totalReceivable,
      totalOverpaid,
      netReceivable: totalReceivable - totalOverpaid,
    };

    return {
      entries: filteredEntries,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Check if party has any transactions
   */
  private async hasTransactions(partyId: string): Promise<boolean> {
    const { count: invoiceCount } = await this.supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('party_id', partyId)
      .limit(1);

    const { count: paymentCount } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('party_id', partyId)
      .limit(1);

    return (invoiceCount || 0) > 0 || (paymentCount || 0) > 0;
  }

  /**
   * Validate email uniqueness
   */
  private async validateEmailUniqueness(
    email: string | null,
    type: PartyType,
    excludeId?: string
  ): Promise<void> {
    if (!email) return;

    const { data } = await this.supabase
      .from('parties')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('type', type)
      .ilike('email', BaseRepository.escapeILike(email))
      .limit(1)
      .maybeSingle();

    if (data && data.id !== excludeId) {
      throw new PartyError(
        `A ${type} with this email already exists`,
        'EMAIL_DUPLICATE',
        400
      );
    }
  }

  /**
   * Map a DB row to the camelCase Party type
   */
  private mapRow(row: PartyRow): Party {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      taxNumber: row.tax_number,
      balance: Number(row.balance || 0),
      openingBalance: Number(row.opening_balance || 0),
      openingBalanceDate: row.opening_balance_date ?? null,
      // ^ falls back to zero/null on rows from a pre-migration-035 DB.
      isActive: row.is_active,
      notes: row.notes,
      ledgerAccountId: row.ledger_account_id ?? null,
      // ^ Phase 4 — falls back to null on rows from a pre-migration-023 DB.
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map sort field from API to database column
   */
  private mapSortField(field?: string): string {
    const mapping: Record<string, string> = {
      name: 'name',
      balance: 'balance',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    return mapping[field || 'name'] || 'name';
  }
}
