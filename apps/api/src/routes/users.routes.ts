/**
 * Users API Routes
 *
 * RESTful endpoints for user management.
 */

import { Router, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import {
  createUserSchema,
  updateUserSchema,
} from '@erp/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';
import { asyncHandler } from '../middleware/error';
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

// =============================================================================
// SELF-SERVICE ENDPOINTS (must precede /:id routes)
// =============================================================================

const changeOwnPasswordSchema = z
  .object({
    current_password: z.string().min(8).max(72),
    new_password: z
      .string()
      .min(8)
      .max(72)
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  });

/**
 * POST /users/me/change-password
 * Authenticated user changes their own password (verifies current first).
 */
router.post(
  '/me/change-password',
  validateRequest({ body: changeOwnPasswordSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    await service.changeOwnPassword(
      req.user!.id,
      req.user!.email,
      req.body.current_password,
      req.body.new_password
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

// =============================================================================
// USER CRUD ENDPOINTS
// =============================================================================

/**
 * GET /users
 * List users with pagination, search, and filters
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * POST /users
 * Create a new user
 */
router.post(
  '/',
  requirePermission('users:write'),
  validateRequest({ body: createUserSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.createUser(req.body);

    res.status(201).json({
      success: true,
      data: user,
    });
  })
);

/**
 * GET /users/:id
 * Get a single user by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.getUser(req.params.id);

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * PUT /users/:id
 * Update a user
 */
router.put(
  '/:id',
  requirePermission('users:write'),
  validateRequest({ body: updateUserSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.updateUser(req.params.id, req.body);

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * DELETE /users/:id
 * Delete a user (soft delete)
 */
router.delete(
  '/:id',
  requirePermission('users:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    await service.deleteUser(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.setUserActive(req.params.id, true);

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * POST /users/:id/deactivate
 * Deactivate a user
 */
router.post(
  '/:id/deactivate',
  requirePermission('users:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.setUserActive(req.params.id, false);

    res.json({
      success: true,
      data: user,
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.updatePreferences(req.params.id, req.body);

    res.json({
      success: true,
      data: user,
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    await service.changePassword(req.params.id, req.body.password);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    await service.sendPasswordResetEmail(req.body.email);

    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  })
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
  asyncHandler(async (req: Request, res: Response) => {
    const service = getUserService(req);
    const user = await service.updateUserRole(req.params.id, req.body.role_id);

    res.json({
      success: true,
      data: user,
    });
  })
);

export default router;
