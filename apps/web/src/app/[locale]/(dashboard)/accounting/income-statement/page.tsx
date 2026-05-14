'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useIncomeStatement } from '@/hooks/use-accounting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';

export default function IncomeStatementPage() {
  const t = useTranslations('accounting.financialReports.incomeStatement');
  const tc = useTranslations('accounting.financialReports.common');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useIncomeStatement(startDate, endDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="income-start-date">{tc('startDate')}</Label>
              <Input id="income-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income-end-date">{tc('endDate')}</Label>
              <Input id="income-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={() => refetch()}>{tc('generate')}</Button>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />{tc('exportPdf')}</Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64" role="status" aria-label={tc('loadingAria', { report: t('title') })}>
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">{t('revenue')}</h3>
                <Table>
                  <TableBody>
                    {data.revenues.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{row.account_code}</TableCell>
                        <TableCell>{row.account_name}</TableCell>
                        <TableCell className="text-right font-mono">{row.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={2}>{t('totalRevenue')}</TableCell>
                      <TableCell className="text-right font-mono">{data.total_revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('expenses')}</h3>
                <Table>
                  <TableBody>
                    {data.expenses.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{row.account_code}</TableCell>
                        <TableCell>{row.account_name}</TableCell>
                        <TableCell className="text-right font-mono">{row.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={2}>{t('totalExpenses')}</TableCell>
                      <TableCell className="text-right font-mono">{data.total_expenses.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="border-t-2 pt-4">
                <Table>
                  <TableBody>
                    <TableRow className="font-bold text-lg">
                      <TableCell colSpan={2}>{t('netIncome')}</TableCell>
                      <TableCell className={`text-right font-mono ${data.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.net_income.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
