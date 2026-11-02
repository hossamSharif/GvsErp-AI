'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useExpenseReport, useExpenseCategories } from '@/hooks/use-expenses';
import { useAuth } from '@/providers/auth-provider';
import { downloadExpensesReport } from '@/components/reports/expenses-report';
import type { ExpenseReportParams } from '@erp/shared';
import { labelForExpenseCategory } from '@/lib/expense-category-label';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'check', 'credit_card', 'other'];

export default function ExpensesReportPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const companyName = currentUser?.tenant?.name || 'Company';
  const t = useTranslations('expenses');

  const [reportParams, setReportParams] = useState<ExpenseReportParams>({
    includeSummary: true,
  });
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, error } = useExpenseReport(reportParams);
  // Inactive categories are still reportable
  const { data: categoriesData } = useExpenseCategories({ includeInactive: true });
  const allCategories = useMemo(
    () => (categoriesData?.data ?? []).map((c) => c.name),
    [categoriesData]
  );

  const labelForCategory = useCallback(
    (cat: string) => labelForExpenseCategory(cat, t),
    [t]
  );

  const labelForMethod = useCallback(
    (m: string | null | undefined) => {
      if (!m) return t('methods.unspecified');
      if (PAYMENT_METHODS.includes(m)) return t(`methods.${m}` as never);
      return m;
    },
    [t]
  );

  const entries = data?.data?.entries ?? [];
  const summary = data?.data?.summary;

  const formatCurrency = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    },
    [locale]
  );

  const handleBack = useCallback(() => {
    router.push(`/${locale}/expenses`);
  }, [router, locale]);

  const handleDownload = useCallback(async () => {
    if (!entries.length) {
      toast({
        title: t('toast.noData'),
        description: t('toast.noDataDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsDownloading(true);
    try {
      const filterParts: string[] = [];
      if (reportParams.category) filterParts.push(labelForCategory(reportParams.category));
      if (reportParams.paymentMethod) filterParts.push(labelForMethod(reportParams.paymentMethod));
      if (reportParams.dateFrom) filterParts.push(`from ${reportParams.dateFrom}`);
      if (reportParams.dateTo) filterParts.push(`to ${reportParams.dateTo}`);
      const filterDescription = filterParts.length ? filterParts.join(', ') : t('report.allExpenses');

      await downloadExpensesReport(
        {
          title: t('report.title'),
          companyName,
          entries,
          summary,
          currencySymbol: '$',
          filterDescription,
          generatedAt: new Date(),
        },
        `${t('report.filenamePrefix')}-${new Date().toISOString().split('T')[0]}.pdf`
      );

      toast({ title: t('toast.pdfDownloaded'), description: t('toast.pdfDownloadedDesc') });
    } catch {
      toast({
        title: t('toast.error'),
        description: t('toast.pdfError'),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [entries, summary, reportParams, companyName, toast, t, labelForCategory, labelForMethod]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Go back" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('report.title')}</h1>
          <p className="text-muted-foreground">{t('report.description')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>{t('filters')}</CardTitle>
            <CardDescription>{t('filtersDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('fields.category')}</Label>
              <Select
                value={reportParams.category || 'all'}
                onValueChange={(v) =>
                  setReportParams((p) => ({ ...p, category: v === 'all' ? undefined : v }))
                }
              >
                <SelectTrigger data-testid="report-category">
                  <SelectValue placeholder={t('placeholders.anyCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('placeholders.anyCategory')}</SelectItem>
                  {allCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {labelForCategory(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('fields.paymentMethod')}</Label>
              <Select
                value={reportParams.paymentMethod || 'all'}
                onValueChange={(v) =>
                  setReportParams((p) => ({
                    ...p,
                    paymentMethod: v === 'all' ? undefined : v,
                  }))
                }
              >
                <SelectTrigger data-testid="report-method">
                  <SelectValue placeholder={t('placeholders.anyMethod')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('placeholders.anyMethod')}</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {labelForMethod(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">{t('placeholders.fromDate')}</Label>
              <Input
                id="from"
                data-testid="report-date-from"
                type="date"
                value={reportParams.dateFrom || ''}
                onChange={(e) =>
                  setReportParams((p) => ({ ...p, dateFrom: e.target.value || undefined }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">{t('placeholders.toDate')}</Label>
              <Input
                id="to"
                data-testid="report-date-to"
                type="date"
                value={reportParams.dateTo || ''}
                onChange={(e) =>
                  setReportParams((p) => ({ ...p, dateTo: e.target.value || undefined }))
                }
              />
            </div>

            <Button
              onClick={handleDownload}
              disabled={isDownloading || isLoading}
              className="w-full"
              data-testid="report-download"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('downloadPdf')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('preview')}</CardTitle>
            <CardDescription>
              {summary
                ? `${summary.totalCount} • ${formatCurrency(summary.totalAmount)}`
                : t('previewDescription', { count: 0, total: '0' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <p className="text-destructive">{error.message || 'Failed to load report'}</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground">{t('noResults')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2 px-2">{t('fields.date')}</th>
                      <th className="text-start py-2 px-2">{t('fields.category')}</th>
                      <th className="text-start py-2 px-2">{t('fields.description')}</th>
                      <th className="text-start py-2 px-2">{t('fields.paymentMethod')}</th>
                      <th className="text-end py-2 px-2">{t('fields.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, 50).map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="py-2 px-2">{e.expenseDate}</td>
                        <td className="py-2 px-2">{labelForCategory(e.category)}</td>
                        <td className="py-2 px-2 text-muted-foreground line-clamp-1">
                          {e.description || '-'}
                        </td>
                        <td className="py-2 px-2">{labelForMethod(e.paymentMethod)}</td>
                        <td className="py-2 px-2 text-end font-medium">
                          {formatCurrency(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entries.length > 50 && (
                  <p className="mt-3 text-xs text-muted-foreground text-center">
                    + {entries.length - 50} more in PDF
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
