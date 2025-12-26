/**
 * Tenant Middleware
 *
 * Ensures tenant_id is present and injects it into request context.
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import { AppError } from './error';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

/**
 * Extract and validate tenant_id from authenticated user
 */
export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return;
  }

  if (!req.user.tenant_id) {
    res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Tenant context required',
    });
    return;
  }

  req.tenantId = req.user.tenant_id;
  next();
}

/**
 * Verify user belongs to specified tenant (for cross-tenant operations)
 */
export function verifyTenantAccess(paramName: string = 'tenantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestedTenantId = req.params[paramName];

    if (!req.user || !req.tenantId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (requestedTenantId && requestedTenantId !== req.tenantId) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Access denied to this tenant',
      });
      return;
    }

    next();
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get tenant context helper for creating service instances
 * Uses service role key to bypass RLS since tenant isolation is enforced by the API layer
 */
export function getTenantContext(req: Request): {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  userId: string;
} {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  if (!req.user.tenant_id) {
    throw AppError.forbidden('User is not associated with a tenant. Please contact support.');
  }

  // Use service role to bypass RLS - tenant isolation is enforced by API layer
  // via tenantId parameter passed to all repository methods
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    supabase,
    tenantId: req.user.tenant_id,
    userId: req.user.id,
  };
}
