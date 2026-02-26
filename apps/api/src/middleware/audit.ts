/**
 * Audit Middleware
 *
 * Middleware for automatic audit logging of mutation operations (POST, PUT, DELETE).
 * Captures request details and logs them to the audit trail.
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { getTenantContext } from './tenant';
import type { AuditEntityType, AuditAction } from '@erp/shared';

// Extend Express Request to include audit metadata
declare global {
  namespace Express {
    interface Request {
      auditMetadata?: {
        entityType?: AuditEntityType;
        entityId?: string;
        action?: AuditAction;
        oldValues?: Record<string, any>;
      };
    }
  }
}

/**
 * Configuration for route-to-entity mapping
 * Maps API routes to their corresponding entity types
 */
const ROUTE_ENTITY_MAP: Record<string, AuditEntityType> = {
  '/api/v1/items': 'item',
  '/api/v1/categories': 'category',
  '/api/v1/invoices': 'invoice',
  '/api/v1/parties': 'party',
  '/api/v1/payments': 'payment',
  '/api/v1/warehouses': 'warehouse',
  '/api/v1/transfers': 'transfer',
  '/api/v1/expenses': 'expense',
  '/api/v1/pos': 'pos_location',
  '/api/v1/users': 'user',
  '/api/v1/roles': 'role',
  '/api/v1/currencies': 'currency',
  '/api/v1/exchange-rates': 'exchange_rate',
  '/api/v1/settings': 'settings',
  '/api/v1/employees': 'employee',
  '/api/v1/attendance': 'attendance',
  '/api/v1/payroll': 'payroll',
  '/api/v1/accounts': 'account',
  '/api/v1/journal-entries': 'journal_entry',
  '/api/v1/accounting': 'accounting',
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
 * Fields to strip from audit log values to prevent sensitive data leaks
 */
const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'secret', 'token',
  'access_token', 'refresh_token', 'api_key',
];

/**
 * Remove sensitive fields from an object before logging
 */
function sanitizeForAudit(obj: Record<string, any> | null): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
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

  // Skip audit and auth endpoints
  if (req.path.startsWith('/api/v1/audit') || req.path.startsWith('/api/v1/auth')) {
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

  // Store original send function — only override res.send.
  // Express's res.json() internally calls this.send(), so overriding
  // res.send alone correctly intercepts both json and send responses
  // while preserving Content-Type headers set by res.json().
  const originalSend = res.send;

  // Intercept response to log audit trail
  res.send = function (this: Response, body: any): Response {
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

          // Get values to log (sanitized to remove sensitive fields)
          let oldValues = sanitizeForAudit(req.auditMetadata?.oldValues || null);
          let newValues: Record<string, any> | null = null;

          if (action === 'create' || action === 'update') {
            newValues = sanitizeForAudit(req.body || null);
          } else if (action === 'delete') {
            oldValues = sanitizeForAudit(req.body) || oldValues;
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

    // Call original send — preserves Content-Type set by res.json()
    return originalSend.call(this, body);
  };

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
  fetchFunction: (req: Request, id: string) => Promise<any>
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
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
  details?: Record<string, any>
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
      {
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      }
    );
  } catch (error) {
    console.error('Manual audit logging failed:', error);
    // Don't throw - audit logging should not break operations
  }
}
