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
   * Sanitize sensitive data before sending to AI
   * Removes passwords, API keys, payment details, etc.
   * Implements FR-008 data sanitization requirements
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    // Handle non-objects
    if (typeof data !== 'object') {
      return data;
    }

    // List of sensitive field patterns to remove/redact
    const sensitiveFields = [
      'password',
      'password_hash',
      'secret',
      'api_key',
      'apiKey',
      'token',
      'access_token',
      'refresh_token',
      'credit_card',
      'creditCard',
      'card_number',
      'cardNumber',
      'cvv',
      'cvc',
      'ssn',
      'social_security',
      'tax_id',
      'taxId',
      'pin',
      'private_key',
      'privateKey',
      'auth_token',
      'authToken',
    ];

    const result: any = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeData(value);
      } else {
        result[key] = value;
      }
    }

    return result;
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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
      data: this.sanitizeData(data || []),
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

  /**
   * Get marketing-focused data (sales trends, customer insights, product performance)
   * Optimized for marketing consultant role
   * Requires: sales:read, parties:read, inventory:read permissions
   */
  async getMarketingData(
    context: UserContext,
    periodDays: number = 30
  ): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const data: any = {};

    // Top customers by revenue (if permitted)
    if (this.hasPermission(context, 'sales:read') && this.hasPermission(context, 'parties:read')) {
      const { data: topCustomers } = await this.supabase
        .from('invoices')
        .select('party_id, total')
        .eq('tenant_id', context.tenantId)
        .eq('type', 'sale')
        .eq('status', 'final')
        .gte('finalized_at', startDate.toISOString())
        .order('total', { ascending: false })
        .limit(10);

      data.topCustomers = topCustomers;
    }

    // Best selling items (if permitted)
    if (this.hasPermission(context, 'sales:read') && this.hasPermission(context, 'inventory:read')) {
      // This would require a join with invoice_items table
      // Simplified version for now
      data.salesTrend = await this.getSalesSummary(
        context,
        startDate.toISOString(),
        new Date().toISOString()
      );
    }

    return this.sanitizeData(data);
  }

  /**
   * Get financial analyst data (KPIs, ratios, profitability)
   * Optimized for financial analyst role
   * Requires: accounting:read, sales:read, purchases:read permissions
   */
  async getFinancialData(
    context: UserContext,
    periodDays: number = 30
  ): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const data: any = {};

    // Revenue and expenses
    if (this.hasPermission(context, 'sales:read')) {
      data.revenue = await this.getSalesSummary(
        context,
        startDate.toISOString(),
        new Date().toISOString()
      );
    }

    if (this.hasPermission(context, 'purchases:read')) {
      const { data: purchases } = await this.supabase
        .from('invoices')
        .select('total')
        .eq('tenant_id', context.tenantId)
        .eq('type', 'purchase')
        .eq('status', 'final')
        .gte('finalized_at', startDate.toISOString());

      const totalExpenses = (purchases || []).reduce(
        (sum, inv) => sum + (inv.total || 0),
        0
      );

      data.expenses = {
        totalExpenses,
        totalInvoices: purchases?.length || 0,
      };
    }

    // Account balances
    if (this.hasPermission(context, 'accounting:read')) {
      const { data: accounts } = await this.supabase
        .from('accounts')
        .select('account_type, balance')
        .eq('tenant_id', context.tenantId)
        .eq('is_active', true);

      data.accountBalances = accounts;
    }

    return this.sanitizeData(data);
  }

  /**
   * Get customer service data (orders, pending items, customer issues)
   * Optimized for customer service role
   * Requires: sales:read, parties:read, inventory:read permissions
   */
  async getCustomerServiceData(
    context: UserContext,
    limit: number = 20
  ): Promise<any> {
    const data: any = {};

    // Recent orders
    if (this.hasPermission(context, 'sales:read')) {
      const { data: recentOrders } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, party_id, total, status, created_at')
        .eq('tenant_id', context.tenantId)
        .eq('type', 'sale')
        .order('created_at', { ascending: false })
        .limit(limit);

      data.recentOrders = recentOrders;
    }

    // Customer information
    if (this.hasPermission(context, 'parties:read')) {
      data.customers = await this.getCustomers(context, limit);
    }

    // Stock availability
    if (this.hasPermission(context, 'inventory:read')) {
      data.inventory = await this.getInventoryItems(context, limit);
    }

    return this.sanitizeData(data);
  }

  /**
   * Get legal compliance data (audit trails, tax records, documentation)
   * Optimized for legal consultant role
   * Requires: accounting:read, sales:read, purchases:read permissions
   */
  async getLegalComplianceData(
    context: UserContext,
    limit: number = 20
  ): Promise<any> {
    const data: any = {};

    // Recent transactions for audit trail
    if (this.hasPermission(context, 'sales:read')) {
      const { data: salesInvoices } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, type, total, tax_amount, status, finalized_at')
        .eq('tenant_id', context.tenantId)
        .eq('type', 'sale')
        .order('finalized_at', { ascending: false })
        .limit(limit);

      data.recentSales = salesInvoices;
    }

    if (this.hasPermission(context, 'purchases:read')) {
      const { data: purchaseInvoices } = await this.supabase
        .from('invoices')
        .select('id, invoice_number, type, total, tax_amount, status, finalized_at')
        .eq('tenant_id', context.tenantId)
        .eq('type', 'purchase')
        .order('finalized_at', { ascending: false })
        .limit(limit);

      data.recentPurchases = purchaseInvoices;
    }

    // Accounting records for compliance
    if (this.hasPermission(context, 'accounting:read')) {
      const { data: journalEntries } = await this.supabase
        .from('journal_entries')
        .select('id, entry_number, entry_date, description, total_debit, total_credit')
        .eq('tenant_id', context.tenantId)
        .order('entry_date', { ascending: false })
        .limit(limit);

      data.recentJournalEntries = journalEntries;
    }

    return this.sanitizeData(data);
  }
}
