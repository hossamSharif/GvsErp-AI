/**
 * Bank Accounts Routes
 *
 * Endpoints for the first-class bank/cash accounts introduced in plan
 * Phase 3. Each bank is bound 1:1 to a chart-of-accounts ledger; payments
 * route through these accounts instead of free-text payment_method.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BankService } from '../services/bank.service';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

router.use(requireAuth);

function getBankService(req: Request): BankService {
  const { supabase } = getTenantContext(req);
  return new BankService(supabase);
}

function getContext(req: Request) {
  const { tenantId } = getTenantContext(req);
  return { tenantId };
}

// =============================================================================
// Schemas
// =============================================================================

const createBankSchema = z.object({
  name: z.string().min(1).max(255),
  account_number: z.string().max(64).optional(),
  bank_name: z.string().max(255).optional(),
  ledger_account_id: z.string().uuid().optional(),
  opening_balance: z.number().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
});

const updateBankSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  account_number: z.string().max(64).nullable().optional(),
  bank_name: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const statementQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// =============================================================================
// Routes
// =============================================================================

router.get(
  '/',
  requirePermission('accounting:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const banks = await service.listBankAccounts(tenantId);
      res.json({ success: true, data: banks });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  requirePermission('accounting:read'),
  validateRequest({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const bank = await service.getBankAccount(tenantId, req.params.id);
      if (!bank) {
        res.status(404).json({ success: false, error: 'Bank account not found' });
        return;
      }
      res.json({ success: true, data: bank });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  requirePermission('accounting:write'),
  validateRequest({ body: createBankSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const bank = await service.createBankAccount(tenantId, req.body);
      res.status(201).json({ success: true, data: bank });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  requirePermission('accounting:write'),
  validateRequest({ params: idParamSchema, body: updateBankSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const bank = await service.updateBankAccount(tenantId, req.params.id, req.body);
      if (!bank) {
        res.status(404).json({ success: false, error: 'Bank account not found' });
        return;
      }
      res.json({ success: true, data: bank });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  requirePermission('accounting:write'),
  validateRequest({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const ok = await service.deactivateBankAccount(tenantId, req.params.id);
      if (!ok) {
        res.status(404).json({ success: false, error: 'Bank account not found' });
        return;
      }
      res.json({ success: true, message: 'Bank account deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /banks/:id/statement?start_date=&end_date=
 *
 * Bank book / statement for a date range: every journal line hitting this
 * bank's ledger with running balance.
 */
router.get(
  '/:id/statement',
  requirePermission('accounting:read'),
  validateRequest({ params: idParamSchema, query: statementQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getBankService(req);
      const { tenantId } = getContext(req);
      const { start_date, end_date } = req.query as { start_date: string; end_date: string };
      const statement = await service.getBankStatement(
        tenantId,
        req.params.id,
        start_date,
        end_date
      );
      res.json({ success: true, data: statement });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
