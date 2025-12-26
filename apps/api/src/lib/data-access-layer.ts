/**
 * Data Access Layer for AI Agent
 * Provides permission-aware data retrieval for AI to answer business questions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';
import type { Permission } from '@erp-saas/shared';

/**
 * User context for permission-aware queries
 */
export interface UserContext {
  userId: string;
  tenantId: string;
  permissions: Permission[];
}

/**
 * Query result with metadata
 */
export interface QueryResult<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

/**
 * Data Access Layer for AI Agent
 * Enforces RLS policies and permission checks
 */
export class DataAccessLayer {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Check if user has specific permission
   */
  private hasPermission(context: UserContext, permission: Permission): boolean {
    return context.permissions.includes(permission);
  }

  /**
   * Get recent sales invoices
   * Requires: sales:read permission
   */
  async getRecentSalesInvoices(
    context: UserContext,
    limit: number = 10
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'sales:read')) {
      throw new Error('Permission denied: sales:read required');
    }

    const { data, count, error } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, type, total, created_at, finalized_at', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('type', 'sale')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get recent purchase invoices
   * Requires: purchases:read permission
   */
  async getRecentPurchaseInvoices(
    context: UserContext,
    limit: number = 10
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'purchases:read')) {
      throw new Error('Permission denied: purchases:read required');
    }

    const { data, count, error } = await this.supabase
      .from('invoices')
      .select('id, invoice_number, type, total, created_at, finalized_at', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get inventory items with stock levels
   * Requires: inventory:read permission
   */
  async getInventoryItems(
    context: UserContext,
    limit: number = 20
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'inventory:read')) {
      throw new Error('Permission denied: inventory:read required');
    }

    const { data, count, error } = await this.supabase
      .from('items')
      .select('id, name, sku, stock_quantity, unit_price, is_active', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get low stock items
   * Requires: inventory:read permission
   */
  async getLowStockItems(
    context: UserContext,
    limit: number = 20
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'inventory:read')) {
      throw new Error('Permission denied: inventory:read required');
    }

    const { data, count, error } = await this.supabase
      .from('items')
      .select('id, name, sku, stock_quantity, low_stock_threshold', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .lte('stock_quantity', this.supabase.rpc('low_stock_threshold'))
      .order('stock_quantity', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get customers (parties with type='customer')
   * Requires: parties:read permission
   */
  async getCustomers(
    context: UserContext,
    limit: number = 20
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'parties:read')) {
      throw new Error('Permission denied: parties:read required');
    }

    const { data, count, error } = await this.supabase
      .from('parties')
      .select('id, name, type, balance, email, phone', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('type', 'customer')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get suppliers (parties with type='supplier')
   * Requires: parties:read permission
   */
  async getSuppliers(
    context: UserContext,
    limit: number = 20
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'parties:read')) {
      throw new Error('Permission denied: parties:read required');
    }

    const { data, count, error } = await this.supabase
      .from('parties')
      .select('id, name, type, balance, email, phone', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('type', 'supplier')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get recent payments
   * Requires: payments:read permission
   */
  async getRecentPayments(
    context: UserContext,
    limit: number = 10
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'payments:read')) {
      throw new Error('Permission denied: payments:read required');
    }

    const { data, count, error } = await this.supabase
      .from('payments')
      .select('id, party_id, amount, payment_method, created_at', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get employees
   * Requires: hr:read permission
   */
  async getEmployees(
    context: UserContext,
    limit: number = 20
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'hr:read')) {
      throw new Error('Permission denied: hr:read required');
    }

    const { data, count, error } = await this.supabase
      .from('employees')
      .select('id, full_name, position, department, salary, is_active', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get chart of accounts
   * Requires: accounting:read permission
   */
  async getChartOfAccounts(
    context: UserContext,
    limit: number = 50
  ): Promise<QueryResult<any>> {
    if (!this.hasPermission(context, 'accounting:read')) {
      throw new Error('Permission denied: accounting:read required');
    }

    const { data, count, error } = await this.supabase
      .from('accounts')
      .select('id, account_number, account_name, account_type, balance', {
        count: 'exact',
      })
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true)
      .order('account_number', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > limit,
    };
  }

  /**
   * Get sales summary for a period
   * Requires: sales:read permission
   */
  async getSalesSummary(
    context: UserContext,
    startDate: string,
    endDate: string
  ): Promise<{ totalSales: number; totalInvoices: number }> {
    if (!this.hasPermission(context, 'sales:read')) {
      throw new Error('Permission denied: sales:read required');
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .select('total')
      .eq('tenant_id', context.tenantId)
      .eq('type', 'sale')
      .eq('status', 'final')
      .gte('finalized_at', startDate)
      .lte('finalized_at', endDate);

    if (error) throw error;

    const totalSales = (data || []).reduce(
      (sum, invoice) => sum + (invoice.total || 0),
      0
    );

    return {
      totalSales,
      totalInvoices: data?.length || 0,
    };
  }

  /**
   * Sanitize data before sending to AI
   * Removes sensitive fields
   */
  sanitizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };

      // Remove sensitive fields
      const sensitiveFields = [
        'password',
        'api_key',
        'secret',
        'token',
        'card_number',
        'cvv',
        'ssn',
      ];

      sensitiveFields.forEach((field) => {
        delete sanitized[field];
      });

      return sanitized;
    }

    return data;
  }

  /**
   * Build context summary for AI
   * Provides overview of available data based on permissions
   */
  async buildContextSummary(context: UserContext): Promise<string> {
    const summaryParts: string[] = [];

    // Check what data user can access
    const accessibleData: string[] = [];

    if (this.hasPermission(context, 'sales:read')) {
      accessibleData.push('Sales invoices');
    }
    if (this.hasPermission(context, 'purchases:read')) {
      accessibleData.push('Purchase invoices');
    }
    if (this.hasPermission(context, 'inventory:read')) {
      accessibleData.push('Inventory items and stock levels');
    }
    if (this.hasPermission(context, 'parties:read')) {
      accessibleData.push('Customers and suppliers');
    }
    if (this.hasPermission(context, 'payments:read')) {
      accessibleData.push('Payment records');
    }
    if (this.hasPermission(context, 'hr:read')) {
      accessibleData.push('Employee data');
    }
    if (this.hasPermission(context, 'accounting:read')) {
      accessibleData.push('Accounting records');
    }

    summaryParts.push(
      `You have access to: ${accessibleData.join(', ') || 'No data access permissions'}`
    );

    return summaryParts.join('\n');
  }
}
