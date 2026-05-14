'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBalanceSheet } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';

export default function BalanceSheetPage() {
  const t = useTranslations('accounting.financialReports.balanceSheet');
  const tc = useTranslations('accounting.financialReports.common');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useBalanceSheet(asOfDate);

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
              <Label htmlFor="balance-sheet-date">{tc('asOfDate')}</Label>
              <Input id="balance-sheet-date" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
            <Button onClick={() => refetch()}>{tc('generate')}</Button>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />{tc('exportPdf')}</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64" role="status" aria-label={tc('loadingAria', { report: t('title') })}>
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">{t('assets')}</h3>
                  <Table>
                    <TableBody>
                      {data.assets.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{row.account_code}</TableCell>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{row.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={2}>{t('totalAssets')}</TableCell>
                        <TableCell className="text-right font-mono">{data.total_assets.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">{t('liabilities')}</h3>
                  <Table>
                    <TableBody>
                      {data.liabilities.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{row.account_code}</TableCell>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{row.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell colSpan={2}>{t('totalLiabilities')}</TableCell>
                        <TableCell className="text-right font-mono">{data.total_liabilities.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">{t('equity')}</h3>
                  <Table>
                    <TableBody>
                      {data.equity.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{row.account_code}</TableCell>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{row.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell colSpan={2}>{t('totalEquity')}</TableCell>
                        <TableCell className="text-right font-mono">{data.total_equity.toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={2}>{t('totalLiabilitiesEquity')}</TableCell>
                        <TableCell className="text-right font-mono">
                          {(data.total_liabilities + data.total_equity).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
