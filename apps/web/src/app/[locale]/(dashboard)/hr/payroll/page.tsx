'use client';

/**
 * Payroll Management Page
 *
 * Process payroll runs, view payroll history, and manage employee salaries.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

const getStatusBadge = (status: string) => {
  const variants: Record<string, any> = {
    draft: { variant: 'secondary', label: 'Draft' },
    processing: { variant: 'default', label: 'Processing' },
    completed: { variant: 'default', label: 'Completed' },
  };

  const config = variants[status] || variants.draft;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default function PayrollPage() {
  const router = useRouter();
  const { data, isLoading } = usePayrollRuns();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'period_start',
      header: 'Period',
      cell: ({ row }) => {
        const start = new Date(row.original.period_start).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
        const end = new Date(row.original.period_end).toLocaleDateString('en-US', {
          day: 'numeric',
        });
        return `${start} - ${end}`;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'total_gross',
      header: 'Gross Pay',
      cell: ({ row }) => `$${row.original.total_gross.toLocaleString()}`,
    },
    {
      accessorKey: 'total_deductions',
      header: 'Deductions',
      cell: ({ row }) => `$${row.original.total_deductions.toLocaleString()}`,
    },
    {
      accessorKey: 'total_net',
      header: 'Net Pay',
      cell: ({ row }) => (
        <span className="font-semibold">
          ${row.original.total_net.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            View
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
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">
            Process and manage employee payroll
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Payroll Run
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Payroll (Jan 2025)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              ${latestPayroll?.total_net.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Net pay distributed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Pay</CardDescription>
            <CardTitle className="text-2xl">
              ${latestPayroll?.total_gross.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Deductions</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              ${latestPayroll?.total_deductions.toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>YTD Total</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              ${data?.data?.reduce((sum, p) => sum + p.total_net, 0).toLocaleString() || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Payroll Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>View and manage past payroll runs</CardDescription>
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
          <CardTitle>Payroll Process</CardTitle>
          <CardDescription>Steps to process payroll</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Create a new payroll run for the period</li>
            <li>Review employee attendance and work hours</li>
            <li>Calculate gross pay, deductions, and net pay</li>
            <li>Review the payroll summary</li>
            <li>Process and post to accounting</li>
            <li>Generate salary slips for employees</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
