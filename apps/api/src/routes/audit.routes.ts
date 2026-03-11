/**
 * Audit Logs API Routes
 *
 * RESTful endpoints for audit log management and querying.
 */

import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { AppError, asyncHandler } from '../middleware/error';
import { auditLogQuerySchema } from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import type { AuditLogQueryParams, AuditEntityType } from '@erp/shared';

/** Valid entity types for audit log filtering */
const validEntityTypes = new Set<string>([
  'tenant', 'user', 'role', 'item', 'category', 'warehouse', 'inventory',
  'invoice', 'invoice_item', 'party', 'payment', 'expense', 'expense_category',
  'transfer', 'transfer_item', 'pos_location', 'currency', 'exchange_rate',
  'settings', 'employee', 'attendance', 'payroll', 'account', 'journal_entry', 'accounting',
]);

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create AuditService with tenant context
 */
function getAuditService(req: Request): AuditService {
  const { supabase, tenantId, userId } = getTenantContext(req);
  return new AuditService(supabase, tenantId, userId);
}

// =============================================================================
// AUDIT LOG QUERY ENDPOINTS
// =============================================================================

/**
 * GET /audit-logs
 * Get audit logs with pagination and filters
 */
router.get(
  '/',
  validateRequest({ query: auditLogQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getAuditService(req);
    const params = req.query as unknown as AuditLogQueryParams;

    const result = await service.getAuditLogs(params);

    res.json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
    });
  })
);

/**
 * GET /audit-logs/entity/:entityType/:entityId
 * Get audit logs for a specific entity
 */
router.get(
  '/entity/:entityType/:entityId',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getAuditService(req);
    const { entityType, entityId } = req.params;
    if (!validEntityTypes.has(entityType)) {
      throw AppError.badRequest(`Invalid entity type: ${entityType}`);
    }
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50)) : 50;

    const logs = await service.getEntityAuditLogs(
      entityType as AuditEntityType,
      entityId,
      limit
    );

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * GET /audit-logs/user/recent
 * Get recent audit logs for the current user
 */
router.get(
  '/user/recent',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getAuditService(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const logs = await service.getUserRecentLogs(limit);

    res.json({
      success: true,
      data: logs,
    });
  })
);

/**
 * POST /audit-logs/diff
 * Calculate differences between old and new values
 */
router.post(
  '/diff',
  asyncHandler(async (req: Request, res: Response) => {
    const { oldValues, newValues } = req.body;

    const diff = AuditService.calculateDiff(
      oldValues || null,
      newValues || null
    );

    res.json({
      success: true,
      data: diff,
    });
  })
);

export default router;
