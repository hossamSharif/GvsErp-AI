/**
 * Cost Centers Routes (Phase 7)
 *
 * Endpoints for the parallel reporting dimension layered on top of the
 * chart of accounts. CRUD for categories + centers, plus an allocations
 * setter for tagging individual journal lines, plus a totals report.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CostCenterService } from '../services/cost-center.service';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

router.use(requireAuth);

function getService(req: Request): CostCenterService {
  const { supabase } = getTenantContext(req);
  return new CostCenterService(supabase);
}

function getContext(req: Request) {
  const { tenantId } = getTenantContext(req);
  return { tenantId };
}

const idParamSchema = z.object({ id: z.string().uuid() });

// =============================================================================
// Categories
// =============================================================================

router.get(
  '/categories',
  requirePermission('accounting:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).listCategories(tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/categories',
  requirePermission('accounting:write'),
  validateRequest({
    body: z.object({ name: z.string().min(1).max(255) }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).createCategory(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/categories/:id',
  requirePermission('accounting:write'),
  validateRequest({
    params: idParamSchema,
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      is_active: z.boolean().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).updateCategory(tenantId, req.params.id, req.body);
      if (!data) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/categories/:id',
  requirePermission('accounting:write'),
  validateRequest({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const ok = await getService(req).deleteCategory(tenantId, req.params.id);
      if (!ok) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      res.json({ success: true, message: 'Category deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Centers
// =============================================================================

router.get(
  '/',
  requirePermission('accounting:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).listCenters(tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  requirePermission('accounting:write'),
  validateRequest({
    body: z.object({
      category_id: z.string().uuid(),
      parent_id: z.string().uuid().optional(),
      code: z.string().min(1).max(50),
      name: z.string().min(1).max(255),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).createCenter(tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  requirePermission('accounting:write'),
  validateRequest({
    params: idParamSchema,
    body: z.object({
      category_id: z.string().uuid().optional(),
      parent_id: z.string().uuid().nullable().optional(),
      code: z.string().min(1).max(50).optional(),
      name: z.string().min(1).max(255).optional(),
      is_active: z.boolean().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).updateCenter(tenantId, req.params.id, req.body);
      if (!data) {
        res.status(404).json({ success: false, error: 'Cost center not found' });
        return;
      }
      res.json({ success: true, data });
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
      const { tenantId } = getContext(req);
      const ok = await getService(req).deactivateCenter(tenantId, req.params.id);
      if (!ok) {
        res.status(404).json({ success: false, error: 'Cost center not found' });
        return;
      }
      res.json({ success: true, message: 'Cost center deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Allocations (set per journal line)
// =============================================================================

router.put(
  '/journal-lines/:id/allocations',
  requirePermission('accounting:write'),
  validateRequest({
    params: idParamSchema,
    body: z.object({
      allocations: z.array(
        z.object({
          cost_center_id: z.string().uuid(),
          amount: z.coerce.number().positive(),
        })
      ),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const data = await getService(req).setLineAllocations(
        tenantId,
        req.params.id,
        req.body.allocations
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// Totals report
// =============================================================================

router.get(
  '/reports/totals',
  requirePermission('accounting:read'),
  validateRequest({
    query: z.object({
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getContext(req);
      const { start_date, end_date } = req.query as {
        start_date: string;
        end_date: string;
      };
      const data = await getService(req).getCostCenterTotals(
        tenantId,
        start_date,
        end_date
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
