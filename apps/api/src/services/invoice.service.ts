/**
 * Invoice Service
 *
 * Business logic for invoice management including stock calculations,
 * finalization, returns, and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { calculateLineTotal as sharedCalculateLineTotal } from '@erp/offline-engine';
import { InvoiceRepository, InvoiceQueryOptions } from '../repositories/invoice.repository';
import { AccountingService } from './accounting.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { PaymentService } from './payment.service';
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
  LinkedPayment,
  LinkedPaymentsMeta,
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
    public readonly statusCode: number = 400,
    // Optional structured context surfaced to the client as `error.meta`
    // (e.g. the linked payments that block/accompany a delete).
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InvoiceError';
  }
}

/**
 * A payment linked to an invoice, with whether it is exclusive to that invoice
 * (all its allocations point at it) or shared with other invoices.
 * Re-exported for the existing callers; the shape lives in `@erp/shared`.
 */
export type { LinkedPayment, LinkedPaymentsMeta };

/**
 * Service for Invoice business logic
 */
export class InvoiceService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly accountingService: AccountingService;
  private readonly inventoryValuation: InventoryValuationService;
  private readonly supabase: SupabaseClient<Database>;
  private readonly tenantId: string;
  private readonly userId?: string;
  // Lazily constructed to reverse linked payments during a cascade delete.
  private paymentService?: PaymentService;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    userId?: string
  ) {
    this.invoiceRepository = new InvoiceRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.inventoryValuation = new InventoryValuationService(supabase);
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  /** PaymentService for the same tenant, built on demand (cascade delete). */
  private getPaymentService(): PaymentService {
    if (!this.paymentService) {
      this.paymentService = new PaymentService(this.supabase, this.tenantId);
    }
    return this.paymentService;
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
      createdBy: params.createdBy,
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
      invoice_date: input.invoiceDate || undefined,
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
   * Update an invoice. Drafts are edited freely; finalized invoices are
   * re-mapped with full stock + party-balance reversal/reapply. Returned
   * and canceled invoices are immutable.
   */
  async updateInvoice(
    id: string,
    input: UpdateInvoiceInput,
    opts?: { deletePayments?: boolean }
  ): Promise<InvoiceWithRelations> {
    const existing = await this.invoiceRepository.findByIdWithRelations(this.tenantId, id);
    if (!existing) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (existing.status === 'returned' || existing.status === 'canceled') {
      throw new InvoiceError(
        `Cannot edit a ${existing.status} invoice`,
        'INVOICE_NOT_EDITABLE',
        400
      );
    }

    if (existing.status === 'final') {
      return this.updateFinalInvoice(existing, input, opts);
    }

    return this.updateDraftInvoice(existing, input);
  }

  /**
   * Apply field/item updates to a draft invoice.
   */
  private async updateDraftInvoice(
    existing: InvoiceWithRelations,
    input: UpdateInvoiceInput
  ): Promise<InvoiceWithRelations> {
    if (input.warehouseId) {
      await this.validateWarehouse(input.warehouseId);
    }

    if (input.partyId !== undefined && input.partyId !== null) {
      await this.validateParty(input.partyId, existing.type as InvoiceType);
    }

    const updateData = this.buildInvoiceUpdateData(input);
    const items = this.mapInputItems(input);

    if (items) {
      await this.validateItems(items.map(i => i.item_id));
    }

    return this.invoiceRepository.updateWithItems(this.tenantId, existing.id, updateData, items);
  }

  /**
   * Apply field/item updates to a finalized invoice. Reverses old stock and
   * party-balance effects, persists the new fields/items, then re-applies
   * stock with the new quantities and adjusts the party balance(s) by the
   * delta. Mirrors the reversal pattern used by createReturn.
   *
   * Linked payments block the edit unless `opts.deletePayments` is set, in
   * which case each payment linked *solely* to this invoice is deleted first —
   * see {@link resolveLinkedPayments}.
   */
  private async updateFinalInvoice(
    existing: InvoiceWithRelations,
    input: UpdateInvoiceInput,
    opts?: { deletePayments?: boolean }
  ): Promise<InvoiceWithRelations> {
    // Block edits when downstream rows depend on this invoice. Linked payments
    // either block the edit (with the payment list attached) or are cascade-
    // deleted first when the caller opted in.
    await this.resolveLinkedPayments(existing.id, opts?.deletePayments);
    await this.assertNoChildReturn(existing.id);

    if (input.warehouseId) {
      await this.validateWarehouse(input.warehouseId);
    }

    if (input.partyId !== undefined && input.partyId !== null) {
      await this.validateParty(input.partyId, existing.type as InvoiceType);
    }

    // 1) Reverse old stock movements against the original warehouse/items.
    await this.revertInvoiceStock(existing);

    // 2) Persist the field/item changes (DB triggers recompute totals).
    const updateData = this.buildInvoiceUpdateData(input);
    const items = this.mapInputItems(input);
    if (items) {
      await this.validateItems(items.map(i => i.item_id));
    }
    const persisted = await this.invoiceRepository.updateWithItems(
      this.tenantId,
      existing.id,
      updateData,
      items
    );

    // 3) For sales, validate stock against the new items in the new warehouse.
    if (persisted.type === 'sale') {
      try {
        await this.validateStockAvailability(persisted.warehouseId, persisted.items);
      } catch (err) {
        // Re-apply the old stock movements so we don't leave inventory inflated.
        await this.applyStockMovements(existing);
        throw err;
      }
    }

    // 4) Apply new stock movements at the (possibly updated) warehouse.
    await this.applyStockMovements(persisted);

    // 5) Adjust party balance(s). Since the status didn't change, the DB
    //    trigger doesn't fire — we use the same direct-update pattern as
    //    createReturn.
    const oldTotal = existing.total;
    const newTotal = persisted.total;
    const oldPartyId = existing.partyId;
    const newPartyId = persisted.partyId;

    if (oldPartyId && newPartyId && oldPartyId === newPartyId) {
      const delta = newTotal - oldTotal;
      if (delta !== 0) {
        await this.updatePartyBalance(newPartyId, delta, persisted.type);
      }
    } else {
      if (oldPartyId) {
        await this.updatePartyBalance(oldPartyId, -oldTotal, existing.type);
      }
      if (newPartyId) {
        await this.updatePartyBalance(newPartyId, newTotal, persisted.type);
      }
    }

    return persisted;
  }

  /**
   * Hard-delete an invoice. Reverses any side effects already applied
   * (stock movements + party balance) before removing the row.
   *
   * - draft / canceled: no reversal; just delete.
   * - final: revert stock, subtract total from party balance.
   * - returned: undo the return's stock-add and balance-subtract.
   *
   * Linked payments block the delete unless `opts.deletePayments` is set — see
   * {@link resolveLinkedPayments}. A finalized invoice with a child return row
   * is also blocked.
   */
  async deleteInvoice(
    id: string,
    opts?: { deletePayments?: boolean }
  ): Promise<{ id: string }> {
    const existing = await this.invoiceRepository.findByIdWithRelations(this.tenantId, id);
    if (!existing) {
      throw new InvoiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    await this.resolveLinkedPayments(existing.id, opts?.deletePayments);

    if (existing.status === 'final') {
      await this.assertNoChildReturn(existing.id);
      await this.revertInvoiceStock(existing);
      if (existing.partyId) {
        await this.updatePartyBalance(existing.partyId, -existing.total, existing.type);
      }
      // Reverse the auto-posted journal entry (if any). Posted entries are
      // immutable, so we post a mirror entry rather than editing the original.
      await this.reverseAccountingForInvoice(existing.id, existing.type);
    } else if (existing.status === 'returned') {
      // The return added stock back (sale-return) or removed stock
      // (purchase-return). Re-apply the original direction to undo it.
      await this.reapplyReturnedStock(existing);
      if (existing.partyId) {
        // The return previously subtracted total via createReturn's call to
        // updatePartyBalance(-total). Undo it.
        await this.updatePartyBalance(existing.partyId, existing.total, existing.type);
      }
    }

    // invoice_items have ON DELETE CASCADE; linked payments were deleted above
    // (or the delete was blocked).
    await this.invoiceRepository.delete(this.tenantId, id, false);

    return { id };
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

    // Post the auto-generated journal entry. Silently no-ops when accounting
    // is disabled for the tenant or required default ledgers are unmapped.
    await this.postAccountingForInvoice(finalizedInvoice!);

    return {
      invoice: finalizedInvoice!,
      stockMovements,
      partyBalanceUpdate,
    };
  }

  /**
   * Auto-post a balanced journal entry for a finalized sale or purchase
   * invoice. Skips returns (returnedFromId set) — those are handled by the
   * Credit/Debit Note voucher work in plan Phase 2. Failures are logged but
   * never rolled back: finalizing the invoice itself remains the
   * source-of-truth event for the operational flow.
   */
  private async postAccountingForInvoice(invoice: InvoiceWithRelations): Promise<void> {
    if (invoice.returnedFromId) {
      // Returns are out of scope for P1 auto-posting; Phase 2 wires
      // Credit/Debit Notes.
      return;
    }

    if (!(await this.accountingService.isEnabled(this.tenantId))) {
      return;
    }

    try {
      const userId = this.userId ?? invoice.createdBy ?? null;
      const entryDate = invoice.finalizedAt
        ? invoice.finalizedAt.split('T')[0]
        : new Date().toISOString().split('T')[0];

      const payload = {
        total: invoice.total,
        subtotal: invoice.subtotal,
        tax_amount: invoice.taxAmount,
        party_id: invoice.partyId ?? undefined,
      };

      if (invoice.type === 'sale') {
        await this.accountingService.generateJournalEntryFromSale(
          this.tenantId,
          userId,
          invoice.id,
          payload,
          entryDate
        );
        // Phase 5: when COGS is enabled, consume FIFO layers and post the
        // matching Dr COGS / Cr Inventory entry on top of the revenue JE.
        await this.postCogsForSale(invoice, entryDate, userId);
      } else if (invoice.type === 'purchase') {
        await this.accountingService.generateJournalEntryFromPurchase(
          this.tenantId,
          userId,
          invoice.id,
          payload,
          entryDate
        );
        // Phase 5: when COGS is enabled, register this purchase as a
        // FIFO cost layer so future sales can compute COGS against it.
        await this.recordPurchaseLayers(invoice);
      }
    } catch (error) {
      console.error(
        `[invoice] Failed to post accounting entry for invoice ${invoice.id}:`,
        error
      );
    }
  }

  /**
   * Phase 5: COGS leg for sales. Skips silently when COGS feature flag
   * isn't on for the tenant. Logs a warning when layers are insufficient
   * (short-stock fallback: 0 cost for the residual qty).
   */
  private async postCogsForSale(
    invoice: InvoiceWithRelations,
    entryDate: string,
    userId: string | null
  ): Promise<void> {
    if (!(await this.accountingService.isCogsEnabled(this.tenantId))) {
      return;
    }
    try {
      const result = await this.inventoryValuation.consumeLayersForSale({
        id: invoice.id,
        tenant_id: this.tenantId,
        warehouse_id: invoice.warehouseId,
        finalized_at: invoice.finalizedAt,
      });
      if (result.short_stock.length > 0) {
        console.warn(
          `[invoice] Sale ${invoice.id}: short stock on ${result.short_stock.length} line(s); residual qty costed at 0.`
        );
      }
      if (result.total_cogs > 0) {
        await this.accountingService.generateJournalEntryFromCogs(
          this.tenantId,
          userId,
          invoice.id,
          result.total_cogs,
          entryDate
        );
      }
    } catch (error) {
      console.error(
        `[invoice] Failed to post COGS for sale ${invoice.id}:`,
        error
      );
    }
  }

  /**
   * Phase 5: register a purchase's lines as FIFO cost layers. Idempotent
   * — skips lines that already produced a layer.
   */
  private async recordPurchaseLayers(invoice: InvoiceWithRelations): Promise<void> {
    if (!(await this.accountingService.isCogsEnabled(this.tenantId))) {
      return;
    }
    try {
      await this.inventoryValuation.recordLayersForPurchase({
        id: invoice.id,
        tenant_id: this.tenantId,
        warehouse_id: invoice.warehouseId,
        finalized_at: invoice.finalizedAt,
      });
    } catch (error) {
      console.error(
        `[invoice] Failed to record FIFO layers for purchase ${invoice.id}:`,
        error
      );
    }
  }

  /**
   * Reverse a previously-posted journal entry for an invoice. Used when the
   * invoice is deleted or unfinalized so the GL stays consistent.
   *
   * Phase 5: also reverses the COGS JE and the FIFO layers for the
   * matching side. Purchase-deletes zero out the layers they created (the
   * audit row stays); sale-deletes reverse the COGS JE.
   */
  private async reverseAccountingForInvoice(
    invoiceId: string,
    type: InvoiceType
  ): Promise<void> {
    if (!(await this.accountingService.isEnabled(this.tenantId))) {
      return;
    }
    try {
      await this.accountingService.reverseEntry(
        this.tenantId,
        this.userId ?? null,
        type, // 'sale' or 'purchase' — matches source_type used at post time
        invoiceId,
        'Invoice deleted'
      );
    } catch (error) {
      console.error(
        `[invoice] Failed to reverse accounting entry for invoice ${invoiceId}:`,
        error
      );
    }

    // Phase 5: COGS-side reversal.
    if (await this.accountingService.isCogsEnabled(this.tenantId)) {
      try {
        if (type === 'sale') {
          await this.accountingService.reverseEntry(
            this.tenantId,
            this.userId ?? null,
            'cogs',
            invoiceId,
            'Sale deleted'
          );
        } else if (type === 'purchase') {
          const r = await this.inventoryValuation.reverseLayersForPurchase(
            this.tenantId,
            invoiceId
          );
          if (r.partially_consumed > 0) {
            console.warn(
              `[invoice] Purchase ${invoiceId} reversal: ${r.partially_consumed} layer(s) had already been consumed by downstream sales — those layers are zeroed but the consumed cost stays on the sales' COGS.`
            );
          }
        }
      } catch (error) {
        console.error(
          `[invoice] Failed to reverse COGS / layers for invoice ${invoiceId}:`,
          error
        );
      }
    }
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
    // Delegates to the shared offline engine so client and server agree exactly.
    return sharedCalculateLineTotal({ quantity, unitPrice, discountPercent, taxRate });
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
   * Build the partial DB update payload from a public update input.
   */
  private buildInvoiceUpdateData(input: UpdateInvoiceInput): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};
    if (input.partyId !== undefined) updateData.party_id = input.partyId;
    if (input.warehouseId !== undefined) updateData.warehouse_id = input.warehouseId;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.exchangeRate !== undefined) updateData.exchange_rate = input.exchangeRate;
    if (input.discountAmount !== undefined) updateData.discount_amount = input.discountAmount;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.invoiceDate !== undefined) updateData.invoice_date = input.invoiceDate;
    return updateData;
  }

  /**
   * Map public input items to the repository's insert shape.
   */
  private mapInputItems(
    input: UpdateInvoiceInput
  ): Parameters<InvoiceRepository['updateWithItems']>[3] | undefined {
    if (!input.items) return undefined;
    return input.items.map((item, index) => ({
      item_id: item.itemId,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent || 0,
      tax_rate: item.taxRate || 0,
      line_total: this.calculateLineTotal(
        item.quantity,
        item.unitPrice,
        item.discountPercent || 0,
        item.taxRate || 0
      ),
      sort_order: item.sortOrder ?? index,
    }));
  }

  /**
   * Return the payments linked to an invoice, via either the legacy
   * `payments.invoice_id` column or a `payment_allocations` row. Each result is
   * flagged `shared` when the payment also has an allocation to a *different*
   * invoice (so deleting this invoice must not silently unwind it).
   */
  private async getLinkedPayments(invoiceId: string): Promise<LinkedPayment[]> {
    // 1. Legacy single-invoice link (payments.invoice_id).
    const { data: legacy, error: legacyErr } = await this.supabase
      .from('payments')
      .select('id')
      .eq('tenant_id', this.tenantId)
      .eq('invoice_id', invoiceId);
    if (legacyErr) throw legacyErr;

    // 2. Bill-wise link (payment_allocations.invoice_id) — multi-invoice payments
    //    leave payments.invoice_id NULL, so they only show up here.
    const { data: allocRows, error: allocErr } = await this.supabase
      .from('payment_allocations' as any)
      .select('payment_id')
      .eq('tenant_id', this.tenantId)
      .eq('invoice_id', invoiceId);
    if (allocErr) throw allocErr;

    const paymentIds = new Set<string>();
    for (const p of legacy ?? []) paymentIds.add(p.id);
    for (const a of ((allocRows as unknown) as { payment_id: string }[]) ?? []) {
      paymentIds.add(a.payment_id);
    }
    if (paymentIds.size === 0) return [];

    const ids = Array.from(paymentIds);

    // Fetch the payment rows (the legacy list alone can miss allocation-only ones).
    // The bank_account embed is nullable — bank_account_id is ON DELETE SET NULL
    // and cash payments never carry one.
    const { data: payments, error: payErr } = await this.supabase
      .from('payments')
      .select(
        'id, reference, amount, payment_date, payment_method, bank_account:bank_accounts(name)'
      )
      .eq('tenant_id', this.tenantId)
      .in('id', ids);
    if (payErr) throw payErr;

    // A payment is "shared" if it has any allocation to a different invoice.
    const { data: otherAllocs, error: otherErr } = await this.supabase
      .from('payment_allocations' as any)
      .select('payment_id, invoice_id')
      .eq('tenant_id', this.tenantId)
      .in('payment_id', ids);
    if (otherErr) throw otherErr;

    const sharedIds = new Set<string>();
    for (const row of ((otherAllocs as unknown) as {
      payment_id: string;
      invoice_id: string;
    }[]) ?? []) {
      if (row.invoice_id !== invoiceId) sharedIds.add(row.payment_id);
    }

    return (payments ?? []).map((row) => {
      const p = (row as unknown) as {
        id: string;
        reference: string | null;
        amount: number | string;
        payment_date: string;
        payment_method: string | null;
        // Supabase types the embed as an object or an array depending on the
        // inferred cardinality; normalise both.
        bank_account: { name: string } | { name: string }[] | null;
      };
      const bank = Array.isArray(p.bank_account) ? p.bank_account[0] : p.bank_account;
      return {
        id: p.id,
        reference: p.reference ?? null,
        amount: Number(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method ?? null,
        bankAccountName: bank?.name ?? null,
        shared: sharedIds.has(p.id),
      };
    });
  }

  /**
   * Gate an invoice edit or delete on the payments linked to it.
   *
   * With `deletePayments` unset the caller is refused with the payment list
   * attached as `error.meta`, so the UI can show the payments and offer a
   * cascade. With it set, each payment linked *solely* to this invoice is
   * deleted first (reversing its journal entry, party-balance change and
   * allocations). A payment shared with other invoices is never auto-deleted —
   * reversing it would wrongly unwind those other invoices — so the operation
   * is refused and the user resolves it manually.
   *
   * Payment-first ordering is deliberate and fail-safe: if the invoice edit or
   * delete that follows fails, we're left with a valid unpaid invoice.
   */
  private async resolveLinkedPayments(
    invoiceId: string,
    deletePayments?: boolean
  ): Promise<void> {
    const linkedPayments = await this.getLinkedPayments(invoiceId);
    if (linkedPayments.length === 0) return;

    const hasSharedPayments = linkedPayments.some((p) => p.shared);
    const paymentsMeta: LinkedPaymentsMeta = {
      paymentCount: linkedPayments.length,
      totalPaid: linkedPayments.reduce((s, p) => s + p.amount, 0),
      hasSharedPayments,
      payments: linkedPayments,
    };

    if (!deletePayments) {
      // Block, but hand the client enough context to offer a cascade delete.
      throw new InvoiceError(
        'Cannot modify or delete an invoice that has linked payments. Remove the payments first.',
        'INVOICE_HAS_PAYMENTS',
        409,
        paymentsMeta as unknown as Record<string, unknown>
      );
    }

    if (hasSharedPayments) {
      throw new InvoiceError(
        'One or more linked payments also cover other invoices and cannot be ' +
          'deleted automatically. Remove or re-allocate those payments first.',
        'INVOICE_HAS_SHARED_PAYMENTS',
        409,
        paymentsMeta as unknown as Record<string, unknown>
      );
    }

    for (const p of linkedPayments) {
      await this.getPaymentService().deletePayment(p.id);
    }
  }

  /**
   * Reject if a return invoice references this invoice as its parent.
   */
  private async assertNoChildReturn(invoiceId: string): Promise<void> {
    const { count, error } = await this.supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', this.tenantId)
      .eq('returned_from_id', invoiceId);

    if (error) throw error;
    if ((count ?? 0) > 0) {
      throw new InvoiceError(
        'Cannot modify or delete an invoice that has a return. Delete the return first.',
        'INVOICE_HAS_RETURN',
        409
      );
    }
  }

  /**
   * Reverse the stock movements that finalization applied — i.e., add back
   * for sales and subtract for purchases. Used by edit-final and delete-final.
   */
  private async revertInvoiceStock(invoice: InvoiceWithRelations): Promise<void> {
    const isSale = invoice.type === 'sale';
    for (const item of invoice.items) {
      const { data: inventory } = await this.supabase
        .from('inventory')
        .select('id, quantity')
        .eq('tenant_id', this.tenantId)
        .eq('warehouse_id', invoice.warehouseId)
        .eq('item_id', item.itemId)
        .maybeSingle();

      const previousQuantity = inventory ? Number(inventory.quantity) : 0;
      // Sale: add qty back to stock. Purchase: subtract qty from stock.
      const quantityChange = isSale ? item.quantity : -item.quantity;
      const newQuantity = previousQuantity + quantityChange;

      if (inventory) {
        const { error } = await this.supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', inventory.id);
        if (error) throw error;
      } else if (isSale) {
        const { error } = await this.supabase
          .from('inventory')
          .insert({
            tenant_id: this.tenantId,
            warehouse_id: invoice.warehouseId,
            item_id: item.itemId,
            quantity: newQuantity,
          });
        if (error) throw error;
      }
    }
  }

  /**
   * Re-apply original-direction stock movements to undo a return.
   * Used by delete-of-returned: a sale-return originally added stock back,
   * so undoing it subtracts; a purchase-return originally removed stock,
   * so undoing it adds. The "original type" is the parent invoice's type,
   * which we look up via returnedFromId.
   */
  private async reapplyReturnedStock(returnInvoice: InvoiceWithRelations): Promise<void> {
    let originalType: InvoiceType = returnInvoice.type;
    if (returnInvoice.returnedFromId) {
      const parent = await this.invoiceRepository.findById(this.tenantId, returnInvoice.returnedFromId);
      if (parent) {
        originalType = parent.type as InvoiceType;
      }
    }
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
      // Undo a sale-return: subtract; undo a purchase-return: add.
      const quantityChange = isSaleReturn ? -item.quantity : item.quantity;
      const newQuantity = previousQuantity + quantityChange;

      if (inventory) {
        const { error } = await this.supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', inventory.id);
        if (error) throw error;
      } else if (!isSaleReturn) {
        const { error } = await this.supabase
          .from('inventory')
          .insert({
            tenant_id: this.tenantId,
            warehouse_id: returnInvoice.warehouseId,
            item_id: item.itemId,
            quantity: newQuantity,
          });
        if (error) throw error;
      }
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
   * Update party balance.
   *
   * Delegates to the adjust_party_balance RPC rather than reading the balance
   * and writing back a total: the payment and invoice triggers write the same
   * column, so a read-modify-write here can silently lose one of their updates.
   * The RPC is also tenant-scoped, which the direct update was not.
   */
  private async updatePartyBalance(
    partyId: string,
    amount: number,
    _invoiceType: InvoiceType
  ): Promise<FinalizeInvoiceResult['partyBalanceUpdate']> {
    // Both sale and purchase increase the party's outstanding balance.
    // Returns pass a negative amount to reverse.
    // `as never` on the name: generated Database types predate migration 038.
    const { data, error } = await this.supabase.rpc('adjust_party_balance' as never, {
      p_tenant_id: this.tenantId,
      p_party_id: partyId,
      p_delta: amount,
    } as never);

    // A missing party raises no_data_found; the previous implementation simply
    // returned undefined for that case, so keep it non-fatal.
    if (error) {
      return undefined;
    }

    const newBalance = Number(data || 0);

    return {
      partyId,
      previousBalance: newBalance - amount,
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
      invoiceDate: row.invoice_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      finalizedAt: row.finalized_at,
    };
  }
}
