/**
 * Alerts Service
 *
 * Service for managing low stock alerts and notifications.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { InventoryRepository } from '../repositories/inventory.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import type {
  LowStockAlert,
  LowStockSummary,
} from '@erp/shared';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'low';

/**
 * Alert with severity
 */
export interface LowStockAlertWithSeverity extends LowStockAlert {
  severity: AlertSeverity;
}

/**
 * Alerts service for low stock monitoring
 */
export class AlertsService {
  private readonly inventoryRepo: InventoryRepository;
  private readonly warehouseRepo: WarehouseRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.inventoryRepo = new InventoryRepository(supabase);
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * Determine alert severity based on percentage of threshold
   */
  private getSeverity(percentOfThreshold: number): AlertSeverity {
    if (percentOfThreshold < 25) {
      return 'critical';
    } else if (percentOfThreshold < 50) {
      return 'warning';
    }
    return 'low';
  }

  /**
   * Get all low stock alerts with severity
   */
  async getLowStockAlerts(
    warehouseId?: string,
    severity?: AlertSeverity
  ): Promise<LowStockAlertWithSeverity[]> {
    const alerts = await this.inventoryRepo.getLowStockAlerts(this.tenantId, warehouseId);

    const alertsWithSeverity: LowStockAlertWithSeverity[] = alerts.map(alert => ({
      ...alert,
      severity: this.getSeverity(alert.percentOfThreshold),
    }));

    // Filter by severity if specified
    if (severity) {
      return alertsWithSeverity.filter(a => a.severity === severity);
    }

    return alertsWithSeverity;
  }

  /**
   * Get low stock summary with severity breakdown
   */
  async getLowStockSummary(): Promise<LowStockSummary> {
    const alerts = await this.getLowStockAlerts();

    let criticalCount = 0;
    let warningCount = 0;
    let lowCount = 0;

    const byWarehouse = new Map<string, { name: string; count: number }>();

    for (const alert of alerts) {
      switch (alert.severity) {
        case 'critical':
          criticalCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'low':
          lowCount++;
          break;
      }

      const existing = byWarehouse.get(alert.warehouseId);
      if (existing) {
        existing.count++;
      } else {
        byWarehouse.set(alert.warehouseId, {
          name: alert.warehouseName,
          count: 1,
        });
      }
    }

    return {
      totalAlerts: alerts.length,
      criticalCount,
      warningCount,
      lowCount,
      byWarehouse: Array.from(byWarehouse.entries()).map(([id, data]) => ({
        warehouseId: id,
        warehouseName: data.name,
        alertCount: data.count,
      })),
    };
  }

  /**
   * Get critical alerts only (< 25% of threshold)
   */
  async getCriticalAlerts(warehouseId?: string): Promise<LowStockAlertWithSeverity[]> {
    return this.getLowStockAlerts(warehouseId, 'critical');
  }

  /**
   * Get warning alerts only (25-50% of threshold)
   */
  async getWarningAlerts(warehouseId?: string): Promise<LowStockAlertWithSeverity[]> {
    return this.getLowStockAlerts(warehouseId, 'warning');
  }

  /**
   * Check if any critical alerts exist
   */
  async hasCriticalAlerts(warehouseId?: string): Promise<boolean> {
    const criticalAlerts = await this.getCriticalAlerts(warehouseId);
    return criticalAlerts.length > 0;
  }

  /**
   * Get alert counts by warehouse
   */
  async getAlertCountsByWarehouse(): Promise<Array<{
    warehouseId: string;
    warehouseName: string;
    criticalCount: number;
    warningCount: number;
    lowCount: number;
    totalCount: number;
  }>> {
    const alerts = await this.getLowStockAlerts();
    const warehouses = await this.warehouseRepo.getActiveWarehouses(this.tenantId);

    const countsByWarehouse = new Map<string, {
      name: string;
      critical: number;
      warning: number;
      low: number;
    }>();

    // Initialize all warehouses
    for (const warehouse of warehouses) {
      countsByWarehouse.set(warehouse.id, {
        name: warehouse.name,
        critical: 0,
        warning: 0,
        low: 0,
      });
    }

    // Count alerts by severity and warehouse
    for (const alert of alerts) {
      const counts = countsByWarehouse.get(alert.warehouseId);
      if (counts) {
        switch (alert.severity) {
          case 'critical':
            counts.critical++;
            break;
          case 'warning':
            counts.warning++;
            break;
          case 'low':
            counts.low++;
            break;
        }
      }
    }

    return Array.from(countsByWarehouse.entries()).map(([id, data]) => ({
      warehouseId: id,
      warehouseName: data.name,
      criticalCount: data.critical,
      warningCount: data.warning,
      lowCount: data.low,
      totalCount: data.critical + data.warning + data.low,
    }));
  }

  /**
   * Get items that need immediate attention (out of stock or critical)
   */
  async getUrgentItems(warehouseId?: string): Promise<LowStockAlertWithSeverity[]> {
    const alerts = await this.getLowStockAlerts(warehouseId);

    // Return items that are out of stock (quantity = 0) or critical
    return alerts.filter(alert =>
      alert.quantity === 0 || alert.severity === 'critical'
    );
  }

  /**
   * Get suggested reorder quantities
   * Based on threshold and current quantity
   */
  async getSuggestedReorders(warehouseId?: string): Promise<Array<{
    itemId: string;
    itemName: string;
    itemSku: string | null;
    warehouseId: string;
    warehouseName: string;
    currentQuantity: number;
    threshold: number;
    suggestedQuantity: number;
    severity: AlertSeverity;
  }>> {
    const alerts = await this.getLowStockAlerts(warehouseId);

    return alerts.map(alert => {
      // Suggest ordering enough to get to 150% of threshold
      const targetQuantity = alert.lowStockThreshold * 1.5;
      const suggestedQuantity = Math.ceil(targetQuantity - alert.quantity);

      return {
        itemId: alert.itemId,
        itemName: alert.itemName,
        itemSku: alert.itemSku,
        warehouseId: alert.warehouseId,
        warehouseName: alert.warehouseName,
        currentQuantity: alert.quantity,
        threshold: alert.lowStockThreshold,
        suggestedQuantity: Math.max(suggestedQuantity, 1),
        severity: alert.severity,
      };
    }).sort((a, b) => {
      // Sort by severity (critical first) then by suggested quantity
      const severityOrder = { critical: 0, warning: 1, low: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.suggestedQuantity - a.suggestedQuantity;
    });
  }
}
