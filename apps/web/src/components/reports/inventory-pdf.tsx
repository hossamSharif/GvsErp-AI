'use client';

/**
 * Inventory PDF Template
 *
 * Generates a printable/PDF inventory report document.
 */

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface InventoryItem {
  itemId: string;
  itemName: string;
  itemSku?: string;
  warehouseId: string;
  warehouseName?: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity?: number;
  unitOfMeasure: string;
  estimatedValue?: number;
  lowStockThreshold?: number;
  isLowStock?: boolean;
  categoryId?: string;
  categoryName?: string;
}

interface WarehouseGroup {
  warehouseId: string;
  warehouseName: string;
  items: InventoryItem[];
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
}

interface CategoryGroup {
  categoryId: string | null;
  categoryName: string;
  items: InventoryItem[];
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
}

interface InventoryReportData {
  generatedAt: string;
  filters: {
    warehouseId?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
    groupBy: 'warehouse' | 'category' | 'item';
  };
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    totalReserved: number;
    lowStockItems: number;
    warehouseCount: number;
  };
  alertsSummary: {
    totalAlerts: number;
    criticalCount: number;
    warningCount: number;
    lowCount: number;
  };
  data: InventoryItem[] | WarehouseGroup[] | CategoryGroup[];
}

interface InventoryPdfProps {
  report: InventoryReportData;
  companyName?: string;
  companyAddress?: string;
  showLowStockHighlight?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const InventoryPdf = forwardRef<HTMLDivElement, InventoryPdfProps>(
  function InventoryPdf(
    {
      report,
      companyName = 'Your Company',
      companyAddress = '123 Business St, City, Country',
      showLowStockHighlight = true,
      className,
    },
    ref
  ) {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(value);
    };

    const formatNumber = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 3,
      }).format(value);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const isGroupedByWarehouse = report.filters.groupBy === 'warehouse';
    const isGroupedByCategory = report.filters.groupBy === 'category';
    const isGrouped = isGroupedByWarehouse || isGroupedByCategory;

    const renderItemRow = (item: InventoryItem, index: number, showWarehouse = true) => (
      <tr
        key={`${item.itemId}-${item.warehouseId}`}
        className={cn(
          'border-b border-gray-200',
          showLowStockHighlight && item.isLowStock && 'bg-red-50'
        )}
      >
        <td className="py-2 px-3 text-gray-500 text-xs">{index + 1}</td>
        <td className="py-2 px-3">
          <p className="font-medium text-sm">{item.itemName}</p>
          {item.itemSku && (
            <p className="text-xs text-gray-500">SKU: {item.itemSku}</p>
          )}
        </td>
        {showWarehouse && (
          <td className="py-2 px-3 text-sm">{item.warehouseName || '-'}</td>
        )}
        <td className="py-2 px-3 text-right text-sm">
          {formatNumber(item.quantity)} {item.unitOfMeasure}
        </td>
        <td className="py-2 px-3 text-right text-sm">
          {formatNumber(item.availableQuantity)}
        </td>
        <td className="py-2 px-3 text-right text-sm">
          {item.reservedQuantity ? formatNumber(item.reservedQuantity) : '-'}
        </td>
        <td className="py-2 px-3 text-right text-sm">
          {item.lowStockThreshold ? formatNumber(item.lowStockThreshold) : '-'}
        </td>
        <td className="py-2 px-3 text-right text-sm">
          {item.estimatedValue ? formatCurrency(item.estimatedValue) : '-'}
        </td>
        <td className="py-2 px-3 text-center">
          {item.isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Low
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3" />
              OK
            </span>
          )}
        </td>
      </tr>
    );

    const renderGroupedData = () => {
      if (isGroupedByWarehouse) {
        const groups = report.data as WarehouseGroup[];
        return groups.map((group, groupIndex) => (
          <div key={group.warehouseId} className={cn(groupIndex > 0 && 'mt-8')}>
            {/* Group Header */}
            <div className="bg-gray-100 px-4 py-2 mb-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{group.warehouseName}</h3>
                <div className="text-sm text-gray-600">
                  <span className="mr-4">{group.items.length} items</span>
                  <span className="mr-4">Qty: {formatNumber(group.totalQuantity)}</span>
                  <span>Value: {formatCurrency(group.totalValue)}</span>
                  {group.lowStockCount > 0 && (
                    <span className="ml-4 text-red-600">
                      {group.lowStockCount} low stock
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Items Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Item</th>
                  <th className="text-right py-2 px-3 font-semibold">Quantity</th>
                  <th className="text-right py-2 px-3 font-semibold">Available</th>
                  <th className="text-right py-2 px-3 font-semibold">Reserved</th>
                  <th className="text-right py-2 px-3 font-semibold">Threshold</th>
                  <th className="text-right py-2 px-3 font-semibold">Value</th>
                  <th className="text-center py-2 px-3 font-semibold w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => renderItemRow(item, index, false))}
              </tbody>
            </table>
          </div>
        ));
      }

      if (isGroupedByCategory) {
        const groups = report.data as CategoryGroup[];
        return groups.map((group, groupIndex) => (
          <div key={group.categoryId || 'uncategorized'} className={cn(groupIndex > 0 && 'mt-8')}>
            {/* Group Header */}
            <div className="bg-gray-100 px-4 py-2 mb-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{group.categoryName}</h3>
                <div className="text-sm text-gray-600">
                  <span className="mr-4">{group.items.length} items</span>
                  <span className="mr-4">Qty: {formatNumber(group.totalQuantity)}</span>
                  <span>Value: {formatCurrency(group.totalValue)}</span>
                  {group.lowStockCount > 0 && (
                    <span className="ml-4 text-red-600">
                      {group.lowStockCount} low stock
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Items Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                  <th className="text-left py-2 px-3 font-semibold">Item</th>
                  <th className="text-left py-2 px-3 font-semibold">Warehouse</th>
                  <th className="text-right py-2 px-3 font-semibold">Quantity</th>
                  <th className="text-right py-2 px-3 font-semibold">Available</th>
                  <th className="text-right py-2 px-3 font-semibold">Reserved</th>
                  <th className="text-right py-2 px-3 font-semibold">Threshold</th>
                  <th className="text-right py-2 px-3 font-semibold">Value</th>
                  <th className="text-center py-2 px-3 font-semibold w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => renderItemRow(item, index, true))}
              </tbody>
            </table>
          </div>
        ));
      }

      return null;
    };

    const renderFlatData = () => {
      const items = report.data as InventoryItem[];
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-2 px-3 font-semibold w-8">#</th>
              <th className="text-left py-2 px-3 font-semibold">Item</th>
              <th className="text-left py-2 px-3 font-semibold">Warehouse</th>
              <th className="text-right py-2 px-3 font-semibold">Quantity</th>
              <th className="text-right py-2 px-3 font-semibold">Available</th>
              <th className="text-right py-2 px-3 font-semibold">Reserved</th>
              <th className="text-right py-2 px-3 font-semibold">Threshold</th>
              <th className="text-right py-2 px-3 font-semibold">Value</th>
              <th className="text-center py-2 px-3 font-semibold w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => renderItemRow(item, index, true))}
          </tbody>
        </table>
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white text-black p-8 min-h-[11in] w-[8.5in] mx-auto',
          'print:p-0 print:shadow-none',
          className
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          {/* Company Info */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
            <p className="text-sm text-gray-600 mt-1">{companyAddress}</p>
          </div>

          {/* Report Info */}
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900">Inventory Report</h2>
            <p className="text-sm text-gray-600 mt-1">
              Generated: {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>

        {/* Filters Applied */}
        {(report.filters.warehouseId || report.filters.categoryId || report.filters.lowStockOnly) && (
          <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
            <span className="font-semibold">Filters Applied: </span>
            {report.filters.lowStockOnly && <span className="mr-3">Low Stock Only</span>}
            {report.filters.warehouseId && <span className="mr-3">Filtered by Warehouse</span>}
            {report.filters.categoryId && <span className="mr-3">Filtered by Category</span>}
            <span>Grouped by: {report.filters.groupBy}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Total Items</p>
            <p className="text-xl font-bold">{report.summary.totalItems}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Warehouses</p>
            <p className="text-xl font-bold">{report.summary.warehouseCount}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Total Quantity</p>
            <p className="text-xl font-bold">{formatNumber(report.summary.totalQuantity)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Reserved</p>
            <p className="text-xl font-bold">{formatNumber(report.summary.totalReserved)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500 uppercase">Total Value</p>
            <p className="text-xl font-bold">{formatCurrency(report.summary.totalValue)}</p>
          </div>
          <div className={cn('p-3 rounded', report.summary.lowStockItems > 0 ? 'bg-red-50' : 'bg-green-50')}>
            <p className="text-xs text-gray-500 uppercase">Low Stock</p>
            <p className={cn('text-xl font-bold', report.summary.lowStockItems > 0 ? 'text-red-600' : 'text-green-600')}>
              {report.summary.lowStockItems}
            </p>
          </div>
        </div>

        {/* Alerts Summary */}
        {report.alertsSummary.totalAlerts > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alerts Summary
            </h3>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-600">Total: </span>
                <span className="font-bold">{report.alertsSummary.totalAlerts}</span>
              </div>
              <div>
                <span className="text-red-600">Critical: </span>
                <span className="font-bold text-red-600">{report.alertsSummary.criticalCount}</span>
              </div>
              <div>
                <span className="text-yellow-600">Warning: </span>
                <span className="font-bold text-yellow-600">{report.alertsSummary.warningCount}</span>
              </div>
              <div>
                <span className="text-orange-600">Low: </span>
                <span className="font-bold text-orange-600">{report.alertsSummary.lowCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="mb-8">
          {isGrouped ? renderGroupedData() : renderFlatData()}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 mt-auto">
          <div className="flex justify-between text-xs text-gray-500">
            <div>
              <p>{companyName} - Inventory Report</p>
              <p>Generated: {formatDate(report.generatedAt)}</p>
            </div>
            <div className="text-right">
              <p>Page 1 of 1</p>
              <p>Confidential</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default InventoryPdf;
