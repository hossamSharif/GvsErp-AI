/**
 * Authentication Middleware
 *
 * Verifies Supabase JWT tokens and extracts user information.
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Permission } from '@erp/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        tenant_id: string;
        role: string;
        permissions: Permission[];
      };
      accessToken?: string;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

/**
 * Verify JWT token and extract user claims
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Create Supabase client to verify token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user from token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Resolve tenant, role, and permissions from the DB (source of truth).
    // JWT user_metadata is kept in sync as a convenience for clients, but the
    // API never trusts it for authorization — it can be stale (signed token)
    // or out of sync after a role change.
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id, is_active, role:roles(name, permissions)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'User profile not found',
      });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Account is deactivated',
      });
      return;
    }

    if (!profile.tenant_id) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'User is not associated with a tenant',
      });
      return;
    }

    const role = Array.isArray(profile.role) ? profile.role[0] : profile.role;
    const permissions: Permission[] = role && Array.isArray(role.permissions)
      ? (role.permissions as Permission[])
      : [];

    req.user = {
      id: user.id,
      email: user.email!,
      tenant_id: profile.tenant_id,
      role: role?.name ?? '',
      permissions,
    };
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Authentication error',
    });
  }
}

/**
 * Optional auth - doesn't fail if no token provided
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  return authMiddleware(req, res, next);
}

/**
 * Check if user has required permission
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    // Check for wildcard permission
    if (req.user.permissions.includes('*' as Permission)) {
      next();
      return;
    }

    // Check for any of the required permissions
    const hasPermission = permissions.some((p) =>
      req.user!.permissions.includes(p)
    );

    if (!hasPermission) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: `Required permission: ${permissions.join(' or ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Alias for authMiddleware for backward compatibility
 */
export const requireAuth = authMiddleware;
