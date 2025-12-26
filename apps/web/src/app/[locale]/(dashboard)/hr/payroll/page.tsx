'use client';

/**
 * Payroll Management Page
 *
 * Process payroll runs, view payroll history, and manage employee salaries.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Download, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/tables/data-table';
import { ColumnDef } from '@tanstack/react-table';

// Mock data
const usePayrollRuns = () => {
  return {
    data: {
      data: [
        {
          id: '1',
          period_start: '2025-01-01',
          period_end: '2025-01-31',
          status: 'completed',
          total_gross: 50000,
          total_deductions: 5000,
          total_net: 45000,
          created_at: '2025-02-01',
        },
        {
          id: '2',
          period_start: '2024-12-01',
          period_end: '2024-12-31',
          status: 'completed',
          total_gross: 48000,
          total_deductions: 4800,
          total_net: 43200,
          created_at: '2025-01-01',
        },
      ],
      meta: { total: 2, page: 1, limit: 50 },
    },
    isLoading: false,
  };
};

const getStatusVariant = (status: string) => {
  const variants: Record<string, string> = {
    draft: 'secondary',
    processing: 'default',
    completed: 'default',
  };
  return variants[status] || 'secondary';
};

export default function PayrollPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr');
  const tc = useTranslations('common');
  const { data, isLoading } = usePayrollRuns();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'period_start',
      header: t('payroll.fields.periodStart'),
      cell: ({ row }) => {
        const start = new Date(row.original.period_start).toLocaleDateString(locale, {
          month: 'short',
          year: 'numeric',
        });
        const end = new Date(row.original.period_end).toLocaleDateString(locale, {
          day: 'numeric',
        });
        return `${start} - ${end}`;
      },
    },
    {
      accessorKey: 'status',
      header: t('payroll.fields.status'),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status) as any}>
          {t(`payroll.statuses.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'total_gross',
      header: t('payroll.fields.totalGross'),
      cell: ({ row }) => `$${row.original.total_gross.toLocaleString(locale)}`,
    },
    {
      accessorKey: 'total_deductions',
      header: t('payroll.fields.totalDeductions'),
      cell: ({ row }) => `$${row.original.total_deductions.toLocaleString(locale)}`,
    },
    {
      accessorKey: 'total_net',
      header: t('payroll.fields.totalNet'),
      cell: ({ row }) => (
        <span className="font-semibold">
          ${row.original.total_net.toLocaleString(locale)}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: tc('actions'),
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(locale),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            {t('payroll.viewRun')}
          </Button>
          {row.original.status === 'completed' && (
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const latestPayroll = data?.data?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('payroll.title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {tc('export')}
          </Button>
          <Button onClick={() => router.push(`/${locale}/hr/payroll/new`)}>
            <Plus className="me-2 h-4 w-4" />
            {t('payroll.newRun')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('payroll.fields.totalNet')}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              ${latestPayroll?.total_net.toLocaleString(locale) || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('payroll.fields.netSalary')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('payroll.fields.totalGross')}</CardDescription>
            <CardTitle className="text-2xl">
              ${latestPayroll?.total_gross.toLocaleString(locale) || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('payroll.fields.totalDeductions')}</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              ${latestPayroll?.total_deductions.toLocaleString(locale) || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('payroll.summary.totalEmployees')}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              ${data?.data?.reduce((sum, p) => sum + p.total_net, 0).toLocaleString(locale) || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.title')}</CardTitle>
          <CardDescription>{t('payroll.viewRun')}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.processPayroll')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside rtl:list-inside">
            <li>{t('payroll.newRun')}</li>
            <li>{t('attendance.viewAttendance')}</li>
            <li>{t('payroll.fields.grossSalary')}, {t('payroll.fields.deductions')}, {t('payroll.fields.netSalary')}</li>
            <li>{t('payroll.viewRun')}</li>
            <li>{t('payroll.processPayroll')}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
