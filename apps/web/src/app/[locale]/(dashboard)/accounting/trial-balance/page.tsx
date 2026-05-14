'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTrialBalance } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';

export default function TrialBalancePage() {
  const t = useTranslations('accounting.financialReports.trialBalance');
  const tc = useTranslations('accounting.financialReports.common');
  const tType = useTranslations('accounting.accounts.type');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useTrialBalance(asOfDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 mb-6">
            <div className="flex-1 max-w-xs space-y-2">
              <Label htmlFor="trial-balance-date">{tc('asOfDate')}</Label>
              <Input id="trial-balance-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
            <Button onClick={() => refetch()}>{tc('generate')}</Button>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />{tc('exportPdf')}</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64" role="status" aria-label={tc('loadingAria', { report: t('title') })}>
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.accountCode')}</TableHead>
                  <TableHead>{t('columns.accountName')}</TableHead>
                  <TableHead>{t('columns.type')}</TableHead>
                  <TableHead className="text-right">{t('columns.debit')}</TableHead>
                  <TableHead className="text-right">{t('columns.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{row.account_code}</TableCell>
                    <TableCell>{row.account_name}</TableCell>
                    <TableCell>{tType(row.account_type)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.debit > 0 ? row.debit.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.credit > 0 ? row.credit.toFixed(2) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">{t('totals')}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{data.total_debits.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{data.total_credits.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
