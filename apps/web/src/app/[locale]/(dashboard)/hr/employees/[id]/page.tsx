'use client';

/**
 * Employee Detail Page
 *
 * Displays comprehensive employee information including personal details,
 * attendance history, leave requests, and payroll records.
 */

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, UserCircle, Calendar, DollarSign, ClipboardList, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Separator } from '@/components/ui/separator';

// Mock data - replace with actual API hooks
const useEmployee = (id: string) => {
  return {
    data: {
      id,
      employee_number: 'EMP-0001',
      full_name: 'John Doe',
      department: 'IT',
      position: 'Software Engineer',
      hire_date: '2024-01-15',
      salary: 5000,
      salary_currency: 'USD',
      is_active: true,
      user_id: 'user-123',
      email: 'john.doe@company.com',
      phone: '+1234567890',
      address: '123 Main St, City, Country',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    },
    isLoading: false,
  };
};

const useEmployeeAttendance = (employeeId: string) => {
  return {
    data: {
      data: [
        {
          id: '1',
          date: '2024-12-13',
          check_in: '2024-12-13T09:00:00Z',
          check_out: '2024-12-13T17:00:00Z',
          status: 'present',
          notes: '',
        },
        {
          id: '2',
          date: '2024-12-12',
          check_in: '2024-12-12T09:15:00Z',
          check_out: '2024-12-12T17:30:00Z',
          status: 'present',
          notes: '',
        },
      ],
      meta: { total: 2, page: 1, limit: 10, total_pages: 1 },
    },
    isLoading: false,
  };
};

const useEmployeeLeaveRequests = (employeeId: string) => {
  return {
    data: {
      data: [
        {
          id: '1',
          leave_type: 'vacation',
          start_date: '2024-12-20',
          end_date: '2024-12-27',
          days_count: 6,
          reason: 'Annual vacation',
          status: 'approved',
          created_at: '2024-12-01T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, total_pages: 1 },
    },
    isLoading: false,
  };
};

const useEmployeePayroll = (employeeId: string) => {
  return {
    data: {
      data: [
        {
          id: '1',
          period_start: '2024-11-01',
          period_end: '2024-11-30',
          gross_salary: 5000,
          deductions: 500,
          net_salary: 4500,
          currency: 'USD',
          days_worked: 22,
          created_at: '2024-12-01T00:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, total_pages: 1 },
    },
    isLoading: false,
  };
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const locale = params.locale as string;
  const { data: employee, isLoading } = useEmployee(id);
  const { data: attendanceData } = useEmployeeAttendance(id);
  const { data: leaveData } = useEmployeeLeaveRequests(id);
  const { data: payrollData } = useEmployeePayroll(id);

  const attendanceColumns: ColumnDef<any>[] = [
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
        return new Date(row.original.check_in).toLocaleTimeString();
      },
    },
    {
      accessorKey: 'check_out',
      header: 'Check Out',
      cell: ({ row }) => {
        if (!row.original.check_out) return '-';
        return new Date(row.original.check_out).toLocaleTimeString();
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const statusColors: Record<string, string> = {
          present: 'default',
          absent: 'destructive',
          leave: 'secondary',
          holiday: 'outline',
        };
        return (
          <Badge variant={statusColors[row.original.status] as any}>
            {row.original.status}
          </Badge>
        );
      },
    },
  ];

  const leaveColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'leave_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="capitalize">{row.original.leave_type}</span>
      ),
    },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: ({ row }) => new Date(row.original.start_date).toLocaleDateString(),
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: ({ row }) => new Date(row.original.end_date).toLocaleDateString(),
    },
    {
      accessorKey: 'days_count',
      header: 'Days',
      cell: ({ row }) => `${row.original.days_count} days`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const statusColors: Record<string, string> = {
          pending: 'secondary',
          approved: 'default',
          rejected: 'destructive',
        };
        return (
          <Badge variant={statusColors[row.original.status] as any}>
            {row.original.status}
          </Badge>
        );
      },
    },
  ];

  const payrollColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'period_start',
      header: 'Period',
      cell: ({ row }) => {
        const start = new Date(row.original.period_start).toLocaleDateString();
        const end = new Date(row.original.period_end).toLocaleDateString();
        return `${start} - ${end}`;
      },
    },
    {
      accessorKey: 'days_worked',
      header: 'Days Worked',
      cell: ({ row }) => row.original.days_worked || '-',
    },
    {
      accessorKey: 'gross_salary',
      header: 'Gross',
      cell: ({ row }) =>
        `${row.original.currency} ${row.original.gross_salary.toLocaleString()}`,
    },
    {
      accessorKey: 'deductions',
      header: 'Deductions',
      cell: ({ row }) =>
        `${row.original.currency} ${row.original.deductions.toLocaleString()}`,
    },
    {
      accessorKey: 'net_salary',
      header: 'Net',
      cell: ({ row }) =>
        `${row.original.currency} ${row.original.net_salary.toLocaleString()}`,
    },
  ];

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {employee?.full_name}
            </h1>
            <p className="text-muted-foreground">
              {employee?.employee_number} • {employee?.position}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button onClick={() => router.push(`/${locale}/hr/employees/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Employee
          </Button>
        </div>
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <CardTitle>Employee Information</CardTitle>
                <CardDescription>Personal and employment details</CardDescription>
              </div>
            </div>
            <Badge variant={employee?.is_active ? 'default' : 'secondary'}>
              {employee?.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Employee Number</p>
              <p className="text-lg font-semibold">{employee?.employee_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Department</p>
              <p className="text-lg font-semibold">{employee?.department || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Position</p>
              <p className="text-lg font-semibold">{employee?.position || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Hire Date</p>
              <p className="text-lg font-semibold">
                {employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Salary</p>
              <p className="text-lg font-semibold">
                {employee?.salary ? `${employee.salary_currency} ${employee.salary.toLocaleString()}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-lg font-semibold">{employee?.email || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Attendance, Leave, and Payroll */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">
            <Calendar className="mr-2 h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave">
            <ClipboardList className="mr-2 h-4 w-4" />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="payroll">
            <DollarSign className="mr-2 h-4 w-4" />
            Payroll History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>
                View employee attendance history and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={attendanceColumns}
                data={attendanceData?.data || []}
                isLoading={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>
                Manage employee leave applications and approvals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={leaveColumns}
                data={leaveData?.data || []}
                isLoading={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll History</CardTitle>
              <CardDescription>
                View employee salary payments and deductions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={payrollColumns}
                data={payrollData?.data || []}
                isLoading={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
