/**
 * Report Service
 *
 * Business logic for generating inventory, valuation, and low-stock reports.
 * Extracts report orchestration out of routes into the service layer.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@erp/database';
import { InventoryRepository } from '../repositories/inventory.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { ItemRepository } from '../repositories/item.repository';
import { AlertsService } from './alerts.service';
import { WarehouseService } from './warehouse.service';
import type { Warehouse, WarehouseInventoryEntry, LowStockAlert } from '@erp/shared';

/** Inventory entry enriched with warehouse/category context for report grouping */
interface ReportInventoryEntry extends WarehouseInventoryEntry {
  warehouseId?: string;
  warehouseName?: string;
  categoryId?: string | null;
  categoryName?: string;
}

/** Grouped report data (by warehouse or category) */
interface ReportGroup {
  warehouseId?: string;
  warehouseName?: string;
  categoryId?: string | null;
  categoryName?: string;
  items: ReportInventoryEntry[];
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryReportQuery {
  warehouseId?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
  includeZeroStock: boolean;
  groupBy: 'warehouse' | 'category' | 'item';
  sortBy: 'itemName' | 'quantity' | 'value' | 'sku';
  sortDir: 'asc' | 'desc';
  format: 'json' | 'pdf' | 'csv';
}

export interface InventoryReportSummaryResult {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  totalReserved: number;
  lowStockItems: number;
  warehouseCount: number;
}

export interface AlertsSummaryResult {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  lowCount: number;
}

export interface InventoryReportResult {
  generatedAt: string;
  filters: Omit<InventoryReportQuery, 'format'>;
  summary: InventoryReportSummaryResult;
  alertsSummary: AlertsSummaryResult;
  data: ReportInventoryEntry[] | ReportGroup[];
  /** Flat (ungrouped) inventory data — use for CSV export */
  flatData: ReportInventoryEntry[];
}

export interface ValuationReportResult {
  generatedAt: string;
  totalValue: number;
  warehouseCount: number;
  valuationByWarehouse: {
    warehouseId: string;
    warehouseName: string;
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    percentOfTotal: number;
  }[];
}

/** Reorder suggestion from low-stock analysis */
interface ReorderSuggestion {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  warehouseId: string;
  warehouseName: string;
  currentQuantity: number;
  threshold: number;
  suggestedQuantity: number;
  severity: string;
}

export interface LowStockReportResult {
  generatedAt: string;
  filters: { warehouseId?: string; severity: string };
  summary: {
    totalAlerts: number;
    criticalCount: number;
    warningCount: number;
    lowCount: number;
    totalDeficit: number;
    totalSuggestedReorderQty: number;
  };
  alerts: LowStockAlert[];
  reorderSuggestions: ReorderSuggestion[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ReportService {
  private inventoryRepo: InventoryRepository;
  private warehouseRepo: WarehouseRepository;
  private itemRepo: ItemRepository;
  private alertsService: AlertsService;
  private warehouseService: WarehouseService;

  constructor(
    supabase: SupabaseClient<Database>,
    private tenantId: string,
  ) {
    this.inventoryRepo = new InventoryRepository(supabase);
    this.warehouseRepo = new WarehouseRepository(supabase);
    this.itemRepo = new ItemRepository(supabase);
    this.alertsService = new AlertsService(supabase, tenantId);
    this.warehouseService = new WarehouseService(supabase, tenantId);
  }

  // -------------------------------------------------------------------------
  // Inventory Report
  // -------------------------------------------------------------------------

  async getInventoryReport(query: InventoryReportQuery): Promise<InventoryReportResult> {
    const rawData = await this.fetchInventoryData(query);
    const filteredData = await this.applyFilters(rawData, query);

    const summary = this.calculateSummary(filteredData);
    const alertsSummary = await this.calculateAlertsSummary(query.warehouseId);
    const groupedData = this.groupData(filteredData, query.groupBy);

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        warehouseId: query.warehouseId,
        categoryId: query.categoryId,
        lowStockOnly: query.lowStockOnly,
        includeZeroStock: query.includeZeroStock,
        groupBy: query.groupBy,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      },
      summary,
      alertsSummary,
      data: groupedData,
      flatData: filteredData,
    };
  }

  generateInventoryCsv(inventoryData: ReportInventoryEntry[]): string {
    const csvHeaders = [
      'Item Name',
      'SKU',
      'Warehouse',
      'Quantity',
      'Available',
      'Reserved',
      'Unit',
      'Value',
      'Low Stock Threshold',
      'Is Low Stock',
    ];
    const csvRows = inventoryData.map((item) => [
      item.itemName,
      item.itemSku || '',
      item.warehouseName || '',
      item.quantity.toFixed(3),
      item.availableQuantity.toFixed(3),
      (item.reservedQuantity || 0).toFixed(3),
      item.unitOfMeasure,
      (item.estimatedValue || 0).toFixed(2),
      item.lowStockThreshold?.toFixed(3) || '',
      item.isLowStock ? 'Yes' : 'No',
    ]);

    return [
      csvHeaders.join(','),
      ...csvRows.map((row: string[]) =>
        row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
  }

  // -------------------------------------------------------------------------
  // Valuation Report
  // -------------------------------------------------------------------------

  async getValuationReport(): Promise<ValuationReportResult> {
    const totalValue = await this.warehouseService.getTotalInventoryValue();
    const warehouses = await this.warehouseRepo.getActiveWarehouses(this.tenantId);

    const valuationByWarehouse = await Promise.all(
      warehouses.map(async (warehouse: Warehouse) => {
        const withSummary = await this.warehouseRepo.getWithSummary(this.tenantId, warehouse.id);
        return {
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          totalItems: withSummary?.totalItems || 0,
          totalQuantity: withSummary?.totalQuantity || 0,
          totalValue: withSummary?.totalValue || 0,
          percentOfTotal: totalValue > 0 ? ((withSummary?.totalValue || 0) / totalValue) * 100 : 0,
        };
      })
    );

    return {
      generatedAt: new Date().toISOString(),
      totalValue,
      warehouseCount: warehouses.length,
      valuationByWarehouse: valuationByWarehouse.sort((a, b) => b.totalValue - a.totalValue),
    };
  }

  // -------------------------------------------------------------------------
  // Low Stock Report
  // -------------------------------------------------------------------------

  async getLowStockReport(warehouseId?: string, severity: string = 'all'): Promise<LowStockReportResult> {
    let alerts = await this.alertsService.getLowStockAlerts(warehouseId);

    if (severity !== 'all') {
      alerts = alerts.filter((alert) => {
        const pct = alert.percentOfThreshold;
        switch (severity) {
          case 'critical':
            return pct < 25;
          case 'warning':
            return pct >= 25 && pct < 50;
          case 'low':
            return pct >= 50;
          default:
            return true;
        }
      });
    }

    const reorderSuggestions = await this.alertsService.getSuggestedReorders(warehouseId);

    return {
      generatedAt: new Date().toISOString(),
      filters: { warehouseId, severity },
      summary: {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter((a) => a.percentOfThreshold < 25).length,
        warningCount: alerts.filter((a) => a.percentOfThreshold >= 25 && a.percentOfThreshold < 50).length,
        lowCount: alerts.filter((a) => a.percentOfThreshold >= 50).length,
        totalDeficit: alerts.reduce((sum, a) => sum + a.deficit, 0),
        totalSuggestedReorderQty: reorderSuggestions.reduce((sum, s) => sum + s.suggestedQuantity, 0),
      },
      alerts,
      reorderSuggestions,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchInventoryData(query: InventoryReportQuery): Promise<ReportInventoryEntry[]> {
    if (query.warehouseId) {
      const result = await this.inventoryRepo.getWarehouseInventory(this.tenantId, query.warehouseId, {
        lowStockOnly: query.lowStockOnly || false,
        page: 1,
        limit: 10000,
      });
      return result.data;
    }

    const warehouses = await this.warehouseRepo.getActiveWarehouses(this.tenantId);
    let inventoryData: ReportInventoryEntry[] = [];

    for (const warehouse of warehouses) {
      const result = await this.inventoryRepo.getWarehouseInventory(this.tenantId, warehouse.id, {
        lowStockOnly: query.lowStockOnly || false,
        page: 1,
        limit: 10000,
      });
      inventoryData = inventoryData.concat(
        result.data.map((item) => ({
          ...item,
          warehouseName: warehouse.name,
        }))
      );
    }

    return inventoryData;
  }

  private async applyFilters(inventoryData: ReportInventoryEntry[], query: InventoryReportQuery): Promise<ReportInventoryEntry[]> {
    let data = inventoryData;

    if (query.categoryId) {
      const itemsInCategory = await this.itemRepo.findAllWithFilters({
        tenantId: this.tenantId,
        categoryId: query.categoryId,
        page: 1,
        limit: 10000,
      });
      const categoryItemIds = new Set(itemsInCategory.data.map((i) => i.id));
      data = data.filter((inv) => categoryItemIds.has(inv.itemId));
    }

    if (!query.includeZeroStock) {
      data = data.filter((inv) => inv.quantity > 0);
    }

    return data;
  }

  private calculateSummary(inventoryData: ReportInventoryEntry[]): InventoryReportSummaryResult {
    return {
      totalItems: new Set(inventoryData.map((i) => i.itemId)).size,
      totalQuantity: inventoryData.reduce((sum, i) => sum + i.quantity, 0),
      totalValue: inventoryData.reduce((sum, i) => sum + (i.estimatedValue || 0), 0),
      totalReserved: inventoryData.reduce((sum, i) => sum + (i.reservedQuantity || 0), 0),
      lowStockItems: inventoryData.filter((i) => i.isLowStock).length,
      warehouseCount: new Set(inventoryData.map((i) => i.warehouseId)).size,
    };
  }

  private async calculateAlertsSummary(warehouseId?: string): Promise<AlertsSummaryResult> {
    const alerts = await this.alertsService.getLowStockAlerts(warehouseId);
    return {
      totalAlerts: alerts.length,
      criticalCount: alerts.filter((a) => a.percentOfThreshold < 25).length,
      warningCount: alerts.filter((a) => a.percentOfThreshold >= 25 && a.percentOfThreshold < 50).length,
      lowCount: alerts.filter((a) => a.percentOfThreshold >= 50).length,
    };
  }

  private groupData(inventoryData: ReportInventoryEntry[], groupBy: string): ReportInventoryEntry[] | ReportGroup[] {
    if (groupBy === 'warehouse') {
      return this.groupByWarehouse(inventoryData);
    }
    if (groupBy === 'category') {
      return this.groupByCategory(inventoryData);
    }
    return inventoryData;
  }

  private groupByWarehouse(inventoryData: ReportInventoryEntry[]): ReportGroup[] {
    const byWarehouse: Record<string, ReportGroup> = {};
    for (const item of inventoryData) {
      const key = item.warehouseId || 'unknown';
      if (!byWarehouse[key]) {
        byWarehouse[key] = {
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName || 'Unknown',
          items: [],
          totalQuantity: 0,
          totalValue: 0,
          lowStockCount: 0,
        };
      }
      byWarehouse[key].items.push(item);
      byWarehouse[key].totalQuantity += item.quantity;
      byWarehouse[key].totalValue += item.estimatedValue || 0;
      if (item.isLowStock) byWarehouse[key].lowStockCount++;
    }
    return Object.values(byWarehouse);
  }

  private groupByCategory(inventoryData: ReportInventoryEntry[]): ReportGroup[] {
    const byCategory: Record<string, ReportGroup> = {};
    for (const item of inventoryData) {
      const key = item.categoryId || 'uncategorized';
      if (!byCategory[key]) {
        byCategory[key] = {
          categoryId: item.categoryId || null,
          categoryName: item.categoryName || 'Uncategorized',
          items: [],
          totalQuantity: 0,
          totalValue: 0,
          lowStockCount: 0,
        };
      }
      byCategory[key].items.push(item);
      byCategory[key].totalQuantity += item.quantity;
      byCategory[key].totalValue += item.estimatedValue || 0;
      if (item.isLowStock) byCategory[key].lowStockCount++;
    }
    return Object.values(byCategory);
  }
}
