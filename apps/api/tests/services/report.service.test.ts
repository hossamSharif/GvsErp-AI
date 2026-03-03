import { describe, it, expect } from 'vitest';
import { ReportService } from '../../src/services/report.service';

/**
 * Unit tests for ReportService pure business logic.
 * Tests private helpers via (instance as any) — no DB mocks needed.
 */

const reportService = new (ReportService as any)(null, 'test-tenant');

// ==========================================================================
// Sample data
// ==========================================================================

const sampleInventory = [
  {
    itemId: 'item-1',
    itemName: 'Widget A',
    itemSku: 'WA-001',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    categoryId: 'cat-1',
    categoryName: 'Electronics',
    quantity: 100,
    availableQuantity: 90,
    reservedQuantity: 10,
    estimatedValue: 5000,
    unitOfMeasure: 'pcs',
    lowStockThreshold: 20,
    isLowStock: false,
  },
  {
    itemId: 'item-2',
    itemName: 'Widget B',
    itemSku: 'WB-002',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    categoryId: 'cat-2',
    categoryName: 'Mechanical',
    quantity: 5,
    availableQuantity: 3,
    reservedQuantity: 2,
    estimatedValue: 250,
    unitOfMeasure: 'pcs',
    lowStockThreshold: 10,
    isLowStock: true,
  },
  {
    itemId: 'item-3',
    itemName: 'Widget C',
    itemSku: null,
    warehouseId: 'wh-2',
    warehouseName: 'Secondary Warehouse',
    categoryId: 'cat-1',
    categoryName: 'Electronics',
    quantity: 50,
    availableQuantity: 50,
    reservedQuantity: 0,
    estimatedValue: 2500,
    unitOfMeasure: 'kg',
    lowStockThreshold: null,
    isLowStock: false,
  },
  {
    itemId: 'item-4',
    itemName: 'Widget D',
    itemSku: 'WD-004',
    warehouseId: 'wh-2',
    warehouseName: 'Secondary Warehouse',
    categoryId: null,
    categoryName: null,
    quantity: 0,
    availableQuantity: 0,
    reservedQuantity: 0,
    estimatedValue: 0,
    unitOfMeasure: 'pcs',
    lowStockThreshold: 5,
    isLowStock: false,
  },
];

// ==========================================================================
// calculateSummary
// ==========================================================================

describe('ReportService.calculateSummary', () => {
  it('counts unique items by itemId', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.totalItems).toBe(4);
  });

  it('sums total quantity across all entries', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.totalQuantity).toBe(155); // 100 + 5 + 50 + 0
  });

  it('sums total value across all entries', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.totalValue).toBe(7750); // 5000 + 250 + 2500 + 0
  });

  it('sums total reserved across all entries', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.totalReserved).toBe(12); // 10 + 2 + 0 + 0
  });

  it('counts low stock items', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.lowStockItems).toBe(1); // only item-2
  });

  it('counts unique warehouses', () => {
    const result = reportService.calculateSummary(sampleInventory);
    expect(result.warehouseCount).toBe(2);
  });

  it('handles empty inventory array', () => {
    const result = reportService.calculateSummary([]);
    expect(result).toEqual({
      totalItems: 0,
      totalQuantity: 0,
      totalValue: 0,
      totalReserved: 0,
      lowStockItems: 0,
      warehouseCount: 0,
    });
  });

  it('handles missing estimatedValue and reservedQuantity gracefully', () => {
    const partial = [{ itemId: 'x', warehouseId: 'w', quantity: 10, isLowStock: false }];
    const result = reportService.calculateSummary(partial);
    expect(result.totalValue).toBe(0);
    expect(result.totalReserved).toBe(0);
  });

  it('deduplicates same itemId appearing in multiple warehouses', () => {
    const duplicated = [
      { itemId: 'item-1', warehouseId: 'wh-1', quantity: 10, estimatedValue: 100, reservedQuantity: 0, isLowStock: false },
      { itemId: 'item-1', warehouseId: 'wh-2', quantity: 20, estimatedValue: 200, reservedQuantity: 5, isLowStock: false },
    ];
    const result = reportService.calculateSummary(duplicated);
    expect(result.totalItems).toBe(1); // same item in two warehouses
    expect(result.totalQuantity).toBe(30);
    expect(result.warehouseCount).toBe(2);
  });
});

// ==========================================================================
// groupByWarehouse
// ==========================================================================

describe('ReportService.groupByWarehouse', () => {
  it('groups items by warehouseId', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    expect(result).toHaveLength(2);
  });

  it('assigns correct warehouse names', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    const names = result.map((g: any) => g.warehouseName).sort();
    expect(names).toEqual(['Main Warehouse', 'Secondary Warehouse']);
  });

  it('sums totalQuantity per warehouse', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    const main = result.find((g: any) => g.warehouseId === 'wh-1');
    expect(main.totalQuantity).toBe(105); // 100 + 5
    const secondary = result.find((g: any) => g.warehouseId === 'wh-2');
    expect(secondary.totalQuantity).toBe(50); // 50 + 0
  });

  it('sums totalValue per warehouse', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    const main = result.find((g: any) => g.warehouseId === 'wh-1');
    expect(main.totalValue).toBe(5250); // 5000 + 250
  });

  it('counts low stock items per warehouse', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    const main = result.find((g: any) => g.warehouseId === 'wh-1');
    expect(main.lowStockCount).toBe(1);
    const secondary = result.find((g: any) => g.warehouseId === 'wh-2');
    expect(secondary.lowStockCount).toBe(0);
  });

  it('includes items array in each group', () => {
    const result = reportService.groupByWarehouse(sampleInventory);
    const main = result.find((g: any) => g.warehouseId === 'wh-1');
    expect(main.items).toHaveLength(2);
  });

  it('handles empty array', () => {
    const result = reportService.groupByWarehouse([]);
    expect(result).toEqual([]);
  });

  it('defaults warehouseName to Unknown when missing', () => {
    const data = [{ warehouseId: 'wh-x', quantity: 10, estimatedValue: 0, isLowStock: false }];
    const result = reportService.groupByWarehouse(data);
    expect(result[0].warehouseName).toBe('Unknown');
  });
});

// ==========================================================================
// groupByCategory
// ==========================================================================

describe('ReportService.groupByCategory', () => {
  it('groups items by categoryId', () => {
    const result = reportService.groupByCategory(sampleInventory);
    // cat-1, cat-2, and uncategorized (null categoryId)
    expect(result).toHaveLength(3);
  });

  it('groups items with null categoryId under Uncategorized', () => {
    const result = reportService.groupByCategory(sampleInventory);
    const uncategorized = result.find((g: any) => g.categoryId === null);
    expect(uncategorized).toBeDefined();
    expect(uncategorized.categoryName).toBe('Uncategorized');
    expect(uncategorized.items).toHaveLength(1);
  });

  it('sums totalQuantity per category', () => {
    const result = reportService.groupByCategory(sampleInventory);
    const electronics = result.find((g: any) => g.categoryId === 'cat-1');
    expect(electronics.totalQuantity).toBe(150); // 100 + 50
  });

  it('sums totalValue per category', () => {
    const result = reportService.groupByCategory(sampleInventory);
    const electronics = result.find((g: any) => g.categoryId === 'cat-1');
    expect(electronics.totalValue).toBe(7500); // 5000 + 2500
  });

  it('handles empty array', () => {
    const result = reportService.groupByCategory([]);
    expect(result).toEqual([]);
  });
});

// ==========================================================================
// groupData (dispatcher)
// ==========================================================================

describe('ReportService.groupData', () => {
  it('returns raw data when groupBy is item', () => {
    const result = reportService.groupData(sampleInventory, 'item');
    expect(result).toBe(sampleInventory); // same reference, no grouping
  });

  it('delegates to groupByWarehouse when groupBy is warehouse', () => {
    const result = reportService.groupData(sampleInventory, 'warehouse');
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('warehouseId');
  });

  it('delegates to groupByCategory when groupBy is category', () => {
    const result = reportService.groupData(sampleInventory, 'category');
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('categoryId');
  });
});

// ==========================================================================
// generateInventoryCsv
// ==========================================================================

describe('ReportService.generateInventoryCsv', () => {
  it('produces a header row with 10 columns', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    expect(headers).toHaveLength(10);
    expect(headers[0]).toBe('Item Name');
    expect(headers[9]).toBe('Is Low Stock');
  });

  it('produces one data row per inventory entry', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    // 1 header + 4 data rows
    expect(lines).toHaveLength(5);
  });

  it('wraps values in double quotes', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    // Every data cell should be quoted
    expect(lines[1]).toMatch(/^".*"$/);
  });

  it('handles null SKU as empty string', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    // item-3 has null SKU — should be empty field
    const row3 = lines[3]; // 0-indexed: header, item1, item2, item3
    expect(row3).toContain('""'); // empty quoted field for null sku
  });

  it('marks low stock items as Yes', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    // item-2 is low stock
    expect(lines[2]).toContain('"Yes"');
  });

  it('marks non-low-stock items as No', () => {
    const csv = reportService.generateInventoryCsv(sampleInventory);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"No"');
  });

  it('handles empty array with header only', () => {
    const csv = reportService.generateInventoryCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Item Name');
  });

  it('escapes double quotes in values', () => {
    const data = [{
      itemName: 'Widget "Special"',
      itemSku: 'WS-001',
      warehouseName: 'Main',
      quantity: 10,
      availableQuantity: 10,
      reservedQuantity: 0,
      unitOfMeasure: 'pcs',
      estimatedValue: 100,
      lowStockThreshold: 5,
      isLowStock: false,
    }];
    const csv = reportService.generateInventoryCsv(data);
    expect(csv).toContain('""Special""');
  });
});
