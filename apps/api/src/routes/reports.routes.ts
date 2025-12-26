/**
 * Reports API Routes
 *
 * RESTful endpoints for generating various reports.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InvoiceService, InvoiceError } from '../services/invoice.service';
import { WarehouseService } from '../services/warehouse.service';
import { AlertsService } from '../services/alerts.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import { ItemRepository } from '../repositories/item.repository';
import { salesReportParamsSchema, purchaseReportParamsSchema } from '@erp-saas/shared';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getTenantContext } from '../middleware/tenant';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Helper to create InvoiceService with tenant context
 */
function getInvoiceService(req: Request): InvoiceService {
  const { supabase, tenantId, userId } = getTenantContext(req);
  return new InvoiceService(supabase, tenantId, userId);
}

/**
 * Error handler
 */
function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof InvoiceError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }
  next(error);
}

// =============================================================================
// SALES REPORTS
// =============================================================================

/**
 * GET /reports/sales
 * Get sales report data with optional summary
 */
router.get(
  '/sales',
  validateRequest({ query: salesReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const params = req.query as unknown as {
        dateFrom?: string;
        dateTo?: string;
        partyId?: string;
        warehouseId?: string;
        status?: string | string[];
        includeSummary?: boolean;
      };

      const report = await service.getSalesReport(params);

      res.json({
        success: true,
        data: report.entries,
        summary: report.summary,
        meta: {
          generatedAt: report.generatedAt,
          total: report.entries.length,
        },
      });
    } catch (error) {
      handleError(error, res, next);
    }
  }
);

// =============================================================================
// PURCHASE REPORTS
// =============================================================================

/**
 * GET /reports/purchases
 * Get purchase report data with optional summary
 */
router.get(
  '/purchases',
  validateRequest({ query: purchaseReportParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getInvoiceService(req);
      const params = req.query as unknown as {
        dateFrom?: string;
        dateTo?: string;
        partyId?: string;
        warehouseId?: string;
        status?: string | string[];
        includeSummary?: boolean;
      };

      const report = await service.getPurchaseReport(params);

      res.json({
        success: true,
        data: report.entries,
        summary: report.summary,
        meta: {
          generatedAt: report.generatedAt,
          total: report.entries.length,
        },
      });
    } catch (error) {
      handleError(error, res, next);
    }
  }
);

// =============================================================================
// INVENTORY REPORTS
// =============================================================================

/**
 * Inventory Report Query Schema
 */
const inventoryReportQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  lowStockOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  includeZeroStock: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  groupBy: z.enum(['warehouse', 'category', 'item']).default('item'),
  sortBy: z.enum(['itemName', 'quantity', 'value', 'sku']).default('itemName'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  format: z.enum(['json', 'pdf', 'csv']).default('json'),
});

/**
 * GET /reports/inventory
 * Generate comprehensive inventory report with optional filters.
 */
router.get(
  '/inventory',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supabase, tenantId } = getTenantContext(req);
      const query = inventoryReportQuerySchema.parse(req.query);

      const inventoryRepo = new InventoryRepository(supabase);
      const warehouseRepo = new WarehouseRepository(supabase);
      const itemRepo = new ItemRepository(supabase);
      const alertsService = new AlertsService(supabase, tenantId);

      // Get all inventory with details
      let inventoryData: any[] = [];

      if (query.warehouseId) {
        // Get inventory for specific warehouse
        const result = await inventoryRepo.getWarehouseInventory(tenantId, query.warehouseId, {
          search: undefined,
          lowStockOnly: query.lowStockOnly || false,
          page: 1,
          limit: 10000, // Get all for report
          sortBy: query.sortBy,
          sortDir: query.sortDir,
        });
        inventoryData = result.data;
      } else {
        // Get all inventory across warehouses
        const warehouses = await warehouseRepo.findWithFilters(tenantId, {
          page: 1,
          limit: 100,
          isActive: true,
        });

        for (const warehouse of warehouses.data) {
          const result = await inventoryRepo.getWarehouseInventory(tenantId, warehouse.id, {
            search: undefined,
            lowStockOnly: query.lowStockOnly || false,
            page: 1,
            limit: 10000,
            sortBy: query.sortBy,
            sortDir: query.sortDir,
          });
          inventoryData = inventoryData.concat(
            result.data.map((item) => ({
              ...item,
              warehouseName: warehouse.name,
            }))
          );
        }
      }

      // Filter by category if specified
      if (query.categoryId) {
        const itemsInCategory = await itemRepo.findAllWithFilters({
          tenantId,
          categoryId: query.categoryId,
          page: 1,
          limit: 10000,
        });
        const categoryItemIds = new Set(itemsInCategory.data.map((i) => i.id));
        inventoryData = inventoryData.filter((inv) => categoryItemIds.has(inv.itemId));
      }

      // Filter zero stock if not included
      if (!query.includeZeroStock) {
        inventoryData = inventoryData.filter((inv) => inv.quantity > 0);
      }

      // Calculate summary statistics
      const summary = {
        totalItems: new Set(inventoryData.map((i) => i.itemId)).size,
        totalQuantity: inventoryData.reduce((sum, i) => sum + i.quantity, 0),
        totalValue: inventoryData.reduce((sum, i) => sum + (i.estimatedValue || 0), 0),
        totalReserved: inventoryData.reduce((sum, i) => sum + (i.reservedQuantity || 0), 0),
        lowStockItems: inventoryData.filter((i) => i.isLowStock).length,
        warehouseCount: new Set(inventoryData.map((i) => i.warehouseId)).size,
      };

      // Get low stock alerts summary
      const alerts = await alertsService.getLowStockAlerts(query.warehouseId);
      const alertsSummary = {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter((a) => a.percentOfThreshold < 25).length,
        warningCount: alerts.filter((a) => a.percentOfThreshold >= 25 && a.percentOfThreshold < 50).length,
        lowCount: alerts.filter((a) => a.percentOfThreshold >= 50).length,
      };

      // Group data if requested
      let groupedData: any = inventoryData;
      if (query.groupBy === 'warehouse') {
        const byWarehouse: Record<string, any> = {};
        for (const item of inventoryData) {
          const key = item.warehouseId;
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
        groupedData = Object.values(byWarehouse);
      } else if (query.groupBy === 'category') {
        const byCategory: Record<string, any> = {};
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
        groupedData = Object.values(byCategory);
      }

      // Handle different output formats
      if (query.format === 'csv') {
        // Generate CSV
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

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
          ),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.csv"`
        );
        return res.send(csvContent);
      }

      if (query.format === 'pdf') {
        // Return data structured for PDF generation on frontend
        return res.json({
          success: true,
          data: {
            type: 'pdf',
            report: {
              title: 'Inventory Report',
              generatedAt: new Date().toISOString(),
              filters: {
                warehouseId: query.warehouseId,
                categoryId: query.categoryId,
                lowStockOnly: query.lowStockOnly,
                groupBy: query.groupBy,
              },
              summary,
              alertsSummary,
              data: groupedData,
            },
          },
        });
      }

      // Default JSON response
      res.json({
        success: true,
        data: {
          report: {
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
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/inventory/valuation
 * Get inventory valuation report grouped by warehouse.
 */
router.get(
  '/inventory/valuation',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supabase, tenantId } = getTenantContext(req);
      const warehouseService = new WarehouseService(supabase, tenantId);

      // Get total inventory value across all warehouses
      const totalValue = await warehouseService.getTotalInventoryValue();

      // Get value breakdown by warehouse
      const warehouseRepo = new WarehouseRepository(supabase);
      const warehouses = await warehouseRepo.findWithFilters(tenantId, {
        page: 1,
        limit: 100,
        isActive: true,
      });

      const valuationByWarehouse = await Promise.all(
        warehouses.data.map(async (warehouse) => {
          const withSummary = await warehouseRepo.getWithSummary(tenantId, warehouse.id);
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

      res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          totalValue,
          warehouseCount: warehouses.data.length,
          valuationByWarehouse: valuationByWarehouse.sort((a, b) => b.totalValue - a.totalValue),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/low-stock
 * Get detailed low stock report with reorder suggestions.
 */
router.get(
  '/low-stock',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supabase, tenantId } = getTenantContext(req);

      const querySchema = z.object({
        warehouseId: z.string().uuid().optional(),
        severity: z.enum(['all', 'critical', 'warning', 'low']).default('all'),
      });

      const query = querySchema.parse(req.query);
      const alertsService = new AlertsService(supabase, tenantId);

      // Get low stock alerts
      let alerts = await alertsService.getLowStockAlerts(query.warehouseId);

      // Filter by severity
      if (query.severity !== 'all') {
        alerts = alerts.filter((alert) => {
          const pct = alert.percentOfThreshold;
          switch (query.severity) {
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

      // Get reorder suggestions
      const reorderSuggestions = await alertsService.getSuggestedReorders(query.warehouseId);

      // Calculate summary
      const summary = {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter((a) => a.percentOfThreshold < 25).length,
        warningCount: alerts.filter((a) => a.percentOfThreshold >= 25 && a.percentOfThreshold < 50).length,
        lowCount: alerts.filter((a) => a.percentOfThreshold >= 50).length,
        totalDeficit: alerts.reduce((sum, a) => sum + a.deficit, 0),
        totalSuggestedQuantity: reorderSuggestions.reduce((sum, s) => sum + s.suggestedQuantity, 0),
      };

      res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          filters: query,
          summary,
          alerts,
          reorderSuggestions,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
