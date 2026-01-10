/**
 * Data Health Monitoring Service
 *
 * Monitors critical data tables to detect empty states and potential data loss scenarios.
 * Prevents situations like the one identified in COMPREHENSIVE_SYSTEM_AUDIT_2026-01-05.md
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp-saas/database';

export interface DataHealthStatus {
  tenantId: string;
  tenantName: string;
  isHealthy: boolean;
  warnings: string[];
  criticalIssues: string[];
  summary: {
    totalRecords: number;
    emptyTables: string[];
    healthyTables: string[];
  };
  modules: {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    recordCount: number;
    details: string;
  }[];
  recommendations: string[];
  checkedAt: string;
}

interface TableCheck {
  table: string;
  module: string;
  isCritical: boolean;
  warningThreshold: number;
}

const CRITICAL_TABLES: TableCheck[] = [
  { table: 'parties', module: 'CRM', isCritical: true, warningThreshold: 1 },
  { table: 'items', module: 'Inventory', isCritical: true, warningThreshold: 1 },
  { table: 'warehouses', module: 'Inventory', isCritical: true, warningThreshold: 1 },
  { table: 'categories', module: 'Inventory', isCritical: false, warningThreshold: 1 },
  { table: 'invoices', module: 'Sales/Purchases', isCritical: false, warningThreshold: 0 },
  { table: 'payments', module: 'Finance', isCritical: false, warningThreshold: 0 },
  { table: 'inventory', module: 'Inventory', isCritical: false, warningThreshold: 0 },
  { table: 'users', module: 'Core', isCritical: true, warningThreshold: 1 },
];

export class DataHealthService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Perform comprehensive health check for a tenant
   */
  async checkTenantHealth(tenantId: string): Promise<DataHealthStatus> {
    const warnings: string[] = [];
    const criticalIssues: string[] = [];
    const modules: DataHealthStatus['modules'] = [];
    const emptyTables: string[] = [];
    const healthyTables: string[] = [];
    let totalRecords = 0;

    // Get tenant info
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    // Check each critical table
    for (const check of CRITICAL_TABLES) {
      try {
        const { count, error } = await this.supabase
          .from(check.table as any)
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        if (error) {
          criticalIssues.push(`Failed to check ${check.table}: ${error.message}`);
          continue;
        }

        const recordCount = count || 0;
        totalRecords += recordCount;

        // Determine status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        let details = `${recordCount} records found`;

        if (recordCount === 0) {
          emptyTables.push(check.table);
          if (check.isCritical) {
            status = 'critical';
            details = 'No data found - system may not function correctly';
            criticalIssues.push(
              `Critical table "${check.table}" is empty. ${this.getTableGuidance(check.table)}`
            );
          } else {
            status = 'warning';
            details = 'No data found - consider adding data';
            warnings.push(`Table "${check.table}" is empty but not critical yet`);
          }
        } else if (recordCount <= check.warningThreshold && check.isCritical) {
          status = 'warning';
          details = `Only ${recordCount} record(s) - consider adding more data`;
          warnings.push(`Low data in critical table "${check.table}"`);
        } else {
          healthyTables.push(check.table);
        }

        modules.push({
          name: `${check.module} - ${check.table}`,
          status,
          recordCount,
          details,
        });
      } catch (error) {
        criticalIssues.push(`Exception checking ${check.table}: ${error}`);
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      emptyTables,
      warnings.length,
      criticalIssues.length
    );

    const isHealthy = criticalIssues.length === 0 && warnings.length === 0;

    return {
      tenantId,
      tenantName: tenant?.name || 'Unknown Tenant',
      isHealthy,
      warnings,
      criticalIssues,
      summary: {
        totalRecords,
        emptyTables,
        healthyTables,
      },
      modules,
      recommendations,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Quick health check - returns boolean and critical issues only
   */
  async quickHealthCheck(tenantId: string): Promise<{
    isHealthy: boolean;
    criticalIssues: string[];
    emptyTables: string[];
  }> {
    const criticalIssues: string[] = [];
    const emptyTables: string[] = [];

    // Only check critical tables
    const criticalChecks = CRITICAL_TABLES.filter(c => c.isCritical);

    for (const check of criticalChecks) {
      const { count } = await this.supabase
        .from(check.table as any)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if ((count || 0) === 0) {
        emptyTables.push(check.table);
        criticalIssues.push(`Critical table "${check.table}" is empty`);
      }
    }

    return {
      isHealthy: criticalIssues.length === 0,
      criticalIssues,
      emptyTables,
    };
  }

  /**
   * Check all tenants and return list of unhealthy ones
   */
  async scanAllTenants(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    unhealthyTenants: Array<{
      tenantId: string;
      tenantName: string;
      issues: string[];
    }>;
  }> {
    const { data: tenants } = await this.supabase
      .from('tenants')
      .select('id, name');

    if (!tenants) {
      return { total: 0, healthy: 0, unhealthy: 0, unhealthyTenants: [] };
    }

    const unhealthyTenants: Array<{
      tenantId: string;
      tenantName: string;
      issues: string[];
    }> = [];

    for (const tenant of tenants) {
      const check = await this.quickHealthCheck(tenant.id);
      if (!check.isHealthy) {
        unhealthyTenants.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          issues: check.criticalIssues,
        });
      }
    }

    return {
      total: tenants.length,
      healthy: tenants.length - unhealthyTenants.length,
      unhealthy: unhealthyTenants.length,
      unhealthyTenants,
    };
  }

  /**
   * Get specific guidance for empty tables
   */
  private getTableGuidance(table: string): string {
    const guidance: Record<string, string> = {
      parties: 'Add at least one customer or supplier to enable invoicing',
      items: 'Create products/services to sell or purchase',
      warehouses: 'Set up at least one warehouse to track inventory',
      users: 'Ensure at least one user exists for system access',
      categories: 'Create item categories for better organization',
    };

    return guidance[table] || 'Add data to this table to improve system functionality';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    emptyTables: string[],
    warningCount: number,
    criticalCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(
        '🚨 URGENT: Critical data missing. System may not function correctly.',
        'Run the seed script to populate test data: pnpm seed:dev',
        'Or manually create data through the UI'
      );
    }

    if (warningCount > 0) {
      recommendations.push(
        '⚠️ Some modules have low or no data',
        'Consider adding sample data to test all features'
      );
    }

    if (emptyTables.includes('parties')) {
      recommendations.push(
        'Create customers and suppliers in the Parties module',
        'Parties are required for creating invoices and payments'
      );
    }

    if (emptyTables.includes('items')) {
      recommendations.push(
        'Add products/services in the Items module',
        'Items are required for creating invoices'
      );
    }

    if (emptyTables.includes('warehouses')) {
      recommendations.push(
        'Set up warehouses in the Inventory module',
        'Warehouses are required for stock tracking'
      );
    }

    if (emptyTables.length === 0 && warningCount === 0 && criticalCount === 0) {
      recommendations.push(
        '✅ System is healthy with adequate data',
        'Continue normal operations'
      );
    }

    // Always add backup recommendation
    if (criticalCount === 0 && warningCount === 0) {
      recommendations.push(
        'Regular backups recommended to prevent data loss',
        'Consider implementing automated backup strategy'
      );
    }

    return recommendations;
  }

  /**
   * Check if this is a fresh tenant (typical after migration/reset)
   */
  async isFreshTenant(tenantId: string): Promise<boolean> {
    const checks = await Promise.all([
      this.supabase.from('parties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      this.supabase.from('items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      this.supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    return checks.every(result => (result.count || 0) === 0);
  }
}
