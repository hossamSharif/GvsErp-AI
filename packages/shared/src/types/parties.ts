/**
 * Party and Payment entity types for the ERP system
 * @module types/parties
 */

import type { SortDirection } from './items';

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Party type - customer or supplier
 */
export type PartyType = 'customer' | 'supplier';

/**
 * Payment type - received from customer or made to supplier
 */
export type PaymentType = 'received' | 'made';

/**
 * Payment method options
 */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';

/**
 * Side of the ledger an opening balance sits on, as entered by the user.
 */
export type OpeningBalanceDirection = 'debit' | 'credit';

// =============================================================================
// OPENING BALANCE SIGN CONVENTION
// =============================================================================
// `Party.balance` (and `Party.openingBalance`) are signed in the party's
// *natural* direction: a customer with a positive balance owes us, a supplier
// with a positive balance is owed by us. Users, however, think in Debit/Credit,
// and which of those is "positive" flips between the two party types. These
// helpers are the single source of truth for that mapping and are shared by the
// API and the web form so the two can never disagree.

/**
 * The ledger side on which a positive balance sits for the given party type.
 * Customers are receivables (debit), suppliers are payables (credit).
 */
export function naturalDirection(type: PartyType): OpeningBalanceDirection {
  return type === 'customer' ? 'debit' : 'credit';
}

/**
 * Convert a user-entered positive amount plus a direction into the signed value
 * stored in `parties.opening_balance`.
 */
export function toSignedOpeningBalance(
  type: PartyType,
  amount: number,
  direction: OpeningBalanceDirection
): number {
  const magnitude = Math.abs(amount || 0);
  return direction === naturalDirection(type) ? magnitude : -magnitude;
}

/**
 * Inverse of {@link toSignedOpeningBalance} — split a stored signed value back
 * into the positive amount and direction shown in the form.
 */
export function fromSignedOpeningBalance(
  type: PartyType,
  signed: number
): { amount: number; direction: OpeningBalanceDirection } {
  const value = signed || 0;
  const natural = naturalDirection(type);
  const opposite: OpeningBalanceDirection = natural === 'debit' ? 'credit' : 'debit';
  return {
    amount: Math.abs(value),
    direction: value < 0 ? opposite : natural,
  };
}

// =============================================================================
// PARTY ENTITY
// =============================================================================

/**
 * Core Party entity (Customer or Supplier)
 */
export interface Party {
  id: string;
  tenantId: string;
  type: PartyType;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  balance: number;
  /**
   * Balance carried in from before the system was adopted, signed in the
   * party's natural direction (see {@link toSignedOpeningBalance}). Included in
   * `balance`, so the two must never be added together.
   */
  openingBalance: number;
  /** Date the opening balance was outstanding as of; null when it is zero. */
  openingBalanceDate: string | null;
  isActive: boolean;
  notes: string | null;
  /**
   * Phase 4: link to this party's dedicated ledger in the chart of
   * accounts. NULL for pre-Phase-4 rows or tenants without accounting
   * enabled.
   */
  ledgerAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Party with transaction summary
 */
export interface PartyWithSummary extends Party {
  totalInvoiced: number;
  totalPaid: number;
  invoiceCount: number;
  paymentCount: number;
  lastTransactionAt: string | null;
}

/**
 * Party list response with pagination
 */
export interface PartyListResponse {
  parties: Party[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Party balance summary for reports
 */
export interface PartyBalanceSummary {
  partyId: string;
  partyName: string;
  partyType: PartyType;
  openingBalance: number;
  totalInvoiced: number;
  totalReturned: number;
  totalPaid: number;
  currentBalance: number;
}

// =============================================================================
// PAYMENT ENTITY
// =============================================================================

/**
 * Core Payment entity
 */
export interface Payment {
  id: string;
  tenantId: string;
  partyId: string;
  type: PaymentType;
  amount: number;
  currency: string;
  exchangeRate: number;
  paymentMethod: string | null;
  reference: string | null;
  invoiceId: string | null;
  notes: string | null;
  paymentDate: string;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Payment with party details
 */
export interface PaymentWithParty extends Payment {
  party: {
    id: string;
    name: string;
    type: PartyType;
    balance: number;
  };
}

/**
 * Payment with all related data
 */
export interface PaymentWithRelations extends Payment {
  party: {
    id: string;
    name: string;
    type: PartyType;
    email: string | null;
    phone: string | null;
    balance: number;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
  } | null;
  creator?: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
}

/**
 * Payment list response with pagination
 */
export interface PaymentListResponse {
  payments: PaymentWithParty[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a new party
 */
export interface CreatePartyInput {
  type: PartyType;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  /** Positive magnitude as entered by the user; pair with `openingBalanceDirection`. */
  openingBalance?: number | null;
  openingBalanceDirection?: OpeningBalanceDirection;
  /** ISO date (YYYY-MM-DD); required when `openingBalance` is non-zero. */
  openingBalanceDate?: string | null;
}

/**
 * Input for updating a party
 */
export interface UpdatePartyInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  isActive?: boolean;
  notes?: string | null;
  /** Positive magnitude as entered by the user; pair with `openingBalanceDirection`. */
  openingBalance?: number | null;
  openingBalanceDirection?: OpeningBalanceDirection;
  /** ISO date (YYYY-MM-DD); required when `openingBalance` is non-zero. */
  openingBalanceDate?: string | null;
}

/**
 * Input for creating a new payment
 */
export interface CreatePaymentInput {
  partyId: string;
  type: PaymentType;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  /** @deprecated since Phase 3 — use bankAccountId. Retained for legacy callers. */
  paymentMethod?: string | null;
  /** Bank/cash account that the payment flowed through. NULL = generic cash. */
  bankAccountId?: string | null;
  reference?: string | null;
  /** @deprecated since Phase 3 — use allocations[]. The legacy 1:1 invoice pointer; */
  invoiceId?: string | null;
  /** Bill-wise allocations (Phase 3). When provided, takes precedence over invoiceId. */
  allocations?: Array<{ invoice_id: string; amount: number }>;
  notes?: string | null;
  paymentDate?: string;
}

/**
 * Input for updating a payment (limited fields - most payments shouldn't be edited)
 */
export interface UpdatePaymentInput {
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Sort options for party list
 */
export type PartySortField = 'name' | 'balance' | 'createdAt' | 'updatedAt';

/**
 * Sort options for payment list
 */
export type PaymentSortField = 'paymentDate' | 'amount' | 'createdAt';

/**
 * Query parameters for fetching parties
 */
export interface PartyQueryParams {
  /** Filter by party type */
  type?: PartyType;
  /** Search by name, email, phone */
  search?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Filter parties with non-zero balance only */
  hasBalance?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: PartySortField;
  /** Sort direction */
  sortDir?: SortDirection;
}

/**
 * Query parameters for fetching payments
 */
export interface PaymentQueryParams {
  /** Filter by payment type */
  type?: PaymentType;
  /** Filter by party ID */
  partyId?: string;
  /** Filter by invoice ID */
  invoiceId?: string;
  /** Filter by payment method */
  paymentMethod?: string;
  /** Search by reference or notes */
  search?: string;
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  limit?: number;
  /** Sort field */
  sortBy?: PaymentSortField;
  /** Sort direction */
  sortDir?: SortDirection;
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Customer balance report entry
 */
export interface CustomerBalanceReportEntry {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastInvoiceDate: string | null;
  lastPaymentDate: string | null;
}

/**
 * Customer balance report summary
 */
export interface CustomerBalanceReportSummary {
  totalCustomers: number;
  totalReceivable: number;
  totalOverpaid: number;
  netReceivable: number;
}

/**
 * Parameters for customer balance report
 */
export interface CustomerBalanceReportParams {
  /** Filter only customers with balance */
  hasBalance?: boolean;
  /** Filter by minimum balance */
  minBalance?: number;
  /** Filter by maximum balance */
  maxBalance?: number;
  /** Include inactive customers */
  includeInactive?: boolean;
}

/**
 * Customer balance report response
 */
export interface CustomerBalanceReportResponse {
  entries: CustomerBalanceReportEntry[];
  summary: CustomerBalanceReportSummary;
  generatedAt: string;
}

/**
 * Payment report entry
 */
export interface PaymentReportEntry {
  id: string;
  reference: string | null;
  partyName: string;
  partyType: PartyType;
  type: PaymentType;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  paymentDate: string;
  invoiceNumber: string | null;
  notes: string | null;
}

/**
 * Payment report summary
 */
export interface PaymentReportSummary {
  totalPayments: number;
  totalReceived: number;
  totalMade: number;
  netCashFlow: number;
  byMethod: Record<string, { count: number; total: number }>;
}

/**
 * Parameters for payment report
 */
export interface PaymentReportParams {
  /** Filter by payment type */
  type?: PaymentType;
  /** Filter by party ID */
  partyId?: string;
  /** Filter by party type */
  partyType?: PartyType;
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Filter by payment method */
  paymentMethod?: string;
  /** Include summary */
  includeSummary?: boolean;
}

/**
 * Payment report response
 */
export interface PaymentReportResponse {
  entries: PaymentReportEntry[];
  summary?: PaymentReportSummary;
  generatedAt: string;
}

// =============================================================================
// TRANSACTION HISTORY TYPES
// =============================================================================

/**
 * Transaction type for party statement
 */
export type TransactionType = 'invoice' | 'payment' | 'return' | 'opening';

/**
 * Party transaction entry (for statement)
 */
export interface PartyTransaction {
  id: string;
  type: TransactionType;
  date: string;
  reference: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * Party statement (account history)
 */
export interface PartyStatement {
  party: Party;
  openingBalance: number;
  transactions: PartyTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  /**
   * Per-row-type totals for the period. `totalDebits`/`totalCredits` lump the
   * opening-balance row in with real activity, which made "total invoiced" on
   * the party detail page overstate by the opening balance.
   */
  totalInvoiced: number;
  totalPaid: number;
  totalReturns: number;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
}

/**
 * Parameters for party statement
 */
export interface PartyStatementParams {
  partyId: string;
  dateFrom?: string;
  dateTo?: string;
}
