/**
 * Invoice Service
 *
 * Business logic for invoice management including stock calculations,
 * finalization, returns, and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { InvoiceRepository, InvoiceQueryOptions } from '../repositories/invoice.repository';
import type {
  Invoice,
  InvoiceWithParty,
  InvoiceWithRelations,
  InvoiceType,
  InvoiceStatus,
  InvoiceQueryParams,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  FinalizeInvoiceInput,
  ReturnInvoiceInput,
  FinalizeInvoiceResult,
  ReturnInvoiceResult,
  SalesReportEntry,
  SalesReportSummary,
  SalesReportParams,
  SalesReportResponse,
  PurchaseReportEntry,
  PurchaseReportSummary,
  PurchaseReportParams,
  PurchaseReportResponse,
} from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for invoice-related operations
 */
export class InvoiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'InvoiceError';
  }
}

/**
 * Service for Invoice business logic
 */
export class InvoiceService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly supabase: SupabaseClient<Database>;
  private readonly tenantId: string;
  private readonly userId?: string;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    userId?: string
  ) {
    this.invoiceRepository = new InvoiceRepository(supabase);
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  // ==========================================================================
  // INVOICE CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of invoices with filters
   */
  async getInvoices(params: InvoiceQueryParams): Promise<QueryResult<InvoiceWithParty>> {
    return this.invoiceRepository.findAllWithFilters({
      tenantId: this.tenantId,
      page: params.page,
      limit: params.limit,
      sort_by: this.mapSortField(params.sortBy),
      sort_order: params.sortDir,
      type: params.type,
      status: params.status,
      partyId: params.partyId,
      warehouseId: params.warehouseId,
      search: params.search,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.invoiceRepository.findByIdWithRelations(this.tenantId, id);

    if (!invoice) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    return invoice;
  }

  /**
   * Get invoice by invoice number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const row = await this.invoiceRepository.findByNumber(this.tenantId, invoiceNumber);
    return row ? this.mapRowToInvoice(row) : null;
  }

  /**
   * Create a new invoice (draft status)
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithRelations> {
    // Validate warehouse exists
    await this.validateWarehouse(input.warehouseId);

    // Validate party if provided
    if (input.partyId) {
      await this.validateParty(input.partyId, input.type);
    }

    // Validate items exist
    await this.validateItems(input.items.map(i => i.itemId));

    // Map input to database format
    const invoiceData = {
      type: input.type,
      status: 'draft' as const,
      party_id: input.partyId || null,
      warehouse_id: input.warehouseId,
      currency: input.currency || 'USD',
      exchange_rate: input.exchangeRate || 1,
      discount_amount: input.discountAmount || 0,
      notes: input.notes || null,
      created_by: this.userId || null,
    };

    // Map items
    const items = input.items.map((item, index) => ({
      item_id: item.itemId,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent || 0,
      tax_rate: item.taxRate || 0,
      line_total: this.calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent || 0, item.taxRate || 0),
      sort_order: item.sortOrder ?? index,
    }));

    return this.invoiceRepository.createWithItems(this.tenantId, invoiceData, items);
  }

  /**
   * Update a draft invoice
   */
  async updateInvoice(id: string, input: UpdateInvoiceInput): Promise<InvoiceWithRelations> {
    // Check invoice exists and is draft
    const existing = await this.invoiceRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (existing.status !== 'draft') {
      throw new InvoiceError('Only draft invoices can be updated', 'INVOICE_NOT_DRAFT', 400);
    }

    // Validate warehouse if changing
    if (input.warehouseId) {
      await this.validateWarehouse(input.warehouseId);
    }

    // Validate party if changing
    if (input.partyId !== undefined && input.partyId !== null) {
      await this.validateParty(input.partyId, existing.type as InvoiceType);
    }

    // Map input to database format
    const updateData: Record<string, unknown> = {};
    if (input.partyId !== undefined) updateData.party_id = input.partyId;
    if (input.warehouseId !== undefined) updateData.warehouse_id = input.warehouseId;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.exchangeRate !== undefined) updateData.exchange_rate = input.exchangeRate;
    if (input.discountAmount !== undefined) updateData.discount_amount = input.discountAmount;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Map items if provided
    let items: Parameters<typeof this.invoiceRepository.updateWithItems>[3] | undefined;
    if (input.items) {
      // Validate items exist
      await this.validateItems(input.items.map(i => i.itemId));

      items = input.items.map((item, index) => ({
        item_id: item.itemId,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent || 0,
        tax_rate: item.taxRate || 0,
        line_total: this.calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent || 0, item.taxRate || 0),
        sort_order: item.sortOrder ?? index,
      }));
    }

    return this.invoiceRepository.updateWithItems(this.tenantId, id, updateData, items);
  }

  /**
   * Cancel a draft invoice
   */
  async cancelInvoice(id: string): Promise<Invoice> {
    const existing = await this.invoiceRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (existing.status !== 'draft') {
      throw new InvoiceError('Only draft invoices can be canceled', 'INVOICE_NOT_DRAFT', 400);
    }

    const updated = await this.invoiceRepository.updateStatus(this.tenantId, id, 'canceled');
    return this.mapRowToInvoice(updated);
  }

  // ==========================================================================
  // FINALIZATION
  // ==========================================================================

  /**
   * Finalize an invoice - apply stock movements and update party balance
   */
  async finalizeInvoice(id: string, input?: FinalizeInvoiceInput): Promise<FinalizeInvoiceResult> {
    // Get invoice with items
    const invoice = await this.invoiceRepository.findByIdWithRelations(this.tenantId, id);
    if (!invoice) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (invoice.status !== 'draft') {
      throw new InvoiceError('Only draft invoices can be finalized', 'INVOICE_NOT_DRAFT', 400);
    }

    if (invoice.items.length === 0) {
      throw new InvoiceError('Invoice must have at least one item', 'INVOICE_NO_ITEMS', 400);
    }

    // For sales, check stock availability
    if (invoice.type === 'sale') {
      await this.validateStockAvailability(invoice.warehouseId, invoice.items);
    }

    // Update notes if provided
    if (input?.notes) {
      await this.supabase
        .from('invoices')
        .update({ notes: input.notes })
        .eq('id', id);
    }

    // Apply stock movements
    const stockMovements = await this.applyStockMovements(invoice);

    // Read party balance before status flip (trigger_update_party_balance_on_invoice
    // will add the invoice total when status transitions to 'final').
    let previousBalance: number | undefined;
    if (invoice.partyId) {
      const { data: partyBefore } = await this.supabase
        .from('parties')
        .select('balance')
        .eq('id', invoice.partyId)
        .maybeSingle();
      previousBalance = partyBefore ? Number(partyBefore.balance) : undefined;
    }

    // Update invoice status to final (DB trigger updates party balance)
    await this.invoiceRepository.updateStatus(this.tenantId, id, 'final');

    // Re-read party balance after the trigger fires for the response payload
    let partyBalanceUpdate: FinalizeInvoiceResult['partyBalanceUpdate'];
    if (invoice.partyId && previousBalance !== undefined) {
      const { data: partyAfter } = await this.supabase
        .from('parties')
        .select('balance')
        .eq('id', invoice.partyId)
        .maybeSingle();
      const newBalance = partyAfter ? Number(partyAfter.balance) : previousBalance;
      partyBalanceUpdate = {
        partyId: invoice.partyId,
        previousBalance,
        newBalance,
        change: newBalance - previousBalance,
      };
    }

    // Get updated invoice
    const finalizedInvoice = await this.invoiceRepository.findByIdWithRelations(this.tenantId, id);

    return {
      invoice: finalizedInvoice!,
      stockMovements,
      partyBalanceUpdate,
    };
  }

  // ==========================================================================
  // RETURNS
  // ==========================================================================

  /**
   * Create a return invoice from a finalized invoice
   */
  async createReturn(originalInvoiceId: string, input: ReturnInvoiceInput): Promise<ReturnInvoiceResult> {
    // Get original invoice
    const original = await this.invoiceRepository.findByIdWithRelations(this.tenantId, originalInvoiceId);
    if (!original) {
      throw new InvoiceError('Original invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (original.status !== 'final') {
      throw new InvoiceError('Only finalized invoices can be returned', 'INVOICE_NOT_FINAL', 400);
    }

    // Validate return items
    const returnItems = input.items.map(ri => {
      const originalItem = original.items.find(i => i.id === ri.invoiceItemId);
      if (!originalItem) {
        throw new InvoiceError(
          `Item ${ri.invoiceItemId} not found in original invoice`,
          'RETURN_ITEM_NOT_FOUND',
          400
        );
      }

      if (ri.returnQuantity > originalItem.quantity) {
        throw new InvoiceError(
          `Return quantity (${ri.returnQuantity}) exceeds original quantity (${originalItem.quantity})`,
          'RETURN_QUANTITY_EXCEEDS',
          400
        );
      }

      return {
        originalItem,
        returnQuantity: ri.returnQuantity,
      };
    });

    // Create return invoice
    const warehouseId = input.warehouseId || original.warehouseId;
    const returnInvoiceData = {
      type: original.type,
      status: 'returned' as const,
      party_id: original.partyId,
      warehouse_id: warehouseId,
      currency: original.currency,
      exchange_rate: original.exchangeRate,
      discount_amount: 0,
      notes: input.notes || `Return for ${original.invoiceNumber}`,
      created_by: this.userId || null,
      returned_from_id: originalInvoiceId,
    };

    const returnInvoiceItems = returnItems.map((ri, index) => ({
      item_id: ri.originalItem.itemId,
      description: `Return: ${ri.originalItem.description || ri.originalItem.item.name}`,
      quantity: ri.returnQuantity,
      unit_price: ri.originalItem.unitPrice,
      discount_percent: ri.originalItem.discountPercent,
      tax_rate: ri.originalItem.taxRate,
      line_total: this.calculateLineTotal(
        ri.returnQuantity,
        ri.originalItem.unitPrice,
        ri.originalItem.discountPercent,
        ri.originalItem.taxRate
      ),
      sort_order: index,
    }));

    const returnInvoice = await this.invoiceRepository.createWithItems(
      this.tenantId,
      returnInvoiceData,
      returnInvoiceItems
    );

    // Reverse stock movements
    const stockMovements = await this.reverseStockMovements(returnInvoice, original.type);

    // Reverse party balance for the returned amount (supports partial returns).
    // The original invoice stays 'final'; the return is a separate 'returned' row
    // linked via returned_from_id. We must NOT flip the original's status to
    // 'returned' here, or the trigger_update_party_balance_on_invoice would
    // subtract the full original total (wrong for partial returns).
    if (original.partyId) {
      await this.updatePartyBalance(
        original.partyId,
        -returnInvoice.total,
        original.type
      );
    }

    // Get updated invoices
    const updatedOriginal = await this.invoiceRepository.findByIdWithRelations(this.tenantId, originalInvoiceId);
    const updatedReturn = await this.invoiceRepository.findByIdWithRelations(this.tenantId, returnInvoice.id);

    return {
      returnInvoice: updatedReturn!,
      originalInvoice: updatedOriginal!,
      stockMovements,
    };
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get sales report data
   */
  async getSalesReport(params: SalesReportParams): Promise<SalesReportResponse> {
    const queryOptions: InvoiceQueryOptions = {
      tenantId: this.tenantId,
      type: 'sale',
      page: 1,
      limit: 10000, // Max for reports
      sort_by: 'created_at',
      sort_order: 'desc',
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      partyId: params.partyId,
      warehouseId: params.warehouseId,
      status: params.status,
    };

    const result = await this.invoiceRepository.findAllWithFilters(queryOptions);

    const entries: SalesReportEntry[] = result.data.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt,
      partyName: invoice.party?.name || null,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      status: invoice.status,
      itemCount: 0, // Will be filled if needed
    }));

    let summary: SalesReportSummary | undefined;
    if (params.includeSummary !== false) {
      summary = {
        totalInvoices: entries.length,
        totalSubtotal: entries.reduce((sum, e) => sum + e.subtotal, 0),
        totalTax: entries.reduce((sum, e) => sum + e.taxAmount, 0),
        totalDiscount: entries.reduce((sum, e) => sum + e.discountAmount, 0),
        totalAmount: entries.reduce((sum, e) => sum + e.total, 0),
        byStatus: {
          draft: { count: 0, total: 0 },
          final: { count: 0, total: 0 },
          returned: { count: 0, total: 0 },
          canceled: { count: 0, total: 0 },
        },
      };

      for (const entry of entries) {
        summary.byStatus[entry.status].count++;
        summary.byStatus[entry.status].total += entry.total;
      }
    }

    return {
      entries,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get purchase report data
   */
  async getPurchaseReport(params: PurchaseReportParams): Promise<PurchaseReportResponse> {
    const queryOptions: InvoiceQueryOptions = {
      tenantId: this.tenantId,
      type: 'purchase',
      page: 1,
      limit: 10000, // Max for reports
      sort_by: 'created_at',
      sort_order: 'desc',
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      partyId: params.partyId,
      warehouseId: params.warehouseId,
      status: params.status,
    };

    const result = await this.invoiceRepository.findAllWithFilters(queryOptions);

    const entries: PurchaseReportEntry[] = result.data.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt,
      partyName: invoice.party?.name || null,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      status: invoice.status,
      itemCount: 0, // Will be filled if needed
    }));

    let summary: PurchaseReportSummary | undefined;
    if (params.includeSummary !== false) {
      summary = {
        totalInvoices: entries.length,
        totalSubtotal: entries.reduce((sum, e) => sum + e.subtotal, 0),
        totalTax: entries.reduce((sum, e) => sum + e.taxAmount, 0),
        totalDiscount: entries.reduce((sum, e) => sum + e.discountAmount, 0),
        totalAmount: entries.reduce((sum, e) => sum + e.total, 0),
        byStatus: {
          draft: { count: 0, total: 0 },
          final: { count: 0, total: 0 },
          returned: { count: 0, total: 0 },
          canceled: { count: 0, total: 0 },
        },
      };

      for (const entry of entries) {
        summary.byStatus[entry.status].count++;
        summary.byStatus[entry.status].total += entry.total;
      }
    }

    return {
      entries,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // STOCK OPERATIONS
  // ==========================================================================

  /**
   * Get stock availability for invoice items
   */
  async getStockAvailability(warehouseId: string, itemIds: string[]): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('item_id, quantity')
      .eq('tenant_id', this.tenantId)
      .eq('warehouse_id', warehouseId)
      .in('item_id', itemIds);

    if (error) {
      throw error;
    }

    const availability: Record<string, number> = {};
    for (const itemId of itemIds) {
      const inventory = (data || []).find(i => i.item_id === itemId);
      availability[itemId] = inventory ? Number(inventory.quantity) : 0;
    }

    return availability;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Calculate line total
   */
  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discountPercent: number,
    taxRate: number
  ): number {
    return Math.round(
      quantity * unitPrice * (1 - discountPercent / 100) * (1 + taxRate / 100) * 100
    ) / 100;
  }

  /**
   * Validate warehouse exists
   */
  private async validateWarehouse(warehouseId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('id', warehouseId)
      .single();

    if (error || !data) {
      throw new InvoiceError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 400);
    }
  }

  /**
   * Validate party exists and is correct type
   */
  private async validateParty(partyId: string, invoiceType: InvoiceType): Promise<void> {
    const { data, error } = await this.supabase
      .from('parties')
      .select('id, type')
      .eq('tenant_id', this.tenantId)
      .eq('id', partyId)
      .single();

    if (error || !data) {
      throw new InvoiceError('Party not found', 'PARTY_NOT_FOUND', 400);
    }

    const expectedType = invoiceType === 'sale' ? 'customer' : 'supplier';
    if (data.type !== expectedType) {
      throw new InvoiceError(
        `Expected ${expectedType} for ${invoiceType} invoice, got ${data.type}`,
        'PARTY_TYPE_MISMATCH',
        400
      );
    }
  }

  /**
   * Validate items exist
   */
  private async validateItems(itemIds: string[]): Promise<void> {
    const { data, error } = await this.supabase
      .from('items')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .in('id', itemIds);

    if (error) {
      throw error;
    }

    const foundIds = new Set((data || []).map(i => i.id));
    const missingIds = itemIds.filter(id => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new InvoiceError(
        `Items not found: ${missingIds.join(', ')}`,
        'ITEMS_NOT_FOUND',
        400
      );
    }
  }

  /**
   * Validate stock availability for sale
   */
  private async validateStockAvailability(
    warehouseId: string,
    items: InvoiceWithRelations['items']
  ): Promise<void> {
    const availability = await this.getStockAvailability(
      warehouseId,
      items.map(i => i.itemId)
    );

    const insufficientStock: string[] = [];
    for (const item of items) {
      const available = availability[item.itemId] || 0;
      if (item.quantity > available) {
        insufficientStock.push(
          `${item.item.name}: requested ${item.quantity}, available ${available}`
        );
      }
    }

    if (insufficientStock.length > 0) {
      throw new InvoiceError(
        `Insufficient stock: ${insufficientStock.join('; ')}`,
        'INSUFFICIENT_STOCK',
        400
      );
    }
  }

  /**
   * Apply stock movements for invoice finalization
   */
  private async applyStockMovements(
    invoice: InvoiceWithRelations
  ): Promise<FinalizeInvoiceResult['stockMovements']> {
    const movements: FinalizeInvoiceResult['stockMovements'] = [];
    const isSale = invoice.type === 'sale';

    for (const item of invoice.items) {
      // Get current inventory
      const { data: inventory } = await this.supabase
        .from('inventory')
        .select('id, quantity')
        .eq('tenant_id', this.tenantId)
        .eq('warehouse_id', invoice.warehouseId)
        .eq('item_id', item.itemId)
        .maybeSingle();

      const previousQuantity = inventory ? Number(inventory.quantity) : 0;
      const quantityChange = isSale ? -item.quantity : item.quantity;
      const newQuantity = previousQuantity + quantityChange;

      if (inventory) {
        // Update existing inventory
        const { error: updateError } = await this.supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', inventory.id);
        if (updateError) throw updateError;
      } else {
        // Create inventory record (for purchases)
        const { error: insertError } = await this.supabase
          .from('inventory')
          .insert({
            tenant_id: this.tenantId,
            warehouse_id: invoice.warehouseId,
            item_id: item.itemId,
            quantity: newQuantity,
          });
        if (insertError) throw insertError;
      }

      movements.push({
        itemId: item.itemId,
        warehouseId: invoice.warehouseId,
        quantityChange,
        previousQuantity,
        newQuantity,
      });
    }

    return movements;
  }

  /**
   * Reverse stock movements for returns
   */
  private async reverseStockMovements(
    returnInvoice: InvoiceWithRelations,
    originalType: InvoiceType
  ): Promise<ReturnInvoiceResult['stockMovements']> {
    const movements: ReturnInvoiceResult['stockMovements'] = [];
    const isSaleReturn = originalType === 'sale';

    for (const item of returnInvoice.items) {
      const { data: inventory } = await this.supabase
        .from('inventory')
        .select('id, quantity')
        .eq('tenant_id', this.tenantId)
        .eq('warehouse_id', returnInvoice.warehouseId)
        .eq('item_id', item.itemId)
        .maybeSingle();

      const previousQuantity = inventory ? Number(inventory.quantity) : 0;
      // Sale return: add back to stock; Purchase return: remove from stock
      const quantityChange = isSaleReturn ? item.quantity : -item.quantity;
      const newQuantity = previousQuantity + quantityChange;

      if (inventory) {
        const { error: updateError } = await this.supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', inventory.id);
        if (updateError) throw updateError;
      } else if (isSaleReturn) {
        const { error: insertError } = await this.supabase
          .from('inventory')
          .insert({
            tenant_id: this.tenantId,
            warehouse_id: returnInvoice.warehouseId,
            item_id: item.itemId,
            quantity: newQuantity,
          });
        if (insertError) throw insertError;
      }

      movements.push({
        itemId: item.itemId,
        warehouseId: returnInvoice.warehouseId,
        quantityChange,
        previousQuantity,
        newQuantity,
      });
    }

    return movements;
  }

  /**
   * Update party balance
   */
  private async updatePartyBalance(
    partyId: string,
    amount: number,
    _invoiceType: InvoiceType
  ): Promise<FinalizeInvoiceResult['partyBalanceUpdate']> {
    const { data: party } = await this.supabase
      .from('parties')
      .select('id, balance')
      .eq('id', partyId)
      .maybeSingle();

    if (!party) {
      return undefined;
    }

    const previousBalance = Number(party.balance);
    // Both sale and purchase increase the party's outstanding balance.
    // Returns pass a negative amount to reverse.
    const newBalance = previousBalance + amount;

    await this.supabase
      .from('parties')
      .update({ balance: newBalance })
      .eq('id', partyId);

    return {
      partyId,
      previousBalance,
      newBalance,
      change: amount,
    };
  }

  /**
   * Map sort field
   */
  private mapSortField(sortBy?: string): string {
    const fieldMap: Record<string, string> = {
      invoiceNumber: 'invoice_number',
      createdAt: 'created_at',
      finalizedAt: 'finalized_at',
      total: 'total',
      status: 'status',
    };

    return fieldMap[sortBy || 'createdAt'] || 'created_at';
  }

  /**
   * Map database row to Invoice type
   */
  private mapRowToInvoice(row: Database['public']['Tables']['invoices']['Row']): Invoice {
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
  }
}
