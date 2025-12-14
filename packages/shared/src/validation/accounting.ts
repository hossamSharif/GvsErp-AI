// Zod Validation Schemas for Accounting Module
import { z } from 'zod';

// Account type enum
export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);

// Account validation schemas
export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  type: accountTypeSchema,
  parent_id: z.string().uuid().optional(),
});

export const updateAccountSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  type: accountTypeSchema.optional(),
  parent_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

// Journal line validation
export const createJournalLineSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().nonnegative().optional().default(0),
  credit: z.number().nonnegative().optional().default(0),
  description: z.string().max(500).optional(),
}).refine(
  (data) => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  {
    message: 'Either debit or credit must be greater than 0, but not both',
  }
);

// Journal entry validation schemas
export const createJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format
  description: z.string().max(500).optional(),
  lines: z.array(createJournalLineSchema).min(2), // Must have at least 2 lines (debit and credit)
}).refine(
  (data) => {
    // Validate that total debits equal total credits
    const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for minor rounding differences
  },
  {
    message: 'Total debits must equal total credits',
  }
);

export const updateJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(500).optional(),
  lines: z.array(createJournalLineSchema).min(2).optional(),
}).refine(
  (data) => {
    // If lines are provided, validate balance
    if (data.lines) {
      const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    }
    return true;
  },
  {
    message: 'Total debits must equal total credits',
  }
);

// Activation wizard validation
export const accountingActivationSchema = z.object({
  fiscal_year_start: z.string().regex(/^\d{2}-\d{2}$/), // MM-DD format
  default_accounts: z.object({
    cash_account_id: z.string().uuid().optional(),
    accounts_receivable_id: z.string().uuid().optional(),
    accounts_payable_id: z.string().uuid().optional(),
    inventory_asset_id: z.string().uuid().optional(),
    sales_revenue_id: z.string().uuid().optional(),
    cogs_expense_id: z.string().uuid().optional(),
  }),
  import_default_chart: z.boolean().optional().default(true),
});

// Financial statement filters
export const trialBalanceQuerySchema = z.object({
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const incomeStatementQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.start_date) <= new Date(data.end_date),
  {
    message: 'start_date must be before or equal to end_date',
  }
);

export const balanceSheetQuerySchema = z.object({
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const cashFlowQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.start_date) <= new Date(data.end_date),
  {
    message: 'start_date must be before or equal to end_date',
  }
);

export const generalLedgerQuerySchema = z.object({
  account_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(
  (data) => new Date(data.start_date) <= new Date(data.end_date),
  {
    message: 'start_date must be before or equal to end_date',
  }
);

// Export all schemas
export const accountingValidation = {
  createAccount: createAccountSchema,
  updateAccount: updateAccountSchema,
  createJournalEntry: createJournalEntrySchema,
  updateJournalEntry: updateJournalEntrySchema,
  accountingActivation: accountingActivationSchema,
  trialBalanceQuery: trialBalanceQuerySchema,
  incomeStatementQuery: incomeStatementQuerySchema,
  balanceSheetQuery: balanceSheetQuerySchema,
  cashFlowQuery: cashFlowQuerySchema,
  generalLedgerQuery: generalLedgerQuerySchema,
};
