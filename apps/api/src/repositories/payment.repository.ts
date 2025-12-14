/**
 * Payment Repository
 *
 * Handles data access for payments.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type {
  Payment,
  PaymentWithParty,
  PaymentWithRelations,
  PaymentType,
  PartyType,
} from '@erp/shared';

type PaymentRow = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

/**
 * Extended query options for payments
 */
export interface PaymentQueryOptions extends QueryOptions {
  type?: PaymentType;
  partyId?: string;
  partyType?: PartyType;
  invoiceId?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Repository for Payment entity
 */
export class PaymentRepository extends BaseRepository<'payments', PaymentRow, PaymentInsert, PaymentUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'payments');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Payments don't have is_active
  }

  /**
   * Find all payments with filters
   */
  async findAllWithFilters(options: PaymentQueryOptions): Promise<QueryResult<PaymentWithParty>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'payment_date',
      sort_order = 'desc',
      type,
      partyId,
      partyType,
      invoiceId,
      paymentMethod,
      search,
      dateFrom,
      dateTo,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('payments')
      .select(`
        *,
        party:parties(id, name, type, balance)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    if (partyId) {
      query = query.eq('party_id', partyId);
    }

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    if (search) {
      query = query.or(`reference.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (dateFrom) {
      query = query.gte('payment_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('payment_date', dateTo);
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

    // Filter by party type if specified (need to do this after query since it's a relation)
    let payments = (data || []).map(this.mapPaymentWithParty);
    if (partyType) {
      payments = payments.filter(p => p.party?.type === partyType);
    }

    return {
      data: payments,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find payment by ID with all relations
   */
  async findByIdWithRelations(tenantId: string, id: string): Promise<PaymentWithRelations | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        party:parties(id, name, type, email, phone, balance),
        invoice:invoices(id, invoice_number, total, status),
        creator:users!created_by(id, full_name, email)
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapPaymentWithRelations(data);
  }

  /**
   * Find payments by party
   */
  async findByParty(tenantId: string, partyId: string, limit: number = 10): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .order('payment_date', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapPayment);
  }

  /**
   * Find payments by invoice
   */
  async findByInvoice(tenantId: string, invoiceId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapPayment);
  }

  /**
   * Get payment totals by type for a date range
   */
  async getTotalsByDateRange(
    tenantId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{ received: number; made: number }> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('type, amount, exchange_rate')
      .eq('tenant_id', tenantId)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo);

    if (error) {
      throw error;
    }

    let received = 0;
    let made = 0;

    for (const payment of data || []) {
      const amount = Number(payment.amount) * Number(payment.exchange_rate);
      if (payment.type === 'received') {
        received += amount;
      } else {
        made += amount;
      }
    }

    return { received, made };
  }

  /**
   * Get payment totals by method for a date range
   */
  async getTotalsByMethod(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Record<string, { count: number; total: number }>> {
    let query = this.supabase
      .from('payments')
      .select('payment_method, amount, exchange_rate')
      .eq('tenant_id', tenantId);

    if (dateFrom) {
      query = query.gte('payment_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('payment_date', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const byMethod: Record<string, { count: number; total: number }> = {};

    for (const payment of data || []) {
      const method = payment.payment_method || 'other';
      const amount = Number(payment.amount) * Number(payment.exchange_rate);

      if (!byMethod[method]) {
        byMethod[method] = { count: 0, total: 0 };
      }

      byMethod[method].count++;
      byMethod[method].total += amount;
    }

    return byMethod;
  }

  /**
   * Generate payment reference number
   */
  async generateReference(tenantId: string, type: PaymentType): Promise<string> {
    const { data, error } = await this.supabase.rpc('generate_payment_reference', {
      p_tenant_id: tenantId,
      p_type: type,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create payment with auto-generated reference
   */
  async createWithReference(
    tenantId: string,
    data: Omit<PaymentInsert, 'tenant_id' | 'id'>
  ): Promise<Payment> {
    // Generate reference if not provided
    let reference = data.reference;
    if (!reference) {
      reference = await this.generateReference(tenantId, data.type);
    }

    const { data: created, error } = await this.supabase
      .from('payments')
      .insert({
        ...data,
        tenant_id: tenantId,
        reference,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapPayment(created);
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      paymentDate: 'payment_date',
      payment_date: 'payment_date',
      amount: 'amount',
      createdAt: 'created_at',
      created_at: 'created_at',
    };

    return fieldMap[sortBy] || 'payment_date';
  }

  private mapPayment = (row: PaymentRow): Payment => {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      partyId: row.party_id,
      type: row.type as PaymentType,
      amount: Number(row.amount),
      currency: row.currency,
      exchangeRate: Number(row.exchange_rate),
      paymentMethod: row.payment_method,
      reference: row.reference,
      invoiceId: row.invoice_id,
      notes: row.notes,
      paymentDate: row.payment_date,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  };

  private mapPaymentWithParty = (row: PaymentRow & {
    party: { id: string; name: string; type: string; balance: number } | null;
  }): PaymentWithParty => {
    return {
      ...this.mapPayment(row),
      party: row.party ? {
        id: row.party.id,
        name: row.party.name,
        type: row.party.type as PartyType,
        balance: Number(row.party.balance),
      } : {
        id: '',
        name: 'Unknown',
        type: 'customer' as PartyType,
        balance: 0,
      },
    };
  };

  private mapPaymentWithRelations = (row: PaymentRow & {
    party: { id: string; name: string; type: string; email: string | null; phone: string | null; balance: number } | null;
    invoice: { id: string; invoice_number: string; total: number; status: string } | null;
    creator: { id: string; full_name: string | null; email: string } | null;
  }): PaymentWithRelations => {
    return {
      ...this.mapPayment(row),
      party: row.party ? {
        id: row.party.id,
        name: row.party.name,
        type: row.party.type as PartyType,
        email: row.party.email,
        phone: row.party.phone,
        balance: Number(row.party.balance),
      } : {
        id: '',
        name: 'Unknown',
        type: 'customer' as PartyType,
        email: null,
        phone: null,
        balance: 0,
      },
      invoice: row.invoice ? {
        id: row.invoice.id,
        invoiceNumber: row.invoice.invoice_number,
        total: Number(row.invoice.total),
        status: row.invoice.status,
      } : null,
      creator: row.creator ? {
        id: row.creator.id,
        fullName: row.creator.full_name,
        email: row.creator.email,
      } : null,
    };
  };
}
