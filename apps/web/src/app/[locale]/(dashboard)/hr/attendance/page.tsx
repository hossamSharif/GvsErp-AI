'use client';

/**
 * Attendance Management Page
 *
 * Track employee attendance with check-in/out, leave management,
 * and daily attendance reports.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Calendar as CalendarIcon, Clock, Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/tables/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock data
const useAttendance = () => {
  return {
    data: {
      data: [
        {
          id: '1',
          date: '2025-01-15',
          employee: { employee_number: 'EMP-0001', full_name: 'John Doe' },
          check_in: '2025-01-15T09:00:00',
          check_out: '2025-01-15T17:30:00',
          status: 'present',
          notes: null,
        },
        {
          id: '2',
          date: '2025-01-15',
          employee: { employee_number: 'EMP-0002', full_name: 'Jane Smith' },
          check_in: '2025-01-15T08:45:00',
          check_out: null,
          status: 'present',
          notes: null,
        },
      ],
      meta: { total: 2, page: 1, limit: 50 },
    },
    isLoading: false,
  };
};

const getStatusVariant = (status: string) => {
  const variants: Record<string, string> = {
    present: 'default',
    absent: 'destructive',
    leave: 'secondary',
    holiday: 'outline',
  };
  return variants[status] || 'default';
};

const calculateHours = (checkIn: string | null, checkOut: string | null) => {
  if (!checkIn || !checkOut) return '-';
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return `${hours.toFixed(2)}h`;
};

export default function AttendancePage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr');
  const tc = useTranslations('common');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useAttendance();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee.employee_number',
      header: t('attendance.fields.employee'),
    },
    {
      accessorKey: 'employee.full_name',
      header: t('employees.fields.fullName'),
    },
    {
      accessorKey: 'date',
      header: t('attendance.fields.date'),
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(locale),
    },
    {
      accessorKey: 'check_in',
      header: t('attendance.fields.checkIn'),
      cell: ({ row }) => {
        if (!row.original.check_in) return '-';
        return new Date(row.original.check_in).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      accessorKey: 'check_out',
      header: t('attendance.fields.checkOut'),
      cell: ({ row }) => {
        if (!row.original.check_out) return '-';
        return new Date(row.original.check_out).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      id: 'hours',
      header: t('attendance.fields.workHours'),
      cell: ({ row }) => calculateHours(row.original.check_in, row.original.check_out),
    },
    {
      accessorKey: 'status',
      header: t('attendance.fields.status'),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status) as any}>
          {t(`attendance.statuses.${row.original.status}`)}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('attendance.title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {tc('export')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('attendance.summary.presentDays')}</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6" />
              {data?.data?.filter((a) => a.status === 'present').length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('attendance.summary.totalDays')}: {data?.meta?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('attendance.statuses.present')}</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {data?.data?.filter((a) => a.status === 'present').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('attendance.statuses.absent')}</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {data?.data?.filter((a) => a.status === 'absent').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('attendance.statuses.leave')}</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {data?.data?.filter((a) => a.status === 'leave').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('attendance.viewAttendance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[200px]"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc('allStatus')}</SelectItem>
                <SelectItem value="present">{t('attendance.statuses.present')}</SelectItem>
                <SelectItem value="absent">{t('attendance.statuses.absent')}</SelectItem>
                <SelectItem value="leave">{t('attendance.statuses.leave')}</SelectItem>
                <SelectItem value="holiday">{t('attendance.statuses.holiday')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{tc('actions')}</CardTitle>
          <CardDescription>{t('attendance.markAttendance')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start rtl:items-end">
              <Clock className="h-6 w-6 mb-2" />
              <div className="text-start">
                <div className="font-semibold">{t('attendance.fields.checkIn')}</div>
                <div className="text-sm text-muted-foreground">{t('attendance.markAttendance')}</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start rtl:items-end">
              <Clock className="h-6 w-6 mb-2" />
              <div className="text-start">
                <div className="font-semibold">{t('attendance.fields.checkOut')}</div>
                <div className="text-sm text-muted-foreground">{t('attendance.markAttendance')}</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start rtl:items-end">
              <CalendarIcon className="h-6 w-6 mb-2" />
              <div className="text-start">
                <div className="font-semibold">{t('attendance.statuses.holiday')}</div>
                <div className="text-sm text-muted-foreground">{t('attendance.markAttendance')}</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
