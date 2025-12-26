'use client';

/**
 * Employees List Page
 *
 * Displays all employees with filtering, search, and management actions.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('active');

  const { data, isLoading } = useEmployees();
  const { data: departments } = useDepartments();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee_number',
      header: t('employees.fields.employeeNumber'),
      cell: ({ row }) => (
        <Link
          href={`/${locale}/hr/employees/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.employee_number}
        </Link>
      ),
    },
    {
      accessorKey: 'full_name',
      header: t('employees.fields.fullName'),
    },
    {
      accessorKey: 'department',
      header: t('employees.fields.department'),
      cell: ({ row }) => row.original.department || '-',
    },
    {
      accessorKey: 'position',
      header: t('employees.fields.position'),
      cell: ({ row }) => row.original.position || '-',
    },
    {
      accessorKey: 'hire_date',
      header: t('employees.fields.hireDate'),
      cell: ({ row }) => {
        if (!row.original.hire_date) return '-';
        return new Date(row.original.hire_date).toLocaleDateString(locale);
      },
    },
    {
      accessorKey: 'salary',
      header: t('employees.fields.salary'),
      cell: ({ row }) => {
        if (!row.original.salary) return '-';
        return `${row.original.salary_currency} ${row.original.salary.toLocaleString(locale)}`;
      },
    },
    {
      accessorKey: 'is_active',
      header: tc('status'),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? tc('active') : tc('inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('employees.title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="me-2 h-4 w-4" />
            {tc('import')}
          </Button>
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {tc('export')}
          </Button>
          <Link href={`/${locale}/hr/employees/new`}>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t('employees.addEmployee')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('employees.stats.totalEmployees')}</CardDescription>
            <CardTitle className="text-3xl">{data?.meta?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('employees.stats.active')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((e) => e.is_active).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('employees.stats.departments')}</CardDescription>
            <CardTitle className="text-3xl">{departments?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('employees.stats.newThisMonth')}</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{tc('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tc('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-8"
                />
              </div>
            </div>

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={tc('allDepartments')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc('allDepartments')}</SelectItem>
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
                <SelectItem value="all">{tc('allStatus')}</SelectItem>
                <SelectItem value="active">{tc('active')}</SelectItem>
                <SelectItem value="inactive">{tc('inactive')}</SelectItem>
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
