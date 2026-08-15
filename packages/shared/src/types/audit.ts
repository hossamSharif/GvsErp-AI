/**
 * Audit Log Types
 *
 * Type definitions for the audit logging system.
 */

// =============================================================================
// AUDIT LOG ACTIONS
// =============================================================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'finalize'
  | 'cancel'
  | 'return'
  | 'transfer'
  | 'export'
  | 'import';

// =============================================================================
// AUDIT LOG ENTITY TYPES
// =============================================================================

export type AuditEntityType =
  | 'tenant'
  | 'user'
  | 'role'
  | 'item'
  | 'category'
  | 'warehouse'
  | 'inventory'
  | 'invoice'
  | 'invoice_item'
  | 'party'
  | 'payment'
  | 'expense'
  | 'expense_category'
  | 'transfer'
  | 'transfer_item'
  | 'settlement'
  | 'settlement_item'
  | 'pos_location'
  | 'currency'
  | 'exchange_rate'
  | 'settings'
  | 'employee'
  | 'attendance'
  | 'payroll'
  | 'account'
  | 'journal_entry'
  | 'accounting'
  | 'bank_account'
  | 'cost_category'
  | 'cost_center'
  | 'cost_allocation'
  | 'accounting_default';

// =============================================================================
// AUDIT LOG ENTITY
// =============================================================================

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// =============================================================================
// DATABASE ROW TYPE
// =============================================================================

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// =============================================================================
// QUERY PARAMETERS
// =============================================================================

export interface AuditLogQueryParams {
  userId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// =============================================================================
// CREATE AUDIT LOG INPUT
// =============================================================================

export interface CreateAuditLogInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// =============================================================================
// AUDIT LOG SUMMARY
// =============================================================================

export interface AuditLogSummary {
  totalLogs: number;
  actionBreakdown: {
    action: AuditAction;
    count: number;
  }[];
  entityTypeBreakdown: {
    entityType: AuditEntityType;
    count: number;
  }[];
  userBreakdown: {
    userId: string;
    userEmail: string;
    userName: string | null;
    count: number;
  }[];
  dateRange: {
    earliest: string;
    latest: string;
  };
}

// =============================================================================
// AUDIT LOG DIFF
// =============================================================================

export interface AuditLogDiff {
  field: string;
  oldValue: any;
  newValue: any;
  changed: boolean;
}

// =============================================================================
// AUDIT LOG CONTEXT
// =============================================================================

/**
 * Context information for creating audit logs
 * This is extracted from the request in middleware
 */
export interface AuditContext {
  tenantId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}
