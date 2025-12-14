'use client';

/**
 * Inventory Report Page
 *
 * Generate and view inventory reports with various filters and export options.
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Printer, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useReactToPrint } from 'react-to-print';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { InventoryPdf } from '@/components/reports/inventory-pdf';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useCategories } from '@/hooks/use-categories';
import { api } from '@/lib/api';

interface ReportFilters {
  warehouseId?: string;
  categoryId?: string;
  lowStockOnly: boolean;
  includeZeroStock: boolean;
  groupBy: 'warehouse' | 'category' | 'item';
}

export default function InventoryReportPage() {
  const t = useTranslations('warehouses');
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<ReportFilters>({
    lowStockOnly: false,
    includeZeroStock: false,
    groupBy: 'item',
  });
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: warehousesData } = useActiveWarehouses();
  const { data: categoriesData } = useCategories({});

  const warehouses = warehousesData?.data || [];
  const categories = categoriesData?.data || [];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Inventory Report - ${new Date().toISOString().split('T')[0]}`,
  });

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.lowStockOnly) params.append('lowStockOnly', 'true');
      if (filters.includeZeroStock) params.append('includeZeroStock', 'true');
      params.append('groupBy', filters.groupBy);
      params.append('format', 'json');

      const response = await api.get<{ data: { report: any } }>(
        `/reports/inventory?${params.toString()}`
      );
      setReportData(response.data.report);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.lowStockOnly) params.append('lowStockOnly', 'true');
      if (filters.includeZeroStock) params.append('includeZeroStock', 'true');
      params.append('groupBy', filters.groupBy);
      params.append('format', 'csv');

      const response = await fetch(`/api/v1/reports/inventory?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to export CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/warehouses')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('inventoryReport')}</h1>
            <p className="text-muted-foreground">{t('inventoryReportDescription')}</p>
          </div>
        </div>
        {reportData && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCsv}>
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reportFilters')}</CardTitle>
          <CardDescription>{t('reportFiltersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Warehouse Filter */}
            <div className="space-y-2">
              <Label>{t('warehouse')}</Label>
              <Select
                value={filters.warehouseId || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    warehouseId: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('allWarehouses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allWarehouses')}</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select
                value={filters.categoryId || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    categoryId: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allCategories')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group By */}
            <div className="space-y-2">
              <Label>{t('groupBy')}</Label>
              <Select
                value={filters.groupBy}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    groupBy: value as 'warehouse' | 'category' | 'item',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="item">{t('noGrouping')}</SelectItem>
                  <SelectItem value="warehouse">{t('byWarehouse')}</SelectItem>
                  <SelectItem value="category">{t('byCategory')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            {/* Low Stock Only */}
            <div className="flex items-center space-x-2">
              <Switch
                id="lowStockOnly"
                checked={filters.lowStockOnly}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, lowStockOnly: checked }))
                }
              />
              <Label htmlFor="lowStockOnly">{t('lowStockOnly')}</Label>
            </div>

            {/* Include Zero Stock */}
            <div className="flex items-center space-x-2">
              <Switch
                id="includeZeroStock"
                checked={filters.includeZeroStock}
                onCheckedChange={(checked) =>
                  setFilters((prev) => ({ ...prev, includeZeroStock: checked }))
                }
              />
              <Label htmlFor="includeZeroStock">{t('includeZeroStock')}</Label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGenerateReport} disabled={isLoading}>
              {isLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('generateReport')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {/* Report Preview */}
      {reportData && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reportPreview')}</CardTitle>
            <CardDescription>
              {t('generatedAt')}: {new Date(reportData.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="border rounded-lg overflow-hidden">
              <InventoryPdf
                ref={printRef}
                report={reportData}
                showLowStockHighlight={true}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
