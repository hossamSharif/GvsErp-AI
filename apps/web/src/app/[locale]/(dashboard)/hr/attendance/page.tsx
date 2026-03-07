'use client';

/**
 * Attendance Management Page
 *
 * Track employee attendance with check-in/out, leave management,
 * and daily attendance reports.
 */

import { useState } from 'react';
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

const getStatusBadge = (status: string) => {
  const variants: Record<string, any> = {
    present: { variant: 'default', label: 'Present' },
    absent: { variant: 'destructive', label: 'Absent' },
    leave: { variant: 'secondary', label: 'On Leave' },
    holiday: { variant: 'outline', label: 'Holiday' },
  };

  const config = variants[status] || variants.present;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const calculateHours = (checkIn: string | null, checkOut: string | null) => {
  if (!checkIn || !checkOut) return '-';
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return `${hours.toFixed(2)}h`;
};

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useAttendance();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee.employee_number',
      header: 'Employee #',
    },
    {
      accessorKey: 'employee.full_name',
      header: 'Name',
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    {
      accessorKey: 'check_in',
      header: 'Check In',
      cell: ({ row }) => {
        if (!row.original.check_in) return '-';
        return new Date(row.original.check_in).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      accessorKey: 'check_out',
      header: 'Check Out',
      cell: ({ row }) => {
        if (!row.original.check_out) return '-';
        return new Date(row.original.check_out).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      id: 'hours',
      header: 'Hours',
      cell: ({ row }) => calculateHours(row.original.check_in, row.original.check_out),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">
            Track employee attendance and work hours
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Showing</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6" />
              {data?.data?.length || 0}
              <span className="text-sm font-normal text-muted-foreground">
                of {data?.meta?.total || 0}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Present</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {data?.data?.filter((a) => a.status === 'present').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Absent</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {data?.data?.filter((a) => a.status === 'absent').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>On Leave</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {data?.data?.filter((a) => a.status === 'leave').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
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
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
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
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common attendance operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <Clock className="h-6 w-6 mb-2" />
              <div className="text-left">
                <div className="font-semibold">Check In</div>
                <div className="text-sm text-muted-foreground">Mark employee check-in</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <Clock className="h-6 w-6 mb-2" />
              <div className="text-left">
                <div className="font-semibold">Check Out</div>
                <div className="text-sm text-muted-foreground">Mark employee check-out</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <CalendarIcon className="h-6 w-6 mb-2" />
              <div className="text-left">
                <div className="font-semibold">Mark Holiday</div>
                <div className="text-sm text-muted-foreground">Set day as holiday</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
