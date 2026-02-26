/**
 * Audit Middleware
 *
 * Middleware for automatic audit logging of mutation operations (POST, PUT, DELETE).
 * Captures request details and logs them to the audit trail.
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { getTenantContext } from './tenant';
import type { AuditEntityType, AuditAction } from '@erp-saas/shared';

// Extend Express Request to include audit metadata
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      auditMetadata?: {
        entityType?: AuditEntityType;
        entityId?: string;
        action?: AuditAction;
        oldValues?: Record<string, unknown>;
      };
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Configuration for route-to-entity mapping
 * Maps API routes to their corresponding entity types
 */
const ROUTE_ENTITY_MAP: Record<string, AuditEntityType> = {
  '/api/items': 'item',
  '/api/categories': 'category',
  '/api/invoices': 'invoice',
  '/api/parties': 'party',
  '/api/payments': 'payment',
  '/api/warehouses': 'warehouse',
  '/api/transfers': 'transfer',
  '/api/expenses': 'expense',
  '/api/expense-categories': 'expense_category',
  '/api/pos-locations': 'pos_location',
  '/api/users': 'user',
  '/api/roles': 'role',
  '/api/currencies': 'currency',
  '/api/exchange-rates': 'exchange_rate',
  '/api/settings': 'settings',
};

/**
 * Map HTTP method to audit action
 */
function mapMethodToAction(method: string): AuditAction | null {
  const methodMap: Record<string, AuditAction> = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  return methodMap[method.toUpperCase()] || null;
}

/**
 * Extract entity type from request path
 */
function extractEntityType(path: string): AuditEntityType | null {
  // Check for exact match first
  for (const [route, entityType] of Object.entries(ROUTE_ENTITY_MAP)) {
    if (path.startsWith(route)) {
      return entityType;
    }
  }

  return null;
}


/**
 * Middleware to capture response body for audit logging
 */
export function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only audit mutation operations
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return next();
  }

  // Skip audit endpoint itself
  if (req.path.startsWith('/api/audit')) {
    return next();
  }

  // Extract audit metadata
  const entityType = extractEntityType(req.path);
  if (!entityType) {
    // No mapping found, skip audit logging
    return next();
  }

  const action = mapMethodToAction(method);
  if (!action) {
    return next();
  }

  // Store original send function
  const originalSend = res.send;

  // Intercept response to log audit trail
  const interceptResponse = function (this: Response, body: unknown): Response {
    // Only log successful operations (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Async function to log audit trail
      (async () => {
        try {
          const { supabase, tenantId, userId } = getTenantContext(req);
          const auditService = new AuditService(supabase, tenantId, userId);
          const context = AuditService.extractContext(req);

          // Parse response body if it's a string
          let responseData = body;
          if (typeof body === 'string') {
            try {
              responseData = JSON.parse(body);
            } catch {
              // Not JSON, ignore
            }
          }

          // Extract entity ID from response or params
          let entityId = req.params.id || null;

          // For POST requests, try to get ID from response
          if (action === 'create' && responseData?.data?.id) {
            entityId = responseData.data.id;
          }

          // Get values to log
          let oldValues = req.auditMetadata?.oldValues || null;
          let newValues: Record<string, unknown> | null = null;

          if (action === 'create') {
            newValues = req.body || null;
          } else if (action === 'update') {
            newValues = req.body || null;
          } else if (action === 'delete') {
            oldValues = req.body || oldValues;
          }

          // Log the audit trail
          await auditService.logAction(
            action,
            entityType,
            entityId,
            oldValues,
            newValues,
            context.ipAddress,
            context.userAgent
          );
        } catch (error) {
          // Don't let audit logging failures affect the main operation
          console.error('Audit logging failed:', error);
        }
      })();
    }

    // Call original function
    return originalSend.call(this, body);
  };

  // Override response methods
  res.send = interceptResponse as typeof res.send;
  res.json = function (this: Response, body: unknown): Response {
    return interceptResponse.call(this, JSON.stringify(body));
  } as typeof res.json;

  next();
}

/**
 * Helper middleware to capture old values before update/delete
 * This should be used in routes that need to track changes
 *
 * Usage:
 * router.put('/:id', captureOldValues(getEntityFunction), updateHandler);
 */
export function captureOldValues(
  fetchFunction: (req: Request, id: string) => Promise<Record<string, unknown> | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (!id) {
        return next();
      }

      const oldEntity = await fetchFunction(req, id);
      if (oldEntity) {
        req.auditMetadata = {
          ...req.auditMetadata,
          oldValues: oldEntity,
        };
      }

      next();
    } catch (error) {
      // Don't block the request if we can't fetch old values
      console.error('Failed to capture old values for audit:', error);
      next();
    }
  };
}

/**
 * Helper function to manually log an audit entry
 * Use this for custom actions like finalize, cancel, etc.
 */
export async function logAuditAction(
  req: Request,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const { supabase, tenantId, userId } = getTenantContext(req);
    const auditService = new AuditService(supabase, tenantId, userId);
    const context = AuditService.extractContext(req);

    await auditService.logCustomAction(
      action,
      entityType,
      entityId,
      details || null,
      context
    );
  } catch (error) {
    console.error('Manual audit logging failed:', error);
    // Don't throw - audit logging should not break operations
  }
}
