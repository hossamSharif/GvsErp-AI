'use client';

/**
 * Expenses Report Page
 *
 * Page for generating and downloading expense reports as PDF.
 * Supports filtering by category, date range.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useExpenses, useExpenseCategories } from '@/hooks/use-expenses';
import { useTenantSettings } from '@/hooks/use-settings';
import {
  downloadExpensesReport,
  generateExpensesReportBlob,
} from '@/components/reports/expense-report';
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
import { useToast } from '@/hooks/use-toast';
import type { ExpenseFilters } from '@erp-saas/shared/types/expenses';
import { ArrowLeft, Download, FileText, Loader2, Eye } from 'lucide-react';

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExpensesReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('expenses');

  // Filter state
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
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

  // Queries
  const { data: categoriesData } = useExpenseCategories();
  const categories = categoriesData?.data || [];

  const {
    data: expensesData,
    isLoading,
    error,
    refetch,
  } = useExpenses(
    {
      ...filters,
      start_date: dateFrom || undefined,
      end_date: dateTo || undefined,
    },
    1,
    100 // Get up to 100 expenses for the report
  );

  // Handle preview
  const handlePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const blob = await generateExpensesReportBlob({
          expenses: result.data.data,
          startDate: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: dateTo || new Date().toISOString().split('T')[0],
          currency: 'USD',
          tenantName: companyName,
          tenantLogo: companyLogo,
        });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('report.previewError'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [refetch, pdfUrl, dateFrom, dateTo, companyName, companyLogo, toast, t]);

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        await downloadExpensesReport(
          {
            expenses: result.data.data,
            startDate: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: dateTo || new Date().toISOString().split('T')[0],
            currency: 'USD',
            tenantName: companyName,
            tenantLogo: companyLogo,
          },
          `expense-report-${new Date().toISOString().split('T')[0]}.pdf`
        );
        toast({
          title: t('success'),
          description: t('report.downloadSuccessDesc'),
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('report.downloadError'),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [refetch, dateFrom, dateTo, companyName, companyLogo, toast, t]);

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/expenses`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('report.title')}</h1>
          <p className="text-muted-foreground">
            {t('report.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>{t('report.options')}</CardTitle>
            <CardDescription>
              {t('report.optionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>{t('columns.category')}</Label>
              <Select
                value={filters.category_id || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    category_id: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('report.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('report.allCategories')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t('report.dateFrom')}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('report.dateTo')}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handlePreview} disabled={isGeneratingPreview || isLoading}>
                {isGeneratingPreview || isLoading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('report.generating')}
                  </>
                ) : (
                  <>
                    <Eye className="me-2 h-4 w-4" />
                    {t('report.preview')}
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
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('report.generating')}
                  </>
                ) : (
                  <>
                    <Download className="me-2 h-4 w-4" />
                    {t('report.downloadPDF')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('report.previewTitle')}</CardTitle>
            <CardDescription>
              {t('report.previewDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-destructive">{t('report.loadError')}</p>
                <Button variant="link" onClick={() => refetch()}>
                  {t('report.tryAgain')}
                </Button>
              </div>
            ) : isGeneratingPreview ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">{t('report.generatingPreview')}</p>
              </div>
            ) : !pdfUrl ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {t('report.clickToPreview')}
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
