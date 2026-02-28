/**
 * Journal Entries API Routes
 *
 * RESTful endpoints for journal entry management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AccountingService } from '../services/accounting.service';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
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
// JOURNAL ENTRY CRUD ENDPOINTS
// =============================================================================

/**
 * GET /journal-entries
 * List journal entries with filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const {
        start_date,
        end_date,
        is_posted,
        source_type,
        account_id,
        page = '1',
        limit = '50',
        sort_by = 'entry_date',
        sort_order = 'desc',
      } = req.query;

      const result = await service['journalRepo'].findAll({
        tenantId,
        start_date: start_date as string,
        end_date: end_date as string,
        is_posted: is_posted === 'true' ? true : is_posted === 'false' ? false : undefined,
        source_type: source_type as string,
        account_id: account_id as string,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sort_by: sort_by as string,
        sort_order: sort_order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /journal-entries/:id
 * Get journal entry by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const entry = await service['journalRepo'].findById(tenantId, id);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ENTRY_NOT_FOUND',
            message: 'Journal entry not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /journal-entries
 * Create new journal entry
 */
router.post(
  '/',
  validateRequest({ body: createJournalEntrySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId, userId } = getContext(req);

      const entry = await service.createJournalEntry(tenantId, userId, req.body);

      res.status(201).json({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      if (
        error.message.includes('not found') ||
        error.message.includes('must be balanced')
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
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
 * PUT /journal-entries/:id
 * Update journal entry (only if not posted)
 */
router.put(
  '/:id',
  validateRequest({ body: updateJournalEntrySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const entry = await service.updateJournalEntry(tenantId, id, req.body);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ENTRY_NOT_FOUND',
            message: 'Journal entry not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      if (
        error.message.includes('Cannot update') ||
        error.message.includes('not found') ||
        error.message.includes('must be balanced')
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
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
 * POST /journal-entries/:id/post
 * Post journal entry (finalize)
 */
router.post(
  '/:id/post',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      const entry = await service.postJournalEntry(tenantId, id);

      if (!entry) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ENTRY_NOT_FOUND',
            message: 'Journal entry not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: entry,
        message: 'Journal entry posted successfully',
      });
    } catch (error: any) {
      if (error.message.includes('must be balanced')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
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
 * DELETE /journal-entries/:id
 * Delete journal entry (only if not posted)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAccountingService(req);
      const { tenantId } = getContext(req);
      const { id } = req.params;

      await service.deleteJournalEntry(tenantId, id);

      res.json({
        success: true,
        message: 'Journal entry deleted successfully',
      });
    } catch (error: any) {
      if (error.message.includes('Cannot delete')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE',
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
);

export default router;
