/**
 * Audit Service
 *
 * Business logic for audit logging including creation, querying, and analysis.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import type { Database } from '@erp/database';
import type {
  AuditLog,
  AuditLogRow,
  AuditLogQueryParams,
  AuditAction,
  AuditEntityType,
} from '@erp/shared';

/**
 * Application error for audit-related operations
 */
export class AuditError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuditError';
  }
}

/**
 * Service for Audit Log business logic
 */
export class AuditService {
  private readonly supabase: SupabaseClient<Database>;
  private readonly tenantId: string;
  private readonly userId: string;

  constructor(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    userId: string
  ) {
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  // ==========================================================================
  // AUDIT LOG CREATION
  // ==========================================================================

  /**
   * Log an action to the audit trail
   */
  async logAction(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string | null = null,
    oldValues: Record<string, any> | null = null,
    newValues: Record<string, any> | null = null,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('log_audit', {
        p_tenant_id: this.tenantId,
        p_user_id: this.userId,
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      });

      if (error) {
        console.error('Failed to log audit entry:', error);
        throw new AuditError('Failed to log audit entry', 'LOG_FAILED', 500);
      }

      return data as string;
    } catch (error) {
      // Don't let audit logging failures break the main operation
      console.error('Audit logging error:', error);
      throw error;
    }
  }

  /**
   * Log a creation action
   */
  async logCreate(
    entityType: AuditEntityType,
    entityId: string,
    values: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    return this.logAction(
      'create',
      entityType,
      entityId,
      null,
      this.sanitizeValues(values),
      context?.ipAddress || null,
      context?.userAgent || null
    );
  }

  /**
   * Log an update action
   */
  async logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    return this.logAction(
      'update',
      entityType,
      entityId,
      this.sanitizeValues(oldValues),
      this.sanitizeValues(newValues),
      context?.ipAddress || null,
      context?.userAgent || null
    );
  }

  /**
   * Log a delete action
   */
  async logDelete(
    entityType: AuditEntityType,
    entityId: string,
    values: Record<string, any>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    return this.logAction(
      'delete',
      entityType,
      entityId,
      this.sanitizeValues(values),
      null,
      context?.ipAddress || null,
      context?.userAgent || null
    );
  }

  /**
   * Log a custom action (finalize, cancel, etc.)
   */
  async logCustomAction(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string | null = null,
    details: Record<string, any> | null = null,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    return this.logAction(
      action,
      entityType,
      entityId,
      null,
      details ? this.sanitizeValues(details) : null,
      context?.ipAddress || null,
      context?.userAgent || null
    );
  }

  // ==========================================================================
  // AUDIT LOG QUERIES
  // ==========================================================================

  /**
   * Get audit logs with pagination and filters
   */
  async getAuditLogs(params: AuditLogQueryParams): Promise<{
    items: AuditLog[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    // Get total count
    const { data: countData, error: countError } = await this.supabase.rpc(
      'count_audit_logs',
      {
        p_tenant_id: this.tenantId,
        p_user_id: params.userId || null,
        p_entity_type: params.entityType || null,
        p_entity_id: params.entityId || null,
        p_action: params.action || null,
        p_date_from: params.dateFrom || null,
        p_date_to: params.dateTo || null,
      }
    );

    if (countError) {
      throw new AuditError('Failed to count audit logs', 'COUNT_FAILED', 500);
    }

    const total = Number(countData || 0);

    // Get audit logs
    const { data, error } = await this.supabase.rpc('get_audit_logs', {
      p_tenant_id: this.tenantId,
      p_user_id: params.userId || null,
      p_entity_type: params.entityType || null,
      p_entity_id: params.entityId || null,
      p_action: params.action || null,
      p_date_from: params.dateFrom || null,
      p_date_to: params.dateTo || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new AuditError('Failed to fetch audit logs', 'FETCH_FAILED', 500);
    }

    const items = ((data || []) as AuditLogRow[]).map((row) => this.mapAuditLog(row));

    return {
      items,
      total,
      page,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(
    entityType: AuditEntityType,
    entityId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const result = await this.getAuditLogs({
      entityType,
      entityId,
      limit,
      page: 1,
    });

    return result.items;
  }

  /**
   * Get recent audit logs for the current user
   */
  async getUserRecentLogs(limit: number = 20): Promise<AuditLog[]> {
    const result = await this.getAuditLogs({
      userId: this.userId,
      limit,
      page: 1,
    });

    return result.items;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Map database row to AuditLog type
   */
  private mapAuditLog(row: AuditLogRow): AuditLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      userEmail: row.user_email || null,
      userName: row.user_name || null,
      action: row.action as AuditAction,
      entityType: row.entity_type as AuditEntityType,
      entityId: row.entity_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
  }

  /**
   * Sanitize values to remove sensitive data before logging
   */
  private sanitizeValues(values: Record<string, any>): Record<string, any> {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'api_key',
      'access_token',
      'refresh_token',
      'private_key',
      'credit_card',
      'ssn',
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(values)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some((field) =>
        lowerKey.includes(field)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Calculate differences between old and new values
   */
  public static calculateDiff(
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
  ): { field: string; oldValue: unknown; newValue: unknown }[] {
    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

    if (!oldValues && !newValues) {
      return changes;
    }

    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);

    for (const key of allKeys) {
      const oldValue = oldValues?.[key];
      const newValue = newValues?.[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }

  // ==========================================================================
  // STATIC HELPER FOR CONTEXT EXTRACTION
  // ==========================================================================

  /**
   * Extract audit context from Express request
   */
  public static extractContext(req: Request): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      ipAddress: this.getClientIp(req),
      userAgent: req.headers?.['user-agent'] || null,
    };
  }

  /**
   * Get client IP address from request
   */
  private static getClientIp(req: Request): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',');
      return ips[0].trim();
    }

    const realIp = req.headers?.['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    return req.connection?.remoteAddress || req.socket?.remoteAddress || null;
  }
}
