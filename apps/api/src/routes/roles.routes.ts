/**
 * Roles API Routes
 *
 * RESTful endpoints for role and permission management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import {
  createRoleSchema,
  updateRoleSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create RoleService with tenant context
 */
function getRoleService(req: Request): RoleService {
  const { supabase, tenantId } = getTenantContext(req);
  return new RoleService(supabase, tenantId);
}

// =============================================================================
// ROLE CRUD ENDPOINTS
// =============================================================================

/**
 * GET /roles
 * List roles with pagination and filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const result = await service.getRoles({
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        is_system: req.query.is_system === 'true' ? true : req.query.is_system === 'false' ? false : undefined,
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
 * POST /roles
 * Create a new role
 */
router.post(
  '/',
  requirePermission('roles:write'),
  validateRequest({ body: createRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const role = await service.createRole({
        name: req.body.name,
        permissions: req.body.permissions,
      });

      res.status(201).json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /roles/:id
 * Get a single role by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const role = await service.getRole(req.params.id);

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /roles/:id
 * Update a role
 */
router.put(
  '/:id',
  requirePermission('roles:write'),
  validateRequest({ body: updateRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const role = await service.updateRole(req.params.id, {
        name: req.body.name,
        permissions: req.body.permissions,
      });

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /roles/:id
 * Delete a role
 */
router.delete(
  '/:id',
  requirePermission('roles:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      await service.deleteRole(req.params.id);

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// PERMISSION ENDPOINTS
// =============================================================================

/**
 * PUT /roles/:id/permissions
 * Update role permissions
 */
router.put(
  '/:id/permissions',
  requirePermission('roles:write'),
  validateRequest({
    body: createRoleSchema.pick({ permissions: true }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const role = await service.updatePermissions(req.params.id, req.body.permissions);

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// SYSTEM ROLES ENDPOINTS
// =============================================================================

/**
 * GET /roles/system/list
 * Get all system roles
 */
router.get(
  '/system/list',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const roles = await service.getSystemRoles();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /roles/custom/list
 * Get all custom (non-system) roles
 */
router.get(
  '/custom/list',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getRoleService(req);
      const roles = await service.getCustomRoles();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
