'use client';

/**
 * Employees List Page
 *
 * Displays all employees with filtering, search, and management actions.
 */

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Search, Download, Upload } from 'lucide-react';
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
import { useEmployees } from '@/hooks/use-employees';

export default function EmployeesPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr.employees');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('active');

  const { data, isLoading } = useEmployees({
    search: search || undefined,
    department: department === 'all' ? undefined : department,
    isActive: status === 'all' ? undefined : status === 'active',
    page: 1,
    limit: 50,
  });

  const departments = useMemo(() => {
    if (!data?.data) return [];
    const depts = new Set(data.data.map((e) => e.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [data?.data]);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee_number',
      header: t('columns.employeeNumber'),
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
      header: t('columns.name'),
    },
    {
      accessorKey: 'department',
      header: t('columns.department'),
      cell: ({ row }) => row.original.department || '-',
    },
    {
      accessorKey: 'position',
      header: t('columns.position'),
      cell: ({ row }) => row.original.position || '-',
    },
    {
      accessorKey: 'hire_date',
      header: t('columns.hireDate'),
      cell: ({ row }) => {
        if (!row.original.hire_date) return '-';
        return new Date(row.original.hire_date).toLocaleDateString(
          locale === 'ar' ? 'ar-EG' : 'en-US'
        );
      },
    },
    {
      accessorKey: 'salary',
      header: t('columns.salary'),
      cell: ({ row }) => {
        if (!row.original.salary) return '-';
        return `${row.original.salary_currency} ${row.original.salary.toLocaleString()}`;
      },
    },
    {
      accessorKey: 'is_active',
      header: t('columns.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? t('filters.active') : t('filters.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            {t('import')}
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
          <Button onClick={() => router.push(`/${locale}/hr/employees/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addEmployee')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.total')}</CardDescription>
            <CardTitle className="text-3xl">{data?.meta?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.showing')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.length || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {t('stats.of')} {data?.meta?.total || 0}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.departments')}</CardDescription>
            <CardTitle className="text-3xl">{departments?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('stats.activeOnPage')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((e) => e.is_active).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder={t('filters.searchPlaceholder')}
                  aria-label={t('filters.searchAria')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filters.allDepartments')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allDepartments')}</SelectItem>
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
                <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
                <SelectItem value="active">{t('filters.active')}</SelectItem>
                <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
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
