'use client';

/**
 * Employees List Page
 *
 * Displays all employees with filtering, search, and management actions.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/tables/data-table';
import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

// Mock data - replace with actual API hook
const useEmployees = () => {
  return {
    data: {
      data: [
        {
          id: '1',
          employee_number: 'EMP-0001',
          full_name: 'John Doe',
          department: 'IT',
          position: 'Software Engineer',
          hire_date: '2024-01-15',
          salary: 5000,
          salary_currency: 'USD',
          is_active: true,
        },
        {
          id: '2',
          employee_number: 'EMP-0002',
          full_name: 'Jane Smith',
          department: 'HR',
          position: 'HR Manager',
          hire_date: '2023-06-01',
          salary: 6000,
          salary_currency: 'USD',
          is_active: true,
        },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 50,
        total_pages: 1,
      },
    },
    isLoading: false,
  };
};

const useDepartments = () => {
  return {
    data: ['IT', 'HR', 'Sales', 'Finance'],
    isLoading: false,
  };
};

export default function EmployeesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('active');

  const { data, isLoading } = useEmployees();
  const { data: departments } = useDepartments();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee_number',
      header: 'Employee #',
      cell: ({ row }) => (
        <Link
          href={`/hr/employees/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.employee_number}
        </Link>
      ),
    },
    {
      accessorKey: 'full_name',
      header: 'Name',
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => row.original.department || '-',
    },
    {
      accessorKey: 'position',
      header: 'Position',
      cell: ({ row }) => row.original.position || '-',
    },
    {
      accessorKey: 'hire_date',
      header: 'Hire Date',
      cell: ({ row }) => {
        if (!row.original.hire_date) return '-';
        return new Date(row.original.hire_date).toLocaleDateString();
      },
    },
    {
      accessorKey: 'salary',
      header: 'Salary',
      cell: ({ row }) => {
        if (!row.original.salary) return '-';
        return `${row.original.salary_currency} ${row.original.salary.toLocaleString()}`;
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage your workforce and employee information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => router.push('/hr/employees/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Employees</CardDescription>
            <CardTitle className="text-3xl">{data?.meta?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((e) => e.is_active).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Departments</CardDescription>
            <CardTitle className="text-3xl">{departments?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New This Month</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Departments</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
