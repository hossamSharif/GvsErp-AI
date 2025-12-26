/**
 * Payment Service
 *
 * Business logic for payment management including validation and reporting.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { PartyRepository } from '../repositories/party.repository';
import { AccountRepository } from '../repositories/account.repository';
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
} from '@erp-saas/shared';
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
  private readonly accountRepository: AccountRepository;
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
    this.accountRepository = new AccountRepository(supabase);
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
   * Create a new payment
   */
  async createPayment(input: CreatePaymentInput, userId?: string): Promise<PaymentWithRelations> {
    // Validate party exists
    const party = await this.partyRepository.findById(this.tenantId, input.partyId);
    if (!party) {
      throw new PaymentError('Party not found', 'PARTY_NOT_FOUND', 404);
    }

    // Validate payment type matches party type
    this.validatePaymentType(input.type, party.type as any);

    // Validate invoice if provided
    if (input.invoiceId) {
      await this.validateInvoice(input.invoiceId, input.partyId);
    }

    // Generate payment reference if not provided
    const reference = input.reference || await this.generatePaymentReference(input.type);

    const paymentData = {
      party_id: input.partyId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'USD',
      exchange_rate: input.exchangeRate || 1,
      payment_method: input.paymentMethod || null,
      reference,
      invoice_id: input.invoiceId || null,
      notes: input.notes?.trim() || null,
      payment_date: input.paymentDate || new Date().toISOString().split('T')[0],
      created_by: userId || null,
    };

    const payment = await this.paymentRepository.create(this.tenantId, paymentData);

    // Generate journal entry if accounting module is active
    await this.generateJournalEntryForPayment(payment.id, input.type, input.amount, userId);

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
   * Generate journal entry for payment
   */
  private async generateJournalEntryForPayment(
    paymentId: string,
    type: PaymentType,
    amount: number,
    userId?: string
  ): Promise<void> {
    try {
      // Check if accounting module is activated
      const status = await this.accountingService.getActivationStatus(this.tenantId);
      if (!status.is_activated) {
        return; // Accounting not active, skip journal entry
      }

      // Get default accounts by code
      const defaultAccounts = await this.getDefaultAccounts();
      if (!defaultAccounts) {
        console.warn('Default accounts not configured, skipping journal entry');
        return;
      }

      await this.accountingService.generateJournalEntryFromPayment(
        this.tenantId,
        userId || 'system',
        paymentId,
        {
          amount,
          type,
        },
        {
          cash_account_id: defaultAccounts.cash,
          accounts_receivable_id: defaultAccounts.accountsReceivable,
          accounts_payable_id: defaultAccounts.accountsPayable,
        }
      );
    } catch (error) {
      // Log error but don't fail the payment creation
      console.error('Failed to generate journal entry for payment:', error);
    }
  }

  /**
   * Get default account IDs by standard codes
   */
  private async getDefaultAccounts(): Promise<{
    cash?: string;
    accountsReceivable?: string;
    accountsPayable?: string;
  } | null> {
    const accountCodes = ['1110', '1120', '2110'];
    const accounts: Record<string, string> = {};

    for (const code of accountCodes) {
      const account = await this.accountRepository.findByCode(this.tenantId, code);
      if (account) {
        accounts[code] = account.id;
      }
    }

    // Return null if no accounts found (accounting not set up)
    if (Object.keys(accounts).length === 0) {
      return null;
    }

    return {
      cash: accounts['1110'],
      accountsReceivable: accounts['1120'],
      accountsPayable: accounts['2110'],
    };
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

    const payment = await this.paymentRepository.update(this.tenantId, id, updates);

    if (!payment) {
      throw new PaymentError('Failed to update payment', 'UPDATE_FAILED', 500);
    }

    return payment;
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
    const entries: PaymentReportEntry[] = payments.map((payment) => ({
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
      const payment = payments.find((p) => p.id === entry.id);
      if (payment?.invoiceId) {
        const { data: invoice } = await this.supabase
          .from('invoices')
          .select('invoice_number')
          .eq('id', payment.invoiceId)
          .single();

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

  /**
   * Validate invoice exists and belongs to party
   */
  private async validateInvoice(invoiceId: string, partyId: string): Promise<void> {
    const { data: invoice, error } = await this.supabase
      .from('invoices')
      .select('id, party_id, status')
      .eq('id', invoiceId)
      .eq('tenant_id', this.tenantId)
      .single();

    if (error || !invoice) {
      throw new PaymentError('Invoice not found', 'INVOICE_NOT_FOUND', 404);
    }

    if (invoice.party_id !== partyId) {
      throw new PaymentError(
        'Invoice does not belong to this party',
        'INVOICE_PARTY_MISMATCH',
        400
      );
    }

    if (invoice.status !== 'final') {
      throw new PaymentError(
        'Cannot link payment to non-finalized invoice',
        'INVOICE_NOT_FINAL',
        400
      );
    }
  }

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
