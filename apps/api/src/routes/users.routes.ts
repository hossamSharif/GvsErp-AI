/**
 * Users API Routes
 *
 * RESTful endpoints for user management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { UserService, UserError } from '../services/user.service';
import {
  createUserSchema,
  updateUserSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { z } from 'zod';

const router: Router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create UserService with tenant context
 */
function getUserService(req: Request): UserService {
  const { supabase, tenantId } = getTenantContext(req);
  return new UserService(supabase, tenantId);
}

/**
 * Error handler for user-specific errors
 */
function handleUserError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof UserError) {
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
// USER CRUD ENDPOINTS
// =============================================================================

/**
 * GET /users
 * List users with pagination, search, and filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const params = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        roleId: req.query.roleId as string | undefined,
        search: req.query.search as string | undefined,
        includeInactive: req.query.includeInactive === 'true',
      };

      const result = await service.getUsers(params);

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * POST /users
 * Create a new user
 */
router.post(
  '/',
  requirePermission('users:write'),
  validateRequest({ body: createUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.createUser(req.body);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * GET /users/:id
 * Get a single user by ID
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.getUser(req.params.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * PUT /users/:id
 * Update a user
 */
router.put(
  '/:id',
  requirePermission('users:write'),
  validateRequest({ body: updateUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.updateUser(req.params.id, req.body);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * DELETE /users/:id
 * Delete a user (soft delete)
 */
router.delete(
  '/:id',
  requirePermission('users:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      await service.deleteUser(req.params.id);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

// =============================================================================
// USER STATUS ENDPOINTS
// =============================================================================

/**
 * POST /users/:id/activate
 * Activate a user
 */
router.post(
  '/:id/activate',
  requirePermission('users:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.setUserActive(req.params.id, true);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * POST /users/:id/deactivate
 * Deactivate a user
 */
router.post(
  '/:id/deactivate',
  requirePermission('users:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.setUserActive(req.params.id, false);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

// =============================================================================
// USER PREFERENCES ENDPOINTS
// =============================================================================

/**
 * PATCH /users/:id/preferences
 * Update user preferences
 */
router.patch(
  '/:id/preferences',
  validateRequest({
    body: z.object({
      language: z.enum(['en', 'ar']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.updatePreferences(req.params.id, req.body);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

// =============================================================================
// PASSWORD MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * POST /users/:id/change-password
 * Change user password
 */
router.post(
  '/:id/change-password',
  requirePermission('users:write'),
  validateRequest({
    body: z.object({
      password: z.string().min(8).max(100),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      await service.changePassword(req.params.id, req.body.password);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

/**
 * POST /users/send-password-reset
 * Send password reset email
 */
router.post(
  '/send-password-reset',
  validateRequest({
    body: z.object({
      email: z.string().email(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      await service.sendPasswordResetEmail(req.body.email);

      res.json({
        success: true,
        message: 'Password reset email sent',
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

// =============================================================================
// ROLE ASSIGNMENT ENDPOINTS
// =============================================================================

/**
 * PUT /users/:id/role
 * Update user role
 */
router.put(
  '/:id/role',
  requirePermission('users:write'),
  validateRequest({
    body: z.object({
      role_id: z.string().uuid(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getUserService(req);
      const user = await service.updateUserRole(req.params.id, req.body.role_id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      handleUserError(error, res, next);
    }
  }
);

export default router;
