'use client';

/**
 * Items Report Page
 *
 * Page for generating and downloading item reports as PDF.
 * Supports filtering by category and status.
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useItemsReport } from '@/hooks/use-items';
import { useCategories } from '@/hooks/use-categories';
import { downloadItemsReport } from '@/components/reports/items-report';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import type { ItemReportParams } from '@erp/shared';
import { useAuth } from '@/providers/auth-provider';
import { ArrowLeft, Download, FileText, Loader2, Eye } from 'lucide-react';

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <Skeleton className="w-full h-[600px]" /> }
);

const ItemsReportDocument = dynamic(
  () =>
    import('@/components/reports/items-report').then(
      (mod) => mod.ItemsReportDocument
    ),
  { ssr: false }
);

// =============================================================================
// CONSTANTS
// =============================================================================

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'EGP', label: 'Egyptian Pound', symbol: 'E£' },
  { value: 'SAR', label: 'Saudi Riyal', symbol: 'SAR ' },
  { value: 'AED', label: 'UAE Dirham', symbol: 'AED ' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function ItemsReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const companyName = currentUser?.tenant?.name || 'Your Company';

  // Filter state
  const [reportParams, setReportParams] = useState<ItemReportParams>({
    includePrices: true,
    priceTier: 'retail',
    currency: 'USD',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Queries
  const { data: categoriesData } = useCategories();
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useItemsReport(reportParams, {
    enabled: false, // Don't fetch automatically
  });

  // Get currency symbol
  const currencySymbol =
    CURRENCIES.find((c) => c.value === reportParams.currency)?.symbol || '$';

  // Generate filter description
  const getFilterDescription = useCallback(() => {
    const parts: string[] = [];
    if (reportParams.categoryId) {
      const category = categoriesData?.data?.find(
        (c) => c.id === reportParams.categoryId
      );
      if (category) {
        parts.push(`Category: ${category.name}`);
      }
    }
    if (reportParams.isActive !== undefined) {
      parts.push(`Status: ${reportParams.isActive ? 'Active' : 'Inactive'}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'All items';
  }, [reportParams, categoriesData]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    await refetch();
    setShowPreview(true);
  }, [refetch]);

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        await downloadItemsReport(
          {
            title: 'Inventory Items Report',
            companyName,
            items: result.data.data,
            currencySymbol,
            filterDescription: getFilterDescription(),
            generatedAt: new Date(),
          },
          `items-report-${new Date().toISOString().split('T')[0]}.pdf`
        );
        toast({
          title: 'Report downloaded',
          description: 'The PDF report has been downloaded successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [refetch, currencySymbol, getFilterDescription, toast]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Items Report</h1>
          <p className="text-muted-foreground">
            Generate and download inventory reports as PDF.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Report Options</CardTitle>
            <CardDescription>
              Configure filters and options for the report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={reportParams.categoryId || 'all'}
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    categoryId: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoriesData?.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={
                  reportParams.isActive === undefined
                    ? 'all'
                    : reportParams.isActive
                    ? 'active'
                    : 'inactive'
                }
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    isActive:
                      value === 'all'
                        ? undefined
                        : value === 'active'
                        ? true
                        : false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={reportParams.currency}
                onValueChange={(value) =>
                  setReportParams((prev) => ({ ...prev, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Include Prices */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Prices</Label>
                <p className="text-xs text-muted-foreground">
                  Show retail and wholesale prices
                </p>
              </div>
              <Switch
                checked={reportParams.includePrices}
                onCheckedChange={(checked) =>
                  setReportParams((prev) => ({ ...prev, includePrices: checked }))
                }
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handlePreview} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Report
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Preview the report before downloading.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-destructive">Failed to load report data</p>
                <Button variant="link" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : !showPreview || !reportData?.data ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Click &quot;Preview Report&quot; to see the report
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <PDFViewer width="100%" height={600} showToolbar={false}>
                  <ItemsReportDocument
                    title="Inventory Items Report"
                    companyName={companyName}
                    items={reportData.data}
                    currencySymbol={currencySymbol}
                    filterDescription={getFilterDescription()}
                    generatedAt={new Date()}
                  />
                </PDFViewer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
