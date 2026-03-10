/**
 * Warehouse Service
 *
 * Business logic for warehouse and inventory management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { AlertsService } from './alerts.service';
import type { LowStockAlertWithSeverity, AlertSeverity } from './alerts.service';
import type {
  Warehouse,
  WarehouseWithSummary,
  WarehouseQueryParams,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseInventoryEntry,
  InventoryQueryParams,
  LowStockAlert,
  LowStockSummary,
  InventoryReportEntry,
  InventoryReportSummary,
  InventoryReportParams,
} from '@erp/shared';
import { QueryResult } from '../repositories/base.repository';

/**
 * Custom error class for warehouse-related errors
 */
export class WarehouseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'WarehouseError';
  }
}

/**
 * Warehouse service with business logic
 */
export class WarehouseService {
  private readonly warehouseRepo: WarehouseRepository;
  private readonly inventoryRepo: InventoryRepository;
  private readonly alertsService: AlertsService;
  private readonly tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.inventoryRepo = new InventoryRepository(supabase);
    this.alertsService = new AlertsService(supabase, tenantId);
    this.tenantId = tenantId;
  }

  // =============================================================================
  // WAREHOUSE OPERATIONS
  // =============================================================================

  /**
   * Get warehouses with pagination and filters
   */
  async getWarehouses(params: WarehouseQueryParams = {}): Promise<QueryResult<Warehouse>> {
    return this.warehouseRepo.findWithFilters(this.tenantId, params);
  }

  /**
   * Get a single warehouse by ID
   */
  async getWarehouse(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.getById(this.tenantId, id);
    if (!warehouse) {
      throw new WarehouseError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }
    return warehouse;
  }

  /**
   * Get warehouse with summary
   */
  async getWarehouseWithSummary(id: string): Promise<WarehouseWithSummary> {
    const warehouse = await this.warehouseRepo.getWithSummary(this.tenantId, id);
    if (!warehouse) {
      throw new WarehouseError('Warehouse not found', 'WAREHOUSE_NOT_FOUND', 404);
    }
    return warehouse;
  }

  /**
   * Create a new warehouse
   */
  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    return this.warehouseRepo.createWarehouse(this.tenantId, input);
  }

  /**
   * Update a warehouse
   */
  async updateWarehouse(id: string, input: UpdateWarehouseInput): Promise<Warehouse> {
    // Check if warehouse exists
    await this.getWarehouse(id);

    const updated = await this.warehouseRepo.updateWarehouse(this.tenantId, id, input);
    if (!updated) {
      throw new WarehouseError('Failed to update warehouse', 'WAREHOUSE_UPDATE_FAILED', 500);
    }
    return updated;
  }

  /**
   * Deactivate a warehouse (soft delete)
   */
  async deactivateWarehouse(id: string): Promise<Warehouse> {
    // Check if warehouse exists
    await this.getWarehouse(id);

    // Check if warehouse has inventory
    const hasInventory = await this.warehouseRepo.hasInventory(this.tenantId, id);
    if (hasInventory) {
      throw new WarehouseError(
        'Cannot deactivate warehouse with inventory. Transfer or remove all stock first.',
        'WAREHOUSE_HAS_INVENTORY',
        400
      );
    }

    // Check if warehouse has pending transfers
    const hasPendingTransfers = await this.warehouseRepo.hasPendingTransfers(this.tenantId, id);
    if (hasPendingTransfers) {
      throw new WarehouseError(
        'Cannot deactivate warehouse with pending transfers. Complete or cancel transfers first.',
        'WAREHOUSE_HAS_PENDING_TRANSFERS',
        400
      );
    }

    const updated = await this.warehouseRepo.updateWarehouse(this.tenantId, id, { isActive: false });
    if (!updated) {
      throw new WarehouseError('Failed to deactivate warehouse', 'WAREHOUSE_UPDATE_FAILED', 500);
    }
    return updated;
  }

  /**
   * Get all active warehouses (for dropdowns)
   */
  async getActiveWarehouses(): Promise<Warehouse[]> {
    return this.warehouseRepo.getActiveWarehouses(this.tenantId);
  }

  // =============================================================================
  // INVENTORY OPERATIONS
  // =============================================================================

  /**
   * Get inventory for a warehouse
   */
  async getWarehouseInventory(
    warehouseId: string,
    params: InventoryQueryParams = {}
  ): Promise<QueryResult<WarehouseInventoryEntry>> {
    // Verify warehouse exists
    await this.getWarehouse(warehouseId);

    return this.inventoryRepo.getWarehouseInventory(this.tenantId, warehouseId, params);
  }

  /**
   * Get inventory for a specific item in a warehouse
   */
  async getItemInventory(itemId: string, warehouseId: string) {
    return this.inventoryRepo.getByItemAndWarehouse(this.tenantId, itemId, warehouseId);
  }

  /**
   * Update low stock threshold for an item in a warehouse
   */
  async updateLowStockThreshold(
    itemId: string,
    warehouseId: string,
    threshold: number | null
  ) {
    // Verify warehouse exists
    await this.getWarehouse(warehouseId);

    return this.inventoryRepo.updateThreshold(this.tenantId, itemId, warehouseId, threshold);
  }

  /**
   * Bulk update low stock thresholds
   */
  async bulkUpdateLowStockThresholds(
    warehouseId: string,
    thresholds: Array<{ itemId: string; lowStockThreshold: number | null }>
  ) {
    // Verify warehouse exists
    await this.getWarehouse(warehouseId);

    const results = await Promise.all(
      thresholds.map(async (t) => {
        try {
          await this.inventoryRepo.updateThreshold(
            this.tenantId,
            t.itemId,
            warehouseId,
            t.lowStockThreshold
          );
          return { itemId: t.itemId, success: true };
        } catch (error) {
          return { itemId: t.itemId, success: false, error: (error as Error).message };
        }
      })
    );

    return {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  // =============================================================================
  // LOW STOCK ALERTS
  // =============================================================================

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(warehouseId?: string): Promise<LowStockAlert[]> {
    if (warehouseId) {
      // Verify warehouse exists
      await this.getWarehouse(warehouseId);
    }

    return this.inventoryRepo.getLowStockAlerts(this.tenantId, warehouseId);
  }

  /**
   * Get low stock summary for dashboard (delegates to AlertsService)
   */
  async getLowStockSummary(): Promise<LowStockSummary> {
    return this.alertsService.getLowStockSummary();
  }

  // =============================================================================
  // ALERTS WITH SEVERITY (delegates to AlertsService)
  // =============================================================================

  /**
   * Get low stock alerts enriched with severity levels
   */
  async getLowStockAlertsWithSeverity(
    warehouseId?: string,
    severity?: AlertSeverity
  ): Promise<LowStockAlertWithSeverity[]> {
    return this.alertsService.getLowStockAlerts(warehouseId, severity);
  }

  /**
   * Get critical alerts only (< 25% of threshold)
   */
  async getCriticalAlerts(warehouseId?: string): Promise<LowStockAlertWithSeverity[]> {
    return this.alertsService.getCriticalAlerts(warehouseId);
  }

  /**
   * Get suggested reorder quantities based on thresholds
   */
  async getSuggestedReorders(warehouseId?: string) {
    return this.alertsService.getSuggestedReorders(warehouseId);
  }

  // =============================================================================
  // INVENTORY REPORTS
  // =============================================================================

  /**
   * Get inventory report data
   */
  async getInventoryReportData(
    params: InventoryReportParams = {}
  ): Promise<{ entries: InventoryReportEntry[]; summary: InventoryReportSummary }> {
    const {
      warehouseId,
      categoryId: _categoryId,
      lowStockOnly = false,
      includeZeroQuantity = false,
    } = params;

    // Get warehouses to report on
    let warehouses: Warehouse[];
    if (warehouseId) {
      const warehouse = await this.getWarehouse(warehouseId);
      warehouses = [warehouse];
    } else {
      warehouses = await this.getActiveWarehouses();
    }

    const entries: InventoryReportEntry[] = [];
    const byWarehouse: Map<string, { name: string; items: number; qty: number; value: number }> = new Map();
    const byCategory: Map<string | null, { name: string | null; items: number; qty: number; value: number }> = new Map();

    let totalItems = 0;
    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    for (const warehouse of warehouses) {
      const inventory = await this.inventoryRepo.getWarehouseInventory(
        this.tenantId,
        warehouse.id,
        { limit: 10000 } // Get all for report
      );

      for (const inv of inventory.data) {
        // Apply filters
        if (!includeZeroQuantity && inv.quantity === 0) continue;
        if (lowStockOnly && !inv.isLowStock) continue;

        entries.push({
          itemId: inv.itemId,
          itemName: inv.itemName,
          itemSku: inv.itemSku,
          itemBarcode: inv.itemBarcode,
          category: null, // Would need to join with items.category
          unitOfMeasure: inv.unitOfMeasure,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQuantity,
          availableQuantity: inv.availableQuantity,
          lowStockThreshold: inv.lowStockThreshold,
          isLowStock: inv.isLowStock,
          unitCost: inv.quantity > 0 ? inv.estimatedValue / inv.quantity : 0,
          totalValue: inv.estimatedValue,
        });

        // Aggregate by warehouse
        const warehouseAgg = byWarehouse.get(warehouse.id) || {
          name: warehouse.name,
          items: 0,
          qty: 0,
          value: 0,
        };
        warehouseAgg.items++;
        warehouseAgg.qty += inv.quantity;
        warehouseAgg.value += inv.estimatedValue;
        byWarehouse.set(warehouse.id, warehouseAgg);

        // Update totals
        totalItems++;
        totalQuantity += inv.quantity;
        totalValue += inv.estimatedValue;
        if (inv.isLowStock) lowStockCount++;
      }
    }

    return {
      entries,
      summary: {
        totalItems,
        totalQuantity,
        totalValue,
        lowStockCount,
        byWarehouse: Array.from(byWarehouse.entries()).map(([id, data]) => ({
          warehouseId: id,
          warehouseName: data.name,
          itemCount: data.items,
          totalQuantity: data.qty,
          totalValue: data.value,
        })),
        byCategory: Array.from(byCategory.entries()).map(([id, data]) => ({
          categoryId: id,
          categoryName: data.name,
          itemCount: data.items,
          totalQuantity: data.qty,
          totalValue: data.value,
        })),
      },
    };
  }

  // =============================================================================
  // VALUE CALCULATIONS
  // =============================================================================

  /**
   * Get total inventory value across all warehouses
   */
  async getTotalInventoryValue(): Promise<number> {
    const warehouses = await this.getActiveWarehouses();
    let totalValue = 0;

    for (const warehouse of warehouses) {
      const value = await this.inventoryRepo.getWarehouseValue(this.tenantId, warehouse.id);
      totalValue += value;
    }

    return totalValue;
  }

  /**
   * Get inventory value by warehouse
   */
  async getInventoryValueByWarehouse(): Promise<Array<{ warehouseId: string; warehouseName: string; value: number }>> {
    const warehouses = await this.getActiveWarehouses();
    const results = [];

    for (const warehouse of warehouses) {
      const value = await this.inventoryRepo.getWarehouseValue(this.tenantId, warehouse.id);
      results.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        value,
      });
    }

    return results;
  }
}
