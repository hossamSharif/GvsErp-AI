/**
 * Accounting Module Routes
 *
 * Endpoints for:
 * - Module activation and setup
 * - Financial statements (Trial Balance, Income Statement, Balance Sheet)
 * - General Ledger reports
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AccountingService, type AccountingDefaultRole } from '../services/accounting.service';
import {
  accountingActivationSchema,
  trialBalanceQuerySchema,
  incomeStatementQuerySchema,
  balanceSheetQuerySchema,
  generalLedgerQuerySchema,
  type Account,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const DEFAULT_ROLES: AccountingDefaultRole[] = [
  'cash_in_hand',
  'accounts_receivable',
  'accounts_payable',
  'sales_revenue',
  'sales_tax_payable',
  'inventory_asset',
  'cogs',
  'discount_allowed',
  'discount_received',
  'salary_expense',
  'salary_payable',
  'general_expense',
  'service_purchase_expense',
  'opening_balance_equity',
  'inventory_adjustment',
];

const defaultRoleParamSchema = z.object({
  role: z.enum(DEFAULT_ROLES as [AccountingDefaultRole, ...AccountingDefaultRole[]]),
});

const setDefaultAccountBodySchema = z.object({
  account_id: z.string().uuid(),
});

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create AccountingService with tenant context
 */
function getAccountingService(req: Request): AccountingService {
  const { supabase } = getTenantContext(req);
  return new AccountingService(supabase);
}

/**
 * Helper to get tenant ID and user ID
 */
function getContext(req: Request): { tenantId: string; userId: string } {
  const { tenantId, userId } = getTenantContext(req);
  return { tenantId, userId };
}

// =============================================================================
// MODULE ACTIVATION
// =============================================================================

/**
 * POST /accounting/activate
 * Activate accounting module for tenant
 */
router.post(
  '/activate',
  requirePermission('accounting:write'),
  validateRequest({ body: accountingActivationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { import_default_chart } = req.body;

      let accounts: Account[] = [];

      if (import_default_chart !== false) {
        // Import default chart of accounts
        accounts = await service.importDefaultChartOfAccounts(tenantId);
      }

      // TODO: Save activation settings to tenant settings table
      // - fiscal_year_start
      // - default_accounts mapping

      res.json({
        success: true,
        message: 'Accounting module activated successfully',
        data: {
          accounts_created: accounts.length,
          accounts,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/cogs
 *   Returns { enabled: boolean } — the Phase 5 COGS feature flag.
 * PUT /accounting/cogs  { enabled: boolean }
 *   Flips the flag. Cutover semantics: enabling at time T means sales
 *   finalized after T post COGS; pre-T sales are not retroactively
 *   re-costed.
 */
router.get(
  '/cogs',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const enabled = await service.isCogsEnabled(tenantId);
      res.json({ success: true, data: { enabled } });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/cogs',
  requirePermission('accounting:write'),
  validateRequest({ body: z.object({ enabled: z.boolean() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { enabled } = req.body as { enabled: boolean };
      await service.setCogsEnabled(tenantId, enabled);
      res.json({ success: true, data: { enabled } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/defaults
 * Return the configured default-role -> account_id mapping for this tenant.
 * Used by the Settings page to render the role pickers.
 */
router.get(
  '/defaults',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const defaults = await service.getDefaultAccountIds(tenantId);

      res.json({
        success: true,
        data: {
          roles: DEFAULT_ROLES,
          mapping: defaults,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /accounting/defaults/:role
 * Assign an account to a default role. Validates that the account exists in
 * the tenant's chart of accounts. Body: { account_id: uuid }.
 */
router.put(
  '/defaults/:role',
  requirePermission('accounting:write'),
  validateRequest({
    params: defaultRoleParamSchema,
    body: setDefaultAccountBodySchema,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const role = req.params.role as AccountingDefaultRole;
      const { account_id } = req.body as { account_id: string };

      await service.setDefaultAccount(tenantId, role, account_id);

      res.json({
        success: true,
        message: `Default account for role '${role}' updated`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/status
 * Check if accounting module is activated
 */
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);

      // Check if any accounts exist
      const accounts = await service.listAccounts(tenantId, { limit: 1 });

      const isActivated = accounts.meta.total > 0;

      res.json({
        success: true,
        data: {
          is_activated: isActivated,
          account_count: accounts.meta.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// FINANCIAL STATEMENTS
// =============================================================================

/**
 * GET /accounting/trial-balance
 * Generate trial balance report
 */
router.get(
  '/trial-balance',
  validateRequest({ query: trialBalanceQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { as_of_date } = req.query;

      const trialBalance = await service.generateTrialBalance(
        tenantId,
        as_of_date as string
      );

      res.json({
        success: true,
        data: trialBalance,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/income-statement
 * Generate income statement (profit & loss)
 */
router.get(
  '/income-statement',
  validateRequest({ query: incomeStatementQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { start_date, end_date } = req.query;

      const incomeStatement = await service.generateIncomeStatement(
        tenantId,
        start_date as string,
        end_date as string
      );

      res.json({
        success: true,
        data: incomeStatement,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/balance-sheet
 * Generate balance sheet
 */
router.get(
  '/balance-sheet',
  validateRequest({ query: balanceSheetQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { as_of_date } = req.query;

      const balanceSheet = await service.generateBalanceSheet(
        tenantId,
        as_of_date as string
      );

      res.json({
        success: true,
        data: balanceSheet,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/general-ledger
 * Generate general ledger report for an account
 */
router.get(
  '/general-ledger',
  validateRequest({ query: generalLedgerQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { account_id, start_date, end_date } = req.query;

      const generalLedger = await service.generateGeneralLedger(
        tenantId,
        account_id as string,
        start_date as string,
        end_date as string
      );

      res.json({
        success: true,
        data: generalLedger,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/reports/stock-summary
 *
 * Phase 5: Tally Stock Summary. Qty + value per item, computed from the
 * remaining FIFO layers. Only items with non-zero stock are included.
 */
router.get(
  '/reports/stock-summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const summary = await service.generateStockSummary(tenantId);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/reports/day-book?start_date=&end_date=
 *
 * Phase 6: chronological list of every posted voucher in the period with
 * per-entry debit/credit totals. Tally's daily review surface.
 */
router.get(
  '/reports/day-book',
  validateRequest({
    query: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { start_date, end_date } = req.query as {
        start_date: string;
        end_date: string;
      };
      const dayBook = await service.generateDayBook(tenantId, start_date, end_date);
      res.json({ success: true, data: dayBook });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/reports/daily-journal?date=YYYY-MM-DD
 *
 * Simple owner/manager daily snapshot: the day's final sales, purchases and
 * expenses (totals + line lists), headline KPIs, and current cash & bank
 * balances. Deliberately simpler than the double-entry day book.
 */
router.get(
  '/reports/daily-journal',
  validateRequest({
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { date } = req.query as { date: string };
      const report = await service.generateDailyJournal(tenantId, date);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/reports/user-daily-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 *
 * Per-user breakdown of sales/purchases/payments/expenses for a day or
 * range — NOT real shift tracking. Comparison view across all tenant users.
 */
router.get(
  '/reports/user-daily-summary',
  requirePermission('reports:read'),
  validateRequest({
    query: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { start_date, end_date } = req.query as {
        start_date: string;
        end_date: string;
      };
      const report = await service.generateUserDailySummary(tenantId, start_date, end_date);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/reports/aging-receivables?as_of=YYYY-MM-DD
 * GET /accounting/reports/aging-payables?as_of=YYYY-MM-DD
 *
 * Phase 6: outstanding by party with 0-30 / 31-60 / 61-90 / 90+ buckets.
 * Aggregates each party's open invoices against payment_allocations.
 */
router.get(
  '/reports/aging-receivables',
  validateRequest({
    query: z.object({
      as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { as_of } = req.query as { as_of: string };
      const report = await service.generateAgingReport(tenantId, as_of, 'customer');
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/reports/aging-payables',
  validateRequest({
    query: z.object({
      as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { as_of } = req.query as { as_of: string };
      const report = await service.generateAgingReport(tenantId, as_of, 'supplier');
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /accounting/summary
 * Get accounting summary/dashboard data
 */
router.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);

      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const monthStart = startOfMonth.toISOString().split('T')[0];

      // Get current month income statement
      const incomeStatement = await service.generateIncomeStatement(
        tenantId,
        monthStart,
        today
      );

      // Get balance sheet
      const balanceSheet = await service.generateBalanceSheet(tenantId, today);

      // Get recent journal entries
      const recentEntries = await service.getJournalEntries({
        tenantId,
        limit: 10,
        sort_by: 'entry_date',
        sort_order: 'desc',
      });

      res.json({
        success: true,
        data: {
          current_month_revenue: incomeStatement.total_revenue,
          current_month_expenses: incomeStatement.total_expenses,
          current_month_net_income: incomeStatement.net_income,
          total_assets: balanceSheet.total_assets,
          total_liabilities: balanceSheet.total_liabilities,
          total_equity: balanceSheet.total_equity,
          recent_entries: recentEntries.data,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
