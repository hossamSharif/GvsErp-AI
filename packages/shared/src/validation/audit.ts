/**
 * Zod validation schemas for Audit Log entities
 * @module validation/audit
 */

import { z } from 'zod';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

/**
 * Audit action validation
 */
export const auditActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'finalize',
  'cancel',
  'return',
  'transfer',
  'export',
  'import',
]);

/**
 * Audit entity type validation
 */
export const auditEntityTypeSchema = z.enum([
  'tenant',
  'user',
  'role',
  'item',
  'category',
  'warehouse',
  'inventory',
  'invoice',
  'invoice_item',
  'party',
  'payment',
  'expense',
  'expense_category',
  'transfer',
  'transfer_item',
  'pos_location',
  'currency',
  'exchange_rate',
  'settings',
]);

// =============================================================================
// CREATE AUDIT LOG SCHEMA
// =============================================================================

/**
 * Schema for creating a new audit log entry
 */
export const createAuditLogSchema = z.object({
  action: auditActionSchema,
  entityType: auditEntityTypeSchema,
  entityId: z.string().uuid().nullable().optional(),
  oldValues: z.record(z.any()).nullable().optional(),
  newValues: z.record(z.any()).nullable().optional(),
  ipAddress: z.string().ip().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
});

// =============================================================================
// AUDIT LOG QUERY SCHEMA
// =============================================================================

/**
 * Schema for querying audit logs with filters
 */
export const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  entityType: auditEntityTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  action: auditActionSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// =============================================================================
// AUDIT LOG RESPONSE SCHEMA
// =============================================================================

/**
 * Schema for a single audit log entry response
 */
export const auditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userEmail: z.string().email().nullable().optional(),
  userName: z.string().nullable().optional(),
  action: auditActionSchema,
  entityType: auditEntityTypeSchema,
  entityId: z.string().uuid().nullable(),
  oldValues: z.record(z.any()).nullable(),
  newValues: z.record(z.any()).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// Type exports are in types/audit.ts to avoid duplicate exports
