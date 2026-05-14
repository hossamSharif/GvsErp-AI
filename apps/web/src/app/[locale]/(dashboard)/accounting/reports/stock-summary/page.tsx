'use client';

/**
 * Stock Summary Page (Phase 5)
 *
 * Tally Stock Summary: qty + value per item, computed from the remaining
 * FIFO layers. Only items with non-zero stock are listed.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useStockSummary } from '@/hooks/use-accounting';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Boxes } from 'lucide-react';

export default function StockSummaryPage() {
  const t = useTranslations('accounting.reports.stockSummary');
  const { data, isLoading } = useStockSummary();

  const formatNumber = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const formatQty = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Boxes className="h-6 w-6" /> {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.item')}</TableHead>
                  <TableHead>{t('columns.sku')}</TableHead>
                  <TableHead className="text-right">{t('columns.qty')}</TableHead>
                  <TableHead className="text-right">{t('columns.avgCost')}</TableHead>
                  <TableHead className="text-right">{t('columns.value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.item_id}>
                    <TableCell className="font-medium">{row.item_name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {row.sku ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatQty.format(row.total_qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber.format(row.avg_unit_cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatNumber.format(row.total_value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    {t('total')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber.format(data.grand_total_value)}
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
