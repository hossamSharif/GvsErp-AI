'use client';

/**
 * Items Report Page
 *
 * Page for generating and downloading item reports as PDF.
 * Supports filtering by category and status.
 */

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { CurrencySelect } from '@/components/forms/currency-select';
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  EGP: 'E£',
  SAR: 'SAR ',
  AED: 'AED ',
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ItemsReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const t = useTranslations('items.report');
  const tCommon = useTranslations('common');
  const tPdf = useTranslations('items.report.pdf');
  const companyName = currentUser?.tenant?.name || t('defaultCompanyName');

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
    CURRENCY_SYMBOLS[reportParams.currency || 'USD'] || '$';

  // Generate filter description
  const getFilterDescription = useCallback(() => {
    const parts: string[] = [];
    if (reportParams.categoryId) {
      const category = categoriesData?.data?.find(
        (c) => c.id === reportParams.categoryId
      );
      if (category) {
        parts.push(t('filterCategory', { name: category.name }));
      }
    }
    if (reportParams.isActive !== undefined) {
      parts.push(
        t('filterStatus', {
          value: reportParams.isActive
            ? t('filterStatusActive')
            : t('filterStatusInactive'),
        })
      );
    }
    return parts.length > 0 ? parts.join(', ') : t('filterAllItems');
  }, [reportParams, categoriesData, t]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    await refetch();
    setShowPreview(true);
  }, [refetch]);

  // Build localized PDF labels bundle
  const getPdfLabels = useCallback(
    () => ({
      filter: tPdf('filter'),
      generated: tPdf('generated'),
      totalItems: tPdf('totalItems'),
      columnName: tPdf('columnName'),
      columnSku: tPdf('columnSku'),
      columnBarcode: tPdf('columnBarcode'),
      columnCategory: tPdf('columnCategory'),
      columnUnit: tPdf('columnUnit'),
      columnRetail: tPdf('columnRetail'),
      columnWholesale: tPdf('columnWholesale'),
      columnStatus: tPdf('columnStatus'),
      summary: tPdf('summary'),
      activeItems: tPdf('activeItems'),
      inactiveItems: tPdf('inactiveItems'),
      itemsWithRetailPrice: tPdf('itemsWithRetailPrice'),
      avgRetailPrice: tPdf('avgRetailPrice'),
      footerLabel: tPdf('footerLabel'),
      pageNumberTemplate: tPdf.raw('pageNumber') as string,
      statusActive: tPdf('statusActive'),
      statusInactive: tPdf('statusInactive'),
      locale,
    }),
    [tPdf, locale]
  );

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        await downloadItemsReport(
          {
            title: t('documentTitle'),
            companyName,
            items: result.data.data,
            currencySymbol,
            filterDescription: getFilterDescription(),
            generatedAt: new Date(),
            labels: getPdfLabels(),
          },
          `${t('fileNamePrefix')}-${new Date().toISOString().split('T')[0]}.pdf`
        );
        toast({
          title: t('toasts.downloaded'),
          description: t('toasts.downloadedDescription'),
        });
      }
    } catch (error) {
      toast({
        title: tCommon('error'),
        description: t('toasts.generateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [refetch, currencySymbol, getFilterDescription, toast, companyName, getPdfLabels, t, tCommon]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backAriaLabel')}
          onClick={() => router.push(`/${locale}/items`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>{t('optionsTitle')}</CardTitle>
            <CardDescription>{t('optionsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>{t('category')}</Label>
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
                  <SelectValue placeholder={t('categoryAll')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('categoryAll')}</SelectItem>
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
              <Label>{t('status')}</Label>
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
                  <SelectItem value="all">{t('statusAll')}</SelectItem>
                  <SelectItem value="active">{t('statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <CurrencySelect
                value={reportParams.currency}
                onValueChange={(value) =>
                  setReportParams((prev) => ({ ...prev, currency: value }))
                }
              />
            </div>

            {/* Include Prices */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('includePrices')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('includePricesDescription')}
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
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('previewButton')}
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
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('downloadButton')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('preview')}</CardTitle>
            <CardDescription>{t('previewDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-destructive">{t('errorLoading')}</p>
                <Button variant="link" onClick={() => refetch()}>
                  {tCommon('tryAgain')}
                </Button>
              </div>
            ) : !showPreview || !reportData?.data ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {t('clickToPreview')}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <PDFViewer width="100%" height={600} showToolbar={false}>
                  <ItemsReportDocument
                    title={t('documentTitle')}
                    companyName={companyName}
                    items={reportData.data}
                    currencySymbol={currencySymbol}
                    filterDescription={getFilterDescription()}
                    generatedAt={new Date()}
                    labels={getPdfLabels()}
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
