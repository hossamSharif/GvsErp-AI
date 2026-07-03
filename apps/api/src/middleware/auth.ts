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

    // Verify the token against Supabase. This is a network call, so a transient
    // connectivity blip (ECONNRESET / connect timeout) must not be mistaken for
    // an invalid token — retry a few times before giving up. auth-js may either
    // throw or return the failure as a retryable `error`, so handle both. Only a
    // genuine auth error (invalid/expired token) or a missing user rejects.
    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
    let authError: { message?: string; status?: number; name?: string } | null = null;
    let networkError: unknown = null;

    const isRetryable = (err: { name?: string; status?: number; message?: string } | null) =>
      !!err &&
      (err.name === 'AuthRetryableFetchError' ||
        err.status === 0 ||
        err.status === undefined ||
        /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT/i.test(err.message ?? ''));

    for (let attempt = 0; attempt < 4; attempt++) {
      networkError = null;
      try {
        const result = await supabase.auth.getUser(token);
        user = result.data.user;
        authError = result.error;
        if (!isRetryable(authError)) break; // Definitive answer (valid or invalid).
        networkError = authError; // Retryable upstream failure — try again.
        authError = null;
      } catch (err) {
        networkError = err; // Transport failure (throw) — try again.
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }

    if (networkError) {
      console.error('Auth verification network failure:', networkError);
      res.status(503).json({
        code: 'AUTH_UPSTREAM_UNAVAILABLE',
        message: 'Could not verify session, please retry',
      });
      return;
    }

    if (authError || !user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Resolve tenant, role, and permissions from the DB (source of truth).
    // JWT user_metadata is kept in sync as a convenience for clients, but the
    // API never trusts it for authorization — it can be stale (signed token)
    // or out of sync after a role change. Like getUser above, this is a network
    // call to Supabase; retry transient failures so a blip doesn't 403 a valid
    // user (a genuinely-missing profile still returns after the retries).
    type ProfileRole = { name?: string; permissions?: unknown };
    type ProfileRow = {
      tenant_id: string | null;
      is_active: boolean | null;
      role: ProfileRole | ProfileRole[] | null;
    };
    let profile: ProfileRow | null = null;
    let profileError: { message?: string; code?: string } | null = null;
    let profileNetworkError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      profileNetworkError = null;
      try {
        const result = await supabase
          .from('users')
          .select('tenant_id, is_active, role:roles(name, permissions)')
          .eq('id', user.id)
          .single();
        profile = (result.data as unknown) as ProfileRow | null;
        profileError = result.error;
        // PGRST116 = no rows; that's a real "not found", not a network blip.
        const transient =
          profileError && profileError.code !== 'PGRST116' &&
          /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|503|502/i.test(
            (profileError.message ?? '') + (profileError.code ?? '')
          );
        if (!transient) break;
        profileNetworkError = profileError;
        profileError = null;
      } catch (err) {
        profileNetworkError = err;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }

    if (profileNetworkError) {
      console.error('Auth profile lookup network failure:', profileNetworkError);
      res.status(503).json({
        code: 'AUTH_UPSTREAM_UNAVAILABLE',
        message: 'Could not verify session, please retry',
      });
      return;
    }

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
