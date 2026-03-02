/**
 * Party Service
 *
 * Business logic for party (customer/supplier) management including validation,
 * balance calculations, and transaction history.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { PartyRepository } from '../repositories/party.repository';
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

/**
 * Service for Party business logic
 */
export class PartyService {
  private readonly partyRepository: PartyRepository;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ) {
    this.supabase = supabase;
    this.partyRepository = new PartyRepository(supabase);
    this.tenantId = tenantId;
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

    return this.mapRow(row);
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
      throw new PartyError('Failed to recalculate balance', 'RECALCULATE_FAILED', 500);
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

    return (data || []).map((row: any) => ({
      partyId: row.party_id,
      partyName: row.party_name,
      partyType: row.party_type,
      totalInvoiced: Number(row.total_invoiced || 0),
      totalPaid: Number(row.total_paid || 0),
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

    // Get opening balance (balance at dateFrom)
    const openingBalance = await this.getBalanceAtDate(params.partyId, dateFrom);

    // Get transactions (invoices and payments)
    const transactions = await this.getTransactions(params.partyId, dateFrom, dateTo);

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
  private async getBalanceAtDate(partyId: string, date: string): Promise<number> {
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

    return invoiceTotal - paymentTotal;
  }

  /**
   * Get transactions for a party in date range
   */
  private async getTransactions(
    partyId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<Omit<PartyTransaction, 'balance'>[]> {
    const transactions: Omit<PartyTransaction, 'balance'>[] = [];

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

    // Sort by date
    return transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
          .single();

        // Get last payment date
        const { data: lastPayment } = await this.supabase
          .from('payments')
          .select('payment_date')
          .eq('party_id', party.id)
          .order('payment_date', { ascending: false })
          .limit(1)
          .single();

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
      .ilike('email', email)
      .limit(1)
      .single();

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
  private mapRow(row: any): Party {
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
      isActive: row.is_active,
      notes: row.notes,
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
