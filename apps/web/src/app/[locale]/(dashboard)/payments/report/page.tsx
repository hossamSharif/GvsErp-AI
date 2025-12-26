'use client';

/**
 * Payments Report Page
 *
 * Page for generating and downloading payment reports as PDF.
 * Supports filtering by type, party, date range, and payment method.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePayments } from '@/hooks/use-payments';
import { useParties } from '@/hooks/use-parties';
import { useTenantSettings } from '@/hooks/use-settings';
import { downloadPaymentsReport, generatePaymentsReportBlob } from '@/components/reports/payments-report';
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
import type { PaymentQueryParams } from '@erp-saas/shared';
import { ArrowLeft, Download, FileText, Loader2, Eye } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function PaymentsReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('payments');
  const tc = useTranslations('common');

  // Filter state
  const [reportParams, setReportParams] = useState<PaymentQueryParams>({
    page: 1,
    limit: 100, // Maximum allowed by validation
    sortBy: 'paymentDate',
    sortDir: 'desc',
  });
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
  const { data: customersData } = useParties({ type: 'customer', limit: 100 });
  const { data: suppliersData } = useParties({ type: 'supplier', limit: 100 });
  const {
    data: paymentsData,
    isLoading,
    error,
    refetch,
  } = usePayments(
    {
      ...reportParams,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: false }
  );

  const allParties = [
    ...(customersData?.data || []),
    ...(suppliersData?.data || []),
  ];

  // Generate filter description
  const getFilterDescription = useCallback(() => {
    const parts: string[] = [];
    if (reportParams.type) {
      parts.push(`Type: ${reportParams.type === 'received' ? 'Received' : 'Made'}`);
    }
    if (reportParams.partyId) {
      const party = allParties.find((p) => p.id === reportParams.partyId);
      if (party) {
        parts.push(`Party: ${party.name}`);
      }
    }
    if (reportParams.paymentMethod) {
      parts.push(`Method: ${reportParams.paymentMethod}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'All payments';
  }, [reportParams, allParties]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        const blob = await generatePaymentsReportBlob({
          title: 'Payments Report',
          companyName,
          companyLogo,
          payments: result.data.data,
          currencySymbol: '$',
          filterDescription: getFilterDescription(),
          dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
          generatedAt: new Date(),
        });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      }
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('report.previewError'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [refetch, pdfUrl, getFilterDescription, dateFrom, dateTo, toast, t, tc]);

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await refetch();
      if (result.data?.data) {
        await downloadPaymentsReport(
          {
            title: 'Payments Report',
            companyName,
            companyLogo,
            payments: result.data.data,
            currencySymbol: '$',
            filterDescription: getFilterDescription(),
            dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
            generatedAt: new Date(),
          },
          `payments-report-${new Date().toISOString().split('T')[0]}.pdf`
        );
        toast({
          title: t('report.downloadSuccess'),
          description: t('report.downloadSuccessDesc'),
        });
      }
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('report.downloadError'),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [refetch, getFilterDescription, dateFrom, dateTo, toast, t, tc]);

  return (
    <div className="space-y-6 p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/payments`)}
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
            {/* Payment Type Filter */}
            <div className="space-y-2">
              <Label>{t('fields.type')}</Label>
              <Select
                value={reportParams.type || 'all'}
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    type: value === 'all' ? undefined : (value as 'received' | 'made'),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('report.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('report.allTypes')}</SelectItem>
                  <SelectItem value="received">{t('receivedOnly')}</SelectItem>
                  <SelectItem value="made">{t('madeOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Party Filter */}
            <div className="space-y-2">
              <Label>{t('fields.party')}</Label>
              <Select
                value={reportParams.partyId || 'all'}
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    partyId: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('report.allParties')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('report.allParties')}</SelectItem>
                  {allParties.map((party) => (
                    <SelectItem key={party.id} value={party.id}>
                      {party.name} ({party.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method Filter */}
            <div className="space-y-2">
              <Label>{t('fields.paymentMethod')}</Label>
              <Select
                value={reportParams.paymentMethod || 'all'}
                onValueChange={(value) =>
                  setReportParams((prev) => ({
                    ...prev,
                    paymentMethod: value === 'all' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('report.generating')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('report.generating')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
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
