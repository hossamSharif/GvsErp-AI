/**
 * Authentication Middleware
 *
 * Verifies Supabase JWT tokens and extracts user information.
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { Permission, JWTClaims } from '@erp-saas/shared';
import type { Database } from '@erp-saas/database';

// Extend Express Request type
/* eslint-disable @typescript-eslint/no-namespace */
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
/* eslint-enable @typescript-eslint/no-namespace */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const _SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!; // Reserved for future client-side token validation
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service client for admin operations (bypasses RLS)
 */
function getServiceClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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

    // Use service client to validate token and bypass RLS for user lookup
    const serviceClient = getServiceClient();

    // Get user from token using service client
    const { data: { user }, error } = await serviceClient.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Extract custom claims from user metadata
    const claims = user.user_metadata as Partial<JWTClaims>;

    // Initialize from JWT claims
    let tenantId = claims.tenant_id || '';
    let role = claims.role || '';
    let permissions = (claims.permissions || []) as Permission[];

    // ALWAYS look up from users table to ensure we have the latest data
    // This bypasses RLS since we use service_role key
    const { data: userData, error: userError } = await serviceClient
      .from('users')
      .select('tenant_id, is_active, role:roles(name, permissions)')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('User lookup error:', userError);
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'User profile not found. Please contact support.',
      });
      return;
    }

    if (!userData) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'User profile not found. Please complete registration.',
      });
      return;
    }

    if (!userData.is_active) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Account is deactivated. Please contact support.',
      });
      return;
    }

    if (!userData.tenant_id) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'User is not associated with an organization. Please contact support.',
      });
      return;
    }

    // Use data from users table (authoritative source)
    tenantId = userData.tenant_id;
    if (userData.role) {
      const roleData = userData.role as { name: string; permissions: Permission[] };
      role = roleData.name || role;
      permissions = roleData.permissions || permissions;
    }

    req.user = {
      id: user.id,
      email: user.email!,
      tenant_id: tenantId,
      role: role,
      permissions: permissions,
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
