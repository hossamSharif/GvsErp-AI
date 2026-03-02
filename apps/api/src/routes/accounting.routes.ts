/**
 * Accounting Module Routes
 *
 * Endpoints for:
 * - Module activation and setup
 * - Financial statements (Trial Balance, Income Statement, Balance Sheet)
 * - General Ledger reports
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AccountingService } from '../services/accounting.service';
import {
  accountingActivationSchema,
  trialBalanceQuerySchema,
  incomeStatementQuerySchema,
  balanceSheetQuerySchema,
  generalLedgerQuerySchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

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
  validateRequest({ body: accountingActivationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { import_default_chart } = req.body;

      let accounts: any[] = [];

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
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_ACTIVATED',
            message: 'Accounting module already activated',
          },
        });
        return;
      }
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
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: error.message,
          },
        });
        return;
      }
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
