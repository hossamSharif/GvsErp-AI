/**
 * Payment Service
 *
 * Business logic for payment management including validation and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { PartyRepository } from '../repositories/party.repository';
import { AccountingService } from './accounting.service';
import type {
  Payment,
  PaymentWithParty,
  PaymentWithRelations,
  PaymentType,
  PaymentQueryParams,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentReportParams,
  PaymentReportResponse,
  PaymentReportEntry,
  PaymentReportSummary,
  OutstandingInvoice,
  PaymentAllocationInput,
} from '@erp/shared';
import type { QueryResult } from '../repositories/base.repository';

/**
 * Application error for payment-related operations
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Service for Payment business logic
 */
export class PaymentService {
  private readonly paymentRepository: PaymentRepository;
  private readonly partyRepository: PartyRepository;
  private readonly accountingService: AccountingService;
  private readonly tenantId: string;
  private readonly supabase: SupabaseClient<Database>;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string
  ) {
    this.supabase = supabase;
    this.paymentRepository = new PaymentRepository(supabase);
    this.partyRepository = new PartyRepository(supabase);
    this.accountingService = new AccountingService(supabase);
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // PAYMENT CRUD OPERATIONS
  // ==========================================================================

  /**
   * Get paginated list of payments with filters
   */
  async getPayments(params: PaymentQueryParams): Promise<QueryResult<PaymentWithParty>> {
    return this.paymentRepository.findAllWithFilters({
      tenantId: this.tenantId,
      page: params.page,
      limit: params.limit,
      sort_by: this.mapSortField(params.sortBy),
      sort_order: params.sortDir,
      type: params.type,
      partyId: params.partyId,
      invoiceId: params.invoiceId,
      paymentMethod: params.paymentMethod,
      search: params.search,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }

  /**
   * Get a single payment by ID
   */
  async getPayment(id: string): Promise<PaymentWithRelations> {
    const payment = await this.paymentRepository.findByIdWithRelations(this.tenantId, id);

    if (!payment) {
      throw new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    return payment;
  }

  /**
   * Create a new payment.
   *
   * Phase 3 changes:
   *  - `bankAccountId` (optional) routes the journal entry through that
   *    bank's ledger instead of generic cash_in_hand.
   *  - `allocations[]` carries bill-wise details (which invoices this
   *    payment clears, and how much against each). Validated for:
   *      - sum(amount) <= payment.amount
   *      - each invoice belongs to the same party
   *      - each amount <= that invoice's outstanding balance
   *    When provided, takes precedence over the legacy `invoiceId` field.
   */
  async createPayment(input: CreatePaymentInput, userId?: string): Promise<PaymentWithRelations> {
    // Validate party exists
    const party = await this.partyRepository.findById(this.tenantId, input.partyId);
    if (!party) {
      throw new PaymentError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    // Validate payment type matches party type
    this.validatePaymentType(input.type, party.type);

    // Resolve effective allocations: explicit list takes precedence over
    // the legacy single invoiceId.
    const effectiveAllocations: PaymentAllocationInput[] = input.allocations?.length
      ? input.allocations
      : input.invoiceId
        ? [{ invoice_id: input.invoiceId, amount: input.amount }]
        : [];

    if (effectiveAllocations.length > 0) {
      await this.validateAllocations(input.partyId, input.amount, effectiveAllocations);
    }

    // Resolve bank account (if provided) so we can post the JE through its ledger.
    let bankLedgerId: string | null = null;
    if (input.bankAccountId) {
      const { data: bank, error } = await this.supabase
        .from('bank_accounts' as any)
        .select('id, ledger_account_id, is_active')
        .eq('tenant_id', this.tenantId)
        .eq('id', input.bankAccountId)
        .maybeSingle();
      if (error) throw error;
      if (!bank) {
        throw new PaymentError('Bank account not found', 'BANK_NOT_FOUND', 404);
      }
      bankLedgerId = (bank as any).ledger_account_id;
    }

    // Generate payment reference if not provided
    const reference = input.reference || await this.generatePaymentReference(input.type);

    // Keep the legacy `invoice_id` populated when there's exactly one
    // allocation, so existing UI/reports that read it still work.
    const legacyInvoiceId =
      effectiveAllocations.length === 1 ? effectiveAllocations[0].invoice_id : null;

    const paymentData = {
      party_id: input.partyId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'USD',
      exchange_rate: input.exchangeRate || 1,
      payment_method: input.paymentMethod || null,
      reference,
      invoice_id: legacyInvoiceId ?? input.invoiceId ?? null,
      bank_account_id: input.bankAccountId ?? null,
      notes: input.notes?.trim() || null,
      payment_date: input.paymentDate || new Date().toISOString().split('T')[0],
      created_by: userId || null,
    };

    const payment = await this.paymentRepository.create(this.tenantId, paymentData as any);

    // Insert allocations after the payment exists (FK + sum-check trigger
    // verify integrity).
    if (effectiveAllocations.length > 0) {
      const allocationRows = effectiveAllocations.map((a) => ({
        tenant_id: this.tenantId,
        payment_id: payment.id,
        invoice_id: a.invoice_id,
        amount: a.amount,
      }));
      const { error: allocErr } = await this.supabase
        .from('payment_allocations' as any)
        .insert(allocationRows);
      if (allocErr) {
        // Roll back the parent payment so we don't leave orphans.
        await this.paymentRepository.delete(this.tenantId, payment.id);
        throw allocErr;
      }
    }

    // Auto-post the corresponding journal entry. Silently no-ops when
    // accounting is disabled for the tenant or default ledgers are unmapped.
    if (await this.accountingService.isEnabled(this.tenantId)) {
      try {
        await this.accountingService.generateJournalEntryFromPayment(
          this.tenantId,
          userId ?? null,
          payment.id,
          {
            amount: Number(payment.amount),
            type: payment.type as 'received' | 'made',
            // Phase 4: route through the party's specific ledger.
            party_id: payment.party_id,
            cash_account_id_override: bankLedgerId,
          },
          paymentData.payment_date
        );
      } catch (error) {
        console.error(
          `[payment] Failed to post accounting entry for payment ${payment.id}:`,
          error
        );
      }
    }

    // Get payment with relations
    const paymentWithRelations = await this.paymentRepository.findByIdWithRelations(
      this.tenantId,
      payment.id
    );

    if (!paymentWithRelations) {
      throw new PaymentError('Failed to retrieve created payment', 'CREATE_FAILED', 500);
    }

    return paymentWithRelations;
  }

  /**
   * Validate a list of bill-wise allocations against business rules.
   *  - sum(amount) ≤ payment.amount
   *  - each invoice belongs to the same party
   *  - each amount ≤ outstanding balance on that invoice
   */
  private async validateAllocations(
    partyId: string,
    paymentAmount: number,
    allocations: PaymentAllocationInput[]
  ): Promise<void> {
    const total = allocations.reduce((s, a) => s + a.amount, 0);
    if (total > paymentAmount + 0.01) {
      throw new PaymentError(
        `Allocations (${total}) exceed payment amount (${paymentAmount})`,
        'ALLOCATIONS_EXCEED_AMOUNT'
      );
    }
    for (const a of allocations) {
      if (a.amount <= 0) {
        throw new PaymentError(
          `Allocation amount must be positive (got ${a.amount})`,
          'ALLOCATION_NOT_POSITIVE'
        );
      }
    }

    // Fetch the referenced invoices in one query
    const invoiceIds = allocations.map((a) => a.invoice_id);
    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select('id, party_id, total, status')
      .eq('tenant_id', this.tenantId)
      .in('id', invoiceIds);
    if (error) throw error;

    const invMap = new Map((invoices ?? []).map((i) => [i.id, i]));
    for (const a of allocations) {
      const inv = invMap.get(a.invoice_id);
      if (!inv) {
        throw new PaymentError(
          `Invoice ${a.invoice_id} not found`,
          'INVOICE_NOT_FOUND',
          404
        );
      }
      if (inv.party_id !== partyId) {
        throw new PaymentError(
          `Invoice ${inv.id} does not belong to party ${partyId}`,
          'INVOICE_PARTY_MISMATCH'
        );
      }
      if (inv.status !== 'final') {
        throw new PaymentError(
          `Invoice ${inv.id} is not finalized`,
          'INVOICE_NOT_FINAL'
        );
      }
    }

    // Sum existing allocations per invoice to check the remaining capacity
    const { data: prior, error: priorErr } = await this.supabase
      .from('payment_allocations' as any)
      .select('invoice_id, amount')
      .in('invoice_id', invoiceIds);
    if (priorErr) throw priorErr;

    const priorMap = new Map<string, number>();
    for (const row of ((prior as unknown) as { invoice_id: string; amount: number }[]) ?? []) {
      priorMap.set(row.invoice_id, (priorMap.get(row.invoice_id) ?? 0) + Number(row.amount));
    }

    for (const a of allocations) {
      const inv = invMap.get(a.invoice_id)!;
      const alreadyAllocated = priorMap.get(a.invoice_id) ?? 0;
      const outstanding = Number(inv.total) - alreadyAllocated;
      if (a.amount > outstanding + 0.01) {
        throw new PaymentError(
          `Allocation ${a.amount} exceeds outstanding balance ${outstanding} on invoice ${inv.id}`,
          'ALLOCATION_EXCEEDS_OUTSTANDING'
        );
      }
    }
  }

  /**
   * Return outstanding (unpaid / partially-paid) finalized invoices for a
   * party. Drives the bill-wise picker on the payment form.
   *
   * @param partyId  Party to filter by.
   * @param asOf     Optional date — only allocations up to this date count.
   */
  async getOutstandingInvoices(partyId: string, asOf?: string): Promise<OutstandingInvoice[]> {
    // Note: invoices table has no `invoice_date` column — we surface
    // `finalized_at` (when it became billable) and fall back to `created_at`.
    const { data: invoices, error: iErr } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, finalized_at, created_at, total, returned_from_id')
      .eq('tenant_id', this.tenantId)
      .eq('party_id', partyId)
      .eq('status', 'final')
      .is('returned_from_id', null);
    if (iErr) throw iErr;

    const invoiceIds = (invoices ?? []).map((i) => i.id);
    if (invoiceIds.length === 0) return [];

    let allocQuery = this.supabase
      .from('payment_allocations' as any)
      .select('invoice_id, amount, allocated_at')
      .in('invoice_id', invoiceIds);
    if (asOf) {
      allocQuery = allocQuery.lte('allocated_at', asOf + 'T23:59:59');
    }
    const { data: allocations, error: aErr } = await allocQuery;
    if (aErr) throw aErr;

    const allocMap = new Map<string, number>();
    for (const row of ((allocations as unknown) as { invoice_id: string; amount: number }[]) ?? []) {
      allocMap.set(row.invoice_id, (allocMap.get(row.invoice_id) ?? 0) + Number(row.amount));
    }

    const today = new Date();
    const result: OutstandingInvoice[] = [];
    for (const inv of invoices ?? []) {
      const total = Number(inv.total ?? 0);
      const allocated = allocMap.get(inv.id) ?? 0;
      const outstanding = total - allocated;
      if (outstanding <= 0.01) continue;

      const rawDate = inv.finalized_at ?? inv.created_at;
      const invDate = rawDate ? new Date(rawDate) : today;
      const dateOnly = invDate.toISOString().split('T')[0];
      const daysOutstanding = Math.max(
        0,
        Math.floor((today.getTime() - invDate.getTime()) / 86_400_000)
      );

      result.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: dateOnly,
        total,
        allocated,
        outstanding,
        days_outstanding: daysOutstanding,
      });
    }

    // Oldest first — natural FIFO order for allocation.
    result.sort((a, b) => (a.invoice_date < b.invoice_date ? -1 : 1));
    return result;
  }

  /**
   * Update an existing payment (limited fields)
   */
  async updatePayment(id: string, input: UpdatePaymentInput): Promise<Payment> {
    // Check if payment exists
    const existing = await this.paymentRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    const updates: Partial<typeof existing> = {};
    if (input.paymentMethod !== undefined) {
      updates.payment_method = input.paymentMethod?.trim() || null;
    }
    if (input.reference !== undefined) {
      updates.reference = input.reference?.trim() || null;
    }
    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    const row = await this.paymentRepository.update(this.tenantId, id, updates);

    if (!row) {
      throw new PaymentError('Failed to update payment', 'UPDATE_FAILED', 500);
    }

    return this.mapRow(row);
  }

  /**
   * Delete a payment
   * WARNING: This will reverse the balance change
   */
  async deletePayment(id: string): Promise<void> {
    const existing = await this.paymentRepository.findById(this.tenantId, id);
    if (!existing) {
      throw new PaymentError('Payment not found', 'PAYMENT_NOT_FOUND', 404);
    }

    // Reverse the auto-posted journal entry before deletion. Posted journal
    // entries are immutable; reverseEntry posts a mirror entry instead.
    if (await this.accountingService.isEnabled(this.tenantId)) {
      try {
        await this.accountingService.reverseEntry(
          this.tenantId,
          null,
          'payment',
          id,
          'Payment deleted'
        );
      } catch (error) {
        console.error(
          `[payment] Failed to reverse accounting entry for payment ${id}:`,
          error
        );
      }
    }

    // The database trigger will automatically reverse the balance change
    const deleted = await this.paymentRepository.delete(this.tenantId, id);
    if (!deleted) {
      throw new PaymentError('Failed to delete payment', 'DELETE_FAILED', 500);
    }
  }

  // ==========================================================================
  // PAYMENT REPORTS
  // ==========================================================================

  /**
   * Get payment report
   */
  async getPaymentReport(params: PaymentReportParams): Promise<PaymentReportResponse> {
    const queryParams: PaymentQueryParams = {
      type: params.type,
      partyId: params.partyId,
      paymentMethod: params.paymentMethod,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: 1,
      limit: 10000, // Get all for report
      sortBy: 'paymentDate',
      sortDir: 'desc',
    };

    const result = await this.getPayments(queryParams);
    const payments = result.data;

    // Build report entries
    const entries: PaymentReportEntry[] = payments.map((payment: PaymentWithParty) => ({
      id: payment.id,
      reference: payment.reference,
      partyName: payment.party.name,
      partyType: payment.party.type,
      type: payment.type,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      invoiceNumber: null, // Will be populated if invoice linked
      notes: payment.notes,
    }));

    // Populate invoice numbers for linked payments
    for (const entry of entries) {
      const payment = payments.find((p: PaymentWithParty) => p.id === entry.id);
      if (payment?.invoiceId) {
        const { data: invoice } = await this.supabase
          .from('invoices')
          .select('invoice_number')
          .eq('id', payment.invoiceId)
          .maybeSingle();

        if (invoice) {
          entry.invoiceNumber = invoice.invoice_number;
        }
      }
    }

    // Filter by party type if specified
    let filteredEntries = entries;
    if (params.partyType) {
      filteredEntries = entries.filter((e) => e.partyType === params.partyType);
    }

    // Calculate summary if requested
    let summary: PaymentReportSummary | undefined;
    if (params.includeSummary !== false) {
      const totalReceived = filteredEntries
        .filter((e) => e.type === 'received')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalMade = filteredEntries
        .filter((e) => e.type === 'made')
        .reduce((sum, e) => sum + e.amount, 0);

      const byMethod: Record<string, { count: number; total: number }> = {};
      for (const entry of filteredEntries) {
        const method = entry.paymentMethod || 'Unknown';
        if (!byMethod[method]) {
          byMethod[method] = { count: 0, total: 0 };
        }
        byMethod[method].count += 1;
        byMethod[method].total += entry.amount;
      }

      summary = {
        totalPayments: filteredEntries.length,
        totalReceived,
        totalMade,
        netCashFlow: totalReceived - totalMade,
        byMethod,
      };
    }

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
   * Map DB row to camelCase Payment type
   */
  private mapRow(row: {
    id: string; tenant_id: string; party_id: string; type: PaymentType;
    amount: number; currency: string; exchange_rate: number;
    payment_method: string | null; reference: string | null; invoice_id: string | null;
    notes: string | null; payment_date: string; created_by: string | null;
    created_at: string;
  }): Payment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      partyId: row.party_id,
      type: row.type,
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
  }

  /**
   * Validate payment type matches party type
   */
  private validatePaymentType(paymentType: PaymentType, partyType: string): void {
    if (paymentType === 'received' && partyType !== 'customer') {
      throw new PaymentError(
        'Payment received should be from a customer',
        'INVALID_PAYMENT_TYPE',
        400
      );
    }

    if (paymentType === 'made' && partyType !== 'supplier') {
      throw new PaymentError(
        'Payment made should be to a supplier',
        'INVALID_PAYMENT_TYPE',
        400
      );
    }
  }

  // validateInvoice removed in Phase 3 — bill-wise allocations validated via
  // validateAllocations() above. Single-invoice payments now flow through
  // that same path with a one-row allocations array.

  /**
   * Generate payment reference number
   */
  private async generatePaymentReference(type: PaymentType): Promise<string> {
    const { data, error } = await this.supabase.rpc('generate_payment_reference', {
      p_tenant_id: this.tenantId,
      p_type: type,
    });

    if (error) {
      // Fallback to timestamp-based reference if function fails
      const prefix = type === 'received' ? 'RCV' : 'PAY';
      const timestamp = Date.now().toString().slice(-8);
      return `${prefix}-${timestamp}`;
    }

    return data;
  }

  /**
   * Map sort field from API to database column
   */
  private mapSortField(field?: string): string {
    const mapping: Record<string, string> = {
      paymentDate: 'payment_date',
      amount: 'amount',
      createdAt: 'created_at',
    };

    return mapping[field || 'paymentDate'] || 'payment_date';
  }
}
