/**
 * Expiry Alerts Service
 *
 * Service for managing item expiry alerts and notifications.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { ItemRepository } from '../repositories/item.repository';
import type { ExpiringItemAlert, ExpirySeverity, ExpirySummary } from '@erp/shared';

/**
 * Expiry alerts service for item expiry monitoring
 */
export class ExpiryAlertsService {
  private readonly itemRepository: ItemRepository;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.itemRepository = new ItemRepository(supabase);
    this.tenantId = tenantId;
  }

  /**
   * Determine alert severity based on days until expiry
   */
  private getSeverity(daysUntilExpiry: number): ExpirySeverity {
    if (daysUntilExpiry < 0) {
      return 'expired';
    } else if (daysUntilExpiry <= 7) {
      return 'critical';
    }
    return 'warning';
  }

  /**
   * Get all expiring item alerts with severity
   */
  async getExpiringAlerts(
    daysThreshold: number = 30,
    severity?: ExpirySeverity
  ): Promise<ExpiringItemAlert[]> {
    const items = await this.itemRepository.getExpiringItems(this.tenantId, daysThreshold);

    const alerts: ExpiringItemAlert[] = items.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      itemSku: item.itemSku,
      expiryDate: item.expiryDate,
      daysUntilExpiry: item.daysUntilExpiry,
      severity: this.getSeverity(item.daysUntilExpiry),
    }));

    if (severity) {
      return alerts.filter((a) => a.severity === severity);
    }

    return alerts;
  }

  /**
   * Get expiry summary with severity breakdown
   */
  async getExpirySummary(): Promise<ExpirySummary> {
    const alerts = await this.getExpiringAlerts();

    let expiredCount = 0;
    let criticalCount = 0;
    let warningCount = 0;

    for (const alert of alerts) {
      switch (alert.severity) {
        case 'expired':
          expiredCount++;
          break;
        case 'critical':
          criticalCount++;
          break;
        case 'warning':
          warningCount++;
          break;
      }
    }

    return {
      totalAlerts: alerts.length,
      expiredCount,
      criticalCount,
      warningCount,
    };
  }

  /**
   * Get critical (<= 7 days) and expired alerts only
   */
  async getCriticalExpiryAlerts(): Promise<ExpiringItemAlert[]> {
    const alerts = await this.getExpiringAlerts();
    return alerts.filter((a) => a.severity === 'expired' || a.severity === 'critical');
  }

  /**
   * Check if any critical or expired alerts exist
   */
  async hasCriticalExpiryAlerts(): Promise<boolean> {
    const alerts = await this.getCriticalExpiryAlerts();
    return alerts.length > 0;
  }
}
