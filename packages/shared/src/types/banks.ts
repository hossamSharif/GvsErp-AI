/**
 * Bank account and bill-wise allocation types (plan Phase 3).
 *
 * A bank account is a first-class entity that owns a ledger in the chart of
 * accounts; payments flow through it instead of through a free-text
 * payment_method string.
 *
 * Payment allocations map a single payment to one or more invoices it
 * clears — Tally's "bill-wise details" feature.
 */

export interface BankAccount {
  id: string;
  tenant_id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  /** 1:1 link to the chart-of-accounts ledger that records this bank's transactions */
  ledger_account_id: string;
  opening_balance: number;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccountWithLedger extends BankAccount {
  ledger?: {
    id: string;
    code: string;
    name: string;
    balance: number;
  };
}

export interface CreateBankAccountInput {
  name: string;
  account_number?: string;
  bank_name?: string;
  /**
   * If omitted, the service auto-creates a ledger under group "Current
   * Assets" with the next available code in the 11xx range.
   */
  ledger_account_id?: string;
  opening_balance?: number;
  currency?: string;
  notes?: string;
}

export interface UpdateBankAccountInput {
  name?: string;
  account_number?: string | null;
  bank_name?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface PaymentAllocation {
  id: string;
  tenant_id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  allocated_at: string;
}

/** Input shape for a single allocation when creating a payment */
export interface PaymentAllocationInput {
  invoice_id: string;
  amount: number;
}

/**
 * Outstanding invoice from the party's perspective — what's still owed.
 * Used by the bill-wise picker on the payment form.
 */
export interface OutstandingInvoice {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  allocated: number;
  outstanding: number;
  days_outstanding: number;
}
