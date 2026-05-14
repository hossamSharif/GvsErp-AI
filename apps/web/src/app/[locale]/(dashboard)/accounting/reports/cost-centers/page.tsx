'use client';

/**
 * Cost Center Totals Report (Phase 7)
 *
 * Sum of allocated debit/credit per cost center over a date range. Groups
 * rows by category to mirror Tally's "Category Summary" view.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCostCenterTotals } from '@/hooks/use-cost-centers';
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
import { Loader2, Layers } from 'lucide-react';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function firstOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function CostCenterTotalsPage() {
  const t = useTranslations('accounting.reports.costCenterTotals');

  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());

  const { data, isLoading } = useCostCenterTotals(startDate, endDate);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6" /> {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="cc-totals-start">{t('startDate')}</Label>
              <Input
                id="cc-totals-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-totals-end">{t('endDate')}</Label>
              <Input
                id="cc-totals-end"
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
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.category')}</TableHead>
                  <TableHead>{t('columns.code')}</TableHead>
                  <TableHead>{t('columns.name')}</TableHead>
                  <TableHead className="text-right">{t('columns.debit')}</TableHead>
                  <TableHead className="text-right">{t('columns.credit')}</TableHead>
                  <TableHead className="text-right">{t('columns.net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.cost_center_id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.category_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.cost_center_code}</TableCell>
                    <TableCell className="font-medium">{row.cost_center_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.total_debit > 0.01 ? formatNumber.format(row.total_debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.total_credit > 0.01 ? formatNumber.format(row.total_credit) : '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-medium ${
                        row.net < 0 ? 'text-red-600' : ''
                      }`}
                    >
                      {formatNumber.format(row.net)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    {t('total')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatNumber.format(data.grand_total_debit)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatNumber.format(data.grand_total_credit)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber.format(data.grand_total_debit - data.grand_total_credit)}
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
