/**
 * Invoice Repository
 *
 * Handles data access for invoices and invoice items.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';
import type {
  Invoice,
  InvoiceWithParty,
  InvoiceWithRelations,
  InvoiceItem,
  InvoiceItemWithDetails,
  InvoiceType,
  InvoiceStatus,
} from '@erp/shared';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

type InvoiceItemRow = Database['public']['Tables']['invoice_items']['Row'];
type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert'];

/**
 * Extended query options for invoices
 */
export interface InvoiceQueryOptions extends QueryOptions {
  type?: InvoiceType;
  status?: InvoiceStatus | InvoiceStatus[];
  partyId?: string;
  warehouseId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Repository for Invoice entity
 */
export class InvoiceRepository extends BaseRepository<'invoices', InvoiceRow, InvoiceInsert, InvoiceUpdate> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'invoices');
  }

  protected hasIsActiveColumn(): boolean {
    return false; // Invoices don't have is_active, they have status
  }

  /**
   * Find all invoices with filters
   */
  async findAllWithFilters(options: InvoiceQueryOptions): Promise<QueryResult<InvoiceWithParty>> {
    const {
      tenantId,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      type,
      status,
      partyId,
      warehouseId,
      search,
      dateFrom,
      dateTo,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('invoices')
      .select(`
        *,
        party:parties(id, name, type, balance)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }

    if (partyId) {
      query = query.eq('party_id', partyId);
    }

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (search) {
      query = query.ilike('invoice_number', `%${BaseRepository.escapeILike(search)}%`);
    }

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00Z`);
    }

    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59Z`);
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

    const invoices = (data || []).map(this.mapInvoiceWithParty);

    return {
      data: invoices,
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Find invoice by ID with all relations
   */
  async findByIdWithRelations(tenantId: string, id: string): Promise<InvoiceWithRelations | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select(`
        *,
        party:parties(id, name, type, balance, email, phone, address),
        warehouse:warehouses(id, name),
        items:invoice_items(
          *,
          item:items(id, name, sku, barcode, unit_of_measure)
        ),
        returned_from:invoices!returned_from_id(*),
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

    return this.mapInvoiceWithRelations(data as any);
  }

  /**
   * Find invoice by invoice number
   */
  async findByNumber(tenantId: string, invoiceNumber: string): Promise<InvoiceRow | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('invoice_number', invoiceNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Generate next invoice number using database function
   */
  async generateInvoiceNumber(tenantId: string, type: InvoiceType): Promise<string> {
    const { data, error } = await this.supabase.rpc('generate_invoice_number', {
      p_tenant_id: tenantId,
      p_type: type,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Create invoice with items
   */
  async createWithItems(
    tenantId: string,
    invoice: Omit<InvoiceInsert, 'tenant_id' | 'id' | 'invoice_number'>,
    items: Omit<InvoiceItemInsert, 'tenant_id' | 'id' | 'invoice_id'>[]
  ): Promise<InvoiceWithRelations> {
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(tenantId, invoice.type);

    // Create invoice
    const { data: createdInvoice, error: invoiceError } = await this.supabase
      .from('invoices')
      .insert({
        ...invoice,
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
      })
      .select()
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    // Create invoice items
    if (items.length > 0) {
      const itemInserts = items.map((item, index) => ({
        ...item,
        tenant_id: tenantId,
        invoice_id: createdInvoice.id,
        sort_order: item.sort_order ?? index,
      }));

      const { error: itemsError } = await this.supabase
        .from('invoice_items')
        .insert(itemInserts);

      if (itemsError) {
        throw itemsError;
      }
    }

    // Return full invoice with relations
    const result = await this.findByIdWithRelations(tenantId, createdInvoice.id);
    if (!result) {
      throw new Error('Failed to retrieve created invoice');
    }

    return result;
  }

  /**
   * Update invoice fields and optionally replace items.
   * Status enforcement is the service's job; the repo trusts its caller.
   */
  async updateWithItems(
    tenantId: string,
    id: string,
    invoice: Partial<InvoiceUpdate>,
    items?: Omit<InvoiceItemInsert, 'tenant_id' | 'id' | 'invoice_id'>[]
  ): Promise<InvoiceWithRelations> {
    // Update invoice
    const { error: invoiceError } = await this.supabase
      .from('invoices')
      .update(invoice)
      .eq('tenant_id', tenantId)
      .eq('id', id);

    if (invoiceError) {
      throw invoiceError;
    }

    // Replace items if provided
    if (items !== undefined) {
      // Delete existing items
      const { error: deleteError } = await this.supabase
        .from('invoice_items')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('invoice_id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new items
      if (items.length > 0) {
        const itemInserts = items.map((item, index) => ({
          ...item,
          tenant_id: tenantId,
          invoice_id: id,
          sort_order: item.sort_order ?? index,
        }));

        const { error: itemsError } = await this.supabase
          .from('invoice_items')
          .insert(itemInserts);

        if (itemsError) {
          throw itemsError;
        }
      }
    }

    // Return full invoice with relations
    const result = await this.findByIdWithRelations(tenantId, id);
    if (!result) {
      throw new Error('Failed to retrieve updated invoice');
    }

    return result;
  }

  /**
   * Update invoice status
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: InvoiceStatus
  ): Promise<InvoiceRow> {
    const { data, error } = await this.supabase
      .from('invoices')
      .update({ status })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Get invoice items
   */
  async getItems(tenantId: string, invoiceId: string): Promise<InvoiceItemWithDetails[]> {
    const { data, error } = await this.supabase
      .from('invoice_items')
      .select(`
        *,
        item:items(id, name, sku, barcode, unit_of_measure)
      `)
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapInvoiceItemWithDetails);
  }

  /**
   * Get invoices by party
   */
  async findByParty(tenantId: string, partyId: string, limit: number = 10): Promise<Invoice[]> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('party_id', partyId)
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapInvoice);
  }

  /**
   * Get return invoices for an original invoice
   */
  async findReturns(tenantId: string, originalInvoiceId: string): Promise<Invoice[]> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('returned_from_id', originalInvoiceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapInvoice);
  }

  /**
   * Get total sales/purchases by status for a date range
   */
  async getStatsByDateRange(
    tenantId: string,
    type: InvoiceType,
    dateFrom: string,
    dateTo: string
  ): Promise<Record<InvoiceStatus, { count: number; total: number }>> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('status, total')
      .eq('tenant_id', tenantId)
      .eq('type', type)
      .gte('created_at', `${dateFrom}T00:00:00Z`)
      .lte('created_at', `${dateTo}T23:59:59Z`);

    if (error) {
      throw error;
    }

    const stats: Record<InvoiceStatus, { count: number; total: number }> = {
      draft: { count: 0, total: 0 },
      final: { count: 0, total: 0 },
      returned: { count: 0, total: 0 },
      canceled: { count: 0, total: 0 },
    };

    for (const row of data || []) {
      const status = row.status as InvoiceStatus;
      stats[status].count++;
      stats[status].total += Number(row.total);
    }

    return stats;
  }

  // ==========================================================================
  // MAPPERS
  // ==========================================================================

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      invoiceNumber: 'invoice_number',
      createdAt: 'created_at',
      finalizedAt: 'finalized_at',
      total: 'total',
      status: 'status',
      created_at: 'created_at',
    };

    return fieldMap[sortBy] || 'created_at';
  }

  private mapInvoice = (row: InvoiceRow): Invoice => {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      invoiceNumber: row.invoice_number,
      type: row.type as InvoiceType,
      status: row.status as InvoiceStatus,
      partyId: row.party_id,
      warehouseId: row.warehouse_id,
      subtotal: Number(row.subtotal),
      taxAmount: Number(row.tax_amount),
      discountAmount: Number(row.discount_amount),
      total: Number(row.total),
      currency: row.currency,
      exchangeRate: Number(row.exchange_rate),
      notes: row.notes,
      createdBy: row.created_by,
      returnedFromId: row.returned_from_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      finalizedAt: row.finalized_at,
    };
  };

  private mapInvoiceWithParty = (row: InvoiceRow & {
    party: { id: string; name: string; type: string; balance: number } | null;
  }): InvoiceWithParty => {
    return {
      ...this.mapInvoice(row),
      party: row.party ? {
        id: row.party.id,
        name: row.party.name,
        type: row.party.type as 'customer' | 'supplier',
        balance: Number(row.party.balance),
      } : null,
    };
  };

  private mapInvoiceWithRelations = (row: InvoiceRow & {
    party: { id: string; name: string; type: string; balance: number; email: string | null; phone: string | null; address: string | null } | null;
    warehouse: { id: string; name: string };
    items: Array<InvoiceItemRow & { item: { id: string; name: string; sku: string | null; barcode: string | null; unit_of_measure: string } }>;
    returned_from: InvoiceRow | null;
    creator: { id: string; full_name: string | null; email: string } | null;
  }): InvoiceWithRelations => {
    return {
      ...this.mapInvoice(row),
      party: row.party ? {
        id: row.party.id,
        name: row.party.name,
        type: row.party.type as 'customer' | 'supplier',
        balance: Number(row.party.balance),
        email: row.party.email,
        phone: row.party.phone,
        address: row.party.address,
      } : null,
      warehouse: {
        id: row.warehouse.id,
        name: row.warehouse.name,
      },
      items: (row.items || []).map(this.mapInvoiceItemWithDetails),
      returnedFrom: row.returned_from ? this.mapInvoice(row.returned_from) : null,
      creator: row.creator ? {
        id: row.creator.id,
        fullName: row.creator.full_name,
        email: row.creator.email,
      } : null,
    };
  };

  private mapInvoiceItem = (row: InvoiceItemRow): InvoiceItem => {
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      description: row.description,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      discountPercent: Number(row.discount_percent),
      taxRate: Number(row.tax_rate),
      lineTotal: Number(row.line_total),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    };
  };

  private mapInvoiceItemWithDetails = (row: InvoiceItemRow & {
    item: { id: string; name: string; sku: string | null; barcode: string | null; unit_of_measure: string };
  }): InvoiceItemWithDetails => {
    return {
      ...this.mapInvoiceItem(row),
      item: {
        id: row.item.id,
        name: row.item.name,
        sku: row.item.sku,
        barcode: row.item.barcode,
        unitOfMeasure: row.item.unit_of_measure,
      },
    };
  };
}
