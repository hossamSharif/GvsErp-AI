'use client';

/**
 * Day Book Page (Phase 6)
 *
 * Chronological list of every posted voucher in a date range, with running
 * debit/credit totals. Tally's daily-review screen.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useDayBook } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ExternalLink, CalendarRange } from 'lucide-react';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function firstOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function resolveSourceHref(
  locale: string,
  sourceType: string | null,
  sourceId: string | null
): string | null {
  if (!sourceType || !sourceId) return null;
  switch (sourceType) {
    case 'sale':
      return `/${locale}/sales/${sourceId}`;
    case 'purchase':
      return `/${locale}/purchases/${sourceId}`;
    case 'payment':
      return `/${locale}/payments/${sourceId}`;
    case 'expense':
      return `/${locale}/expenses/${sourceId}/edit`;
    default:
      return null;
  }
}

export default function DayBookPage() {
  const t = useTranslations('accounting.reports.dayBook');
  const { locale } = useParams();

  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());

  const { data, isLoading } = useDayBook(startDate, endDate);

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="day-book-start">{t('startDate')}</Label>
              <Input
                id="day-book-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="day-book-end">{t('endDate')}</Label>
              <Input
                id="day-book-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.entryNumber')}</TableHead>
                  <TableHead>{t('columns.description')}</TableHead>
                  <TableHead>{t('columns.source')}</TableHead>
                  <TableHead className="text-right">{t('columns.debit')}</TableHead>
                  <TableHead className="text-right">{t('columns.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => {
                  const href = resolveSourceHref(
                    locale as string,
                    entry.source_type,
                    entry.source_id
                  );
                  return (
                    <TableRow key={entry.entry_id}>
                      <TableCell className="text-sm">{entry.entry_date}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.entry_number}
                      </TableCell>
                      <TableCell className="text-sm">{entry.description || '-'}</TableCell>
                      <TableCell>
                        {entry.source_type && (
                          <div className="flex items-center gap-1 text-sm">
                            <Badge variant="outline" className="font-normal capitalize">
                              {entry.source_type.replace('-', ' ')}
                            </Badge>
                            {href && (
                              <Link
                                href={href}
                                className="text-muted-foreground hover:underline"
                                aria-label="Open source"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.total_debit > 0 ? formatNumber.format(entry.total_debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.total_credit > 0 ? formatNumber.format(entry.total_credit) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    {t('totalCount', { count: data.count })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatNumber.format(data.total_debit)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatNumber.format(data.total_credit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
