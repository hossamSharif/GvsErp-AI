/**
 * Party Repository
 *
 * Handles data access for parties (customers and suppliers).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type {
  Party,
  PartyWithSummary,
  PartyType,
  PartyBalanceSummary,
} from '@erp/shared';

type PartyRow = Database['public']['Tables']['parties']['Row'];
type PartyInsert = Database['public']['Tables']['parties']['Insert'];
type PartyUpdate = Database['public']['Tables']['parties']['Update'];

/**
 * Extended query options for parties
 */
export interface PartyQueryOptions extends QueryOptions {
  type?: PartyType;
  search?: string;
  isActive?: boolean;
  hasBalance?: boolean;
}

/**
 * Repository for Party entity
 */
export class PartyRepository extends BaseRepository<'parties', PartyRow, PartyInsert, PartyUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'parties');
  }

  protected hasIsActiveColumn(): boolean {
    return true;
  }

  /**
   * Find all parties with filters
   */
  async findAllWithFilters(options: PartyQueryOptions): Promise<QueryResult<Party>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'name',
      sort_order = 'asc',
      type,
      search,
      isActive,
      hasBalance,
      includeInactive = false,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('parties')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      const s = BaseRepository.escapeILike(search);
      query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    } else if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (hasBalance === true) {
      query = query.neq('balance', 0);
    }

    // Map sort field
    const sortField = this.mapSortField(sort_by);

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sort_order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const parties = (data || []).map(this.mapParty);

    return {
      data: parties,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find party by ID with summary (transaction count, totals)
   */
  async findByIdWithSummary(tenantId: string, id: string): Promise<PartyWithSummary | null> {
    // Get party
    const { data: party, error } = await this.supabase
      .from('parties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    // Get invoice summary
    const { data: invoiceStats } = await this.supabase
      .from('invoices')
      .select('id, total, created_at')
      .eq('tenant_id', tenantId)
      .eq('party_id', id)
      .eq('status', 'final');

    // Get payment summary
    const { data: paymentStats } = await this.supabase
      .from('payments')
      .select('id, amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('party_id', id);

    const invoices = invoiceStats || [];
    const payments = paymentStats || [];

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);

    const allDates = [
      ...invoices.map(i => i.created_at),
      ...payments.map(p => p.created_at),
    ].filter(Boolean).sort().reverse();

    return {
      ...this.mapParty(party),
      totalInvoiced,
      totalPaid,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      lastTransactionAt: allDates[0] || null,
    };
  }

  /**
   * Find parties by type
   */
  async findByType(tenantId: string, type: PartyType): Promise<Party[]> {
    const { data, error } = await this.supabase
      .from('parties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', type)
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapParty);
  }

  /**
   * Find parties with non-zero balance
   */
  async findWithBalance(tenantId: string, type?: PartyType): Promise<Party[]> {
    let query = this.supabase
      .from('parties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .neq('balance', 0)
      .order('balance', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapParty);
  }

  /**
   * Search parties by name, email, or phone
   */
  async search(tenantId: string, query: string, type?: PartyType, limit: number = 10): Promise<Party[]> {
    let dbQuery = this.supabase
      .from('parties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .or(`name.ilike.%${BaseRepository.escapeILike(query)}%,email.ilike.%${BaseRepository.escapeILike(query)}%,phone.ilike.%${BaseRepository.escapeILike(query)}%`)
      .order('name')
      .limit(limit);

    if (type) {
      dbQuery = dbQuery.eq('type', type);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapParty);
  }

  /**
   * Update party balance
   */
  async updateBalance(tenantId: string, id: string, newBalance: number): Promise<Party | null> {
    const { data, error } = await this.supabase
      .from('parties')
      .update({ balance: newBalance })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapParty(data);
  }

  /**
   * Adjust party balance by amount (increment/decrement)
   *
   * Uses the adjust_party_balance RPC so the delta is applied in a single
   * statement. Reading the balance and writing back a total loses whatever the
   * invoice/payment triggers wrote in between.
   */
  async adjustBalance(tenantId: string, id: string, amount: number): Promise<Party | null> {
    // `as never` on the name: generated Database types predate migration 038.
    const { error } = await this.supabase.rpc('adjust_party_balance' as never, {
      p_tenant_id: tenantId,
      p_party_id: id,
      p_delta: amount,
    } as never);

    if (error) {
      // The RPC raises no_data_found when the party is missing for this tenant.
      if (error.code === 'P0002' || error.message?.includes('not found')) {
        return null;
      }
      throw error;
    }

    const row = await this.findById(tenantId, id);
    return row ? this.mapParty(row) : null;
  }

  /**
   * Get balance summary for all parties
   */
  async getBalanceSummary(tenantId: string, type?: PartyType): Promise<PartyBalanceSummary[]> {
    let query = this.supabase
      .from('parties')
      .select('id, name, type, balance, opening_balance')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .neq('balance', 0)
      .order('balance', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // opening_balance arrives via migration 035, which the generated types do
    // not know about yet — same workaround as ledger_account_id in mapParty.
    const rows = ((data as unknown) as {
      id: string;
      name: string;
      type: string;
      balance: number;
      opening_balance: number | null;
    }[]) ?? [];

    // Get totals from invoices and payments for each party
    const summaries: PartyBalanceSummary[] = [];

    for (const party of rows) {
      // Get invoice totals
      const { data: invoices } = await this.supabase
        .from('invoices')
        .select('total, exchange_rate')
        .eq('tenant_id', tenantId)
        .eq('party_id', party.id)
        .eq('status', 'final');

      const totalInvoiced = (invoices || []).reduce(
        (sum, inv) => sum + Number(inv.total) * Number(inv.exchange_rate),
        0
      );

      // Standalone return documents, which reduce the balance the same way a
      // payment does. Rows flipped to 'returned' in place are excluded: the
      // trigger already netted those and they have left totalInvoiced.
      const { data: returns } = await this.supabase
        .from('invoices')
        .select('total, exchange_rate')
        .eq('tenant_id', tenantId)
        .eq('party_id', party.id)
        .eq('status', 'returned')
        .not('returned_from_id', 'is', null);

      const totalReturned = (returns || []).reduce(
        (sum, inv) => sum + Number(inv.total) * Number(inv.exchange_rate),
        0
      );

      // Get payment totals
      const { data: payments } = await this.supabase
        .from('payments')
        .select('amount, exchange_rate')
        .eq('tenant_id', tenantId)
        .eq('party_id', party.id);

      const totalPaid = (payments || []).reduce(
        (sum, pay) => sum + Number(pay.amount) * Number(pay.exchange_rate),
        0
      );

      summaries.push({
        partyId: party.id,
        partyName: party.name,
        partyType: party.type as PartyType,
        openingBalance: Number(party.opening_balance || 0),
        totalInvoiced,
        totalReturned,
        totalPaid,
        currentBalance: Number(party.balance),
      });
    }

    return summaries;
  }

  /**
   * Check if party name exists for tenant
   */
  async nameExists(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from('parties')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .ilike('name', BaseRepository.escapeILike(name));

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return (count || 0) > 0;
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      name: 'name',
      balance: 'balance',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };

    return fieldMap[sortBy] || 'name';
  }

  private mapParty = (row: PartyRow): Party => {
    // Phase 4: ledger_account_id is added by migration 023 — older
    // generated types may not list it yet.
    const ledgerId = (row as unknown as { ledger_account_id?: string | null })
      .ledger_account_id ?? null;
    // Likewise for the opening balance columns added by migration 035.
    const openingRow = row as unknown as {
      opening_balance?: number | null;
      opening_balance_date?: string | null;
    };
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type as PartyType,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      taxNumber: row.tax_number,
      balance: Number(row.balance),
      openingBalance: Number(openingRow.opening_balance || 0),
      openingBalanceDate: openingRow.opening_balance_date ?? null,
      isActive: row.is_active,
      notes: row.notes,
      ledgerAccountId: ledgerId,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };
}
