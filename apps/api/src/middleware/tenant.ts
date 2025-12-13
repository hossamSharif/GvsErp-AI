/**
 * Tenant Middleware
 *
 * Ensures tenant_id is present and injects it into request context.
 */

import { Request, Response, NextFunction } from 'express';

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
