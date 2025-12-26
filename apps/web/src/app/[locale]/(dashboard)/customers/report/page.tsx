'use client';

/**
 * Customer Balances Report Page
 *
 * Page for generating and downloading customer balance reports as PDF.
 * Supports filtering by balance status and active/inactive customers.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCustomerBalanceReport } from '@/hooks/use-parties';
import { useTenantSettings } from '@/hooks/use-settings';
import {
  downloadCustomerBalancesReport,
  generateCustomerBalancesReportBlob,
} from '@/components/reports/customer-balances-report';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/ui/use-toast';
import type { CustomerBalanceReportParams } from '@erp-saas/shared';
import { ArrowLeft, Download, FileText, Loader2, Eye } from 'lucide-react';

// =============================================================================
// COMPONENT
// =============================================================================

export default function CustomersReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  // Filter state
  const [reportParams, setReportParams] = useState<CustomerBalanceReportParams>({
    hasBalance: undefined,
    includeInactive: false,
  });
  const [minBalance, setMinBalance] = useState<string>('');
  const [maxBalance, setMaxBalance] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch tenant settings for company info
  const { data: settingsData } = useTenantSettings();
  const companyName = settingsData?.data?.company_name || 'Your Company';
  const companyLogo = settingsData?.data?.logo_url || undefined;

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Query - disabled by default until user clicks preview
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useCustomerBalanceReport(
    {
      ...reportParams,
      minBalance: minBalance ? parseFloat(minBalance) : undefined,
      maxBalance: maxBalance ? parseFloat(maxBalance) : undefined,
    },
    { enabled: false }
  );

  // Generate filter description
  const getFilterDescription = useCallback(() => {
    const parts: string[] = [];
    if (reportParams.hasBalance === true) {
      parts.push('With Outstanding Balance');
    } else if (reportParams.hasBalance === false) {
      parts.push('Zero Balance Only');
    }
    if (reportParams.includeInactive) {
      parts.push('Including Inactive');
    }
    if (minBalance) {
      parts.push(`Min Balance: $${minBalance}`);
    }
    if (maxBalance) {
      parts.push(`Max Balance: $${maxBalance}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'All customers';
  }, [reportParams, minBalance, maxBalance]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const result = await refetch();
      const entries = result.data?.data?.entries;
      if (entries) {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        // Map entries to the expected PartyBalanceSummary format
        const customers = entries.map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          phone: entry.phone,
          balance: entry.balance,
          isActive: true, // Default to active since we filtered by active
        }));
        const blob = await generateCustomerBalancesReportBlob({
          title: 'Customer Balances Report',
          companyName,
          companyLogo,
          customers,
          currencySymbol: '$',
          filterDescription: getFilterDescription(),
          generatedAt: new Date(),
        });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate preview',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [refetch, pdfUrl, getFilterDescription, toast]);

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await refetch();
      const entries = result.data?.data?.entries;
      if (entries) {
        // Map entries to the expected PartyBalanceSummary format
        const customers = entries.map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          phone: entry.phone,
          balance: entry.balance,
          isActive: true, // Default to active since we filtered by active
        }));
        await downloadCustomerBalancesReport(
          {
            title: 'Customer Balances Report',
            companyName,
            companyLogo,
            customers,
            currencySymbol: '$',
            filterDescription: getFilterDescription(),
            generatedAt: new Date(),
          },
          `customer-balances-${new Date().toISOString().split('T')[0]}.pdf`
        );
        toast({
          title: 'Report downloaded',
          description: 'The PDF report has been downloaded successfully.',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [refetch, getFilterDescription, toast]);

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/customers`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Balances Report</h1>
          <p className="text-muted-foreground">
            Generate and download customer balance reports as PDF.
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
            {/* Balance Filter */}
            <div className="space-y-2">
              <Label>Balance Status</Label>
              <Select
                value={
                  reportParams.hasBalance === undefined
                    ? 'all'
                    : reportParams.hasBalance
                    ? 'with_balance'
                    : 'zero_balance'
                }
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    hasBalance:
                      value === 'all'
                        ? undefined
                        : value === 'with_balance'
                        ? true
                        : false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="with_balance">With Outstanding Balance</SelectItem>
                  <SelectItem value="zero_balance">Zero Balance Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Inactive Filter */}
            <div className="space-y-2">
              <Label>Customer Status</Label>
              <Select
                value={reportParams.includeInactive ? 'all' : 'active_only'}
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    includeInactive: value === 'all',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_only">Active Only</SelectItem>
                  <SelectItem value="all">Include Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Balance */}
            <div className="space-y-2">
              <Label>Minimum Balance ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Max Balance */}
            <div className="space-y-2">
              <Label>Maximum Balance ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={maxBalance}
                onChange={(e) => setMaxBalance(e.target.value)}
                placeholder="No limit"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handlePreview} disabled={isGeneratingPreview || isLoading}>
                {isGeneratingPreview || isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
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
            ) : isGeneratingPreview ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Generating PDF preview...</p>
              </div>
            ) : !pdfUrl ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Click &quot;Preview Report&quot; to see the report
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={pdfUrl}
                  width="100%"
                  height={600}
                  className="border-0"
                  title="PDF Preview"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
