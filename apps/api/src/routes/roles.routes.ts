/**
 * Roles API Routes
 *
 * RESTful endpoints for role and permission management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RoleRepository } from '../repositories/role.repository';
import {
  createRoleSchema,
  updateRoleSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create RoleRepository with tenant context
 */
function getRoleRepository(req: Request): RoleRepository {
  const { supabase } = getTenantContext(req);
  return new RoleRepository(supabase);
}

/**
 * Application error for role-related operations
 */
class RoleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'RoleError';
  }
}

/**
 * Error handler for role-specific errors
 */
function handleRoleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof RoleError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }
  next(error);
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
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);

      const params = {
        tenantId,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        is_system: req.query.is_system === 'true' ? true : req.query.is_system === 'false' ? false : undefined,
      };

      const result = await repository.findAllRoles(params);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleRoleError(error, res, next);
    }
  }
);

/**
 * POST /roles
 * Create a new role
 */
router.post(
  '/',
  validateRequest({ body: createRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);

      // Check if role name already exists
      const nameExists = await repository.nameExists(tenantId, req.body.name);
      if (nameExists) {
        throw new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
      }

      const roleData = {
        name: req.body.name,
        permissions: req.body.permissions,
        is_system: false,
      };

      const role = await repository.create(tenantId, roleData);

      res.status(201).json({
        success: true,
        data: role,
      });
    } catch (error) {
      handleRoleError(error, res, next);
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
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);
      const role = await repository.findById(tenantId, req.params.id);

      if (!role) {
        throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      handleRoleError(error, res, next);
    }
  }
);

/**
 * PUT /roles/:id
 * Update a role
 */
router.put(
  '/:id',
  validateRequest({ body: updateRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);

      // Check if role exists
      const existing = await repository.findById(tenantId, req.params.id);
      if (!existing) {
        throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
      }

      // Prevent modifying system roles
      if (existing.is_system) {
        throw new RoleError('Cannot modify system roles', 'SYSTEM_ROLE');
      }

      // Check if new name conflicts with existing role
      if (req.body.name && req.body.name !== existing.name) {
        const nameExists = await repository.nameExists(tenantId, req.body.name, req.params.id);
        if (nameExists) {
          throw new RoleError('A role with this name already exists', 'ROLE_NAME_EXISTS');
        }
      }

      const updates: any = {};
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.permissions !== undefined) updates.permissions = req.body.permissions;

      const role = await repository.update(tenantId, req.params.id, updates);

      if (!role) {
        throw new RoleError('Failed to update role', 'UPDATE_FAILED', 500);
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      handleRoleError(error, res, next);
    }
  }
);

/**
 * DELETE /roles/:id
 * Delete a role
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);

      // Check if role can be deleted
      const { canDelete, reason } = await repository.canDelete(tenantId, req.params.id);

      if (!canDelete) {
        throw new RoleError(reason || 'Cannot delete role', 'CANNOT_DELETE');
      }

      const deleted = await repository.delete(tenantId, req.params.id);

      if (!deleted) {
        throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
      }

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error) {
      handleRoleError(error, res, next);
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
  validateRequest({
    body: createRoleSchema.pick({ permissions: true }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);

      const role = await repository.updatePermissions(
        tenantId,
        req.params.id,
        req.body.permissions
      );

      if (!role) {
        throw new RoleError('Role not found', 'ROLE_NOT_FOUND', 404);
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error) {
      handleRoleError(error, res, next);
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
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);
      const roles = await repository.getSystemRoles(tenantId);

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      handleRoleError(error, res, next);
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
      const { tenantId } = getTenantContext(req);
      const repository = getRoleRepository(req);
      const roles = await repository.getCustomRoles(tenantId);

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      handleRoleError(error, res, next);
    }
  }
);

export default router;
