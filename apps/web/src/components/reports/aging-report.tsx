'use client';

/**
 * Aging Report (Phase 6)
 *
 * Reusable view for receivables and payables aging. The Aging Receivables
 * and Aging Payables pages mount this with the appropriate variant.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAgingReceivables, useAgingPayables } from '@/hooks/use-accounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Clock, ExternalLink } from 'lucide-react';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

interface AgingReportPageProps {
  /** "receivables" → customers, "payables" → suppliers */
  variant: 'receivables' | 'payables';
}

export function AgingReportPage({ variant }: AgingReportPageProps) {
  const t = useTranslations('accounting.reports.aging');
  const { locale } = useParams();
  const [asOf, setAsOf] = useState(todayIso());

  const receivables = useAgingReceivables(variant === 'receivables' ? asOf : '');
  const payables = useAgingPayables(variant === 'payables' ? asOf : '');
  const query = variant === 'receivables' ? receivables : payables;

  const partyHrefBase = variant === 'receivables' ? `/${locale}/customers` : `/${locale}/suppliers`;

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const data = query.data;
  const buckets = data?.bucket_definitions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {t(variant === 'receivables' ? 'receivablesTitle' : 'payablesTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t(variant === 'receivables' ? 'receivablesDescription' : 'payablesDescription')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="aging-as-of">{t('asOfDate')}</Label>
            <Input
              id="aging-as-of"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !data || data.parties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.party')}</TableHead>
                  {buckets.map((b) => (
                    <TableHead key={b.label} className="text-right">
                      {b.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-bold">{t('columns.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.parties.map((row) => (
                  <TableRow key={row.party_id}>
                    <TableCell>
                      <Link
                        href={`${partyHrefBase}/${row.party_id}`}
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        {row.party_name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </TableCell>
                    {row.buckets.map((b) => (
                      <TableCell key={b.label} className="text-right font-mono text-sm">
                        {b.amount > 0.01 ? formatNumber.format(b.amount) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono font-medium">
                      {formatNumber.format(row.total_outstanding)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">{t('totals')}</TableCell>
                  {data.totals.buckets.map((b) => (
                    <TableCell key={b.label} className="text-right font-mono font-medium">
                      {b.amount > 0.01 ? formatNumber.format(b.amount) : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber.format(data.totals.total_outstanding)}
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
