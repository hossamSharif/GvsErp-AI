'use client';

/**
 * Leave Management Page
 *
 * Displays and manages employee leave requests including approvals,
 * rejections, and tracking of leave balances.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Search, Filter, Download, Check, X, Calendar } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Mock data - replace with actual API hooks
const useLeaveRequests = () => {
  return {
    data: {
      data: [
        {
          id: '1',
          employee_id: 'emp-1',
          employee_name: 'John Doe',
          employee_number: 'EMP-0001',
          leave_type: 'vacation',
          start_date: '2024-12-20',
          end_date: '2024-12-27',
          days_count: 6,
          reason: 'Annual vacation',
          status: 'pending',
          created_at: '2024-12-01T00:00:00Z',
        },
        {
          id: '2',
          employee_id: 'emp-2',
          employee_name: 'Jane Smith',
          employee_number: 'EMP-0002',
          leave_type: 'sick',
          start_date: '2024-12-15',
          end_date: '2024-12-16',
          days_count: 2,
          reason: 'Medical appointment',
          status: 'approved',
          approved_by: 'manager-1',
          created_at: '2024-11-28T00:00:00Z',
        },
        {
          id: '3',
          employee_id: 'emp-3',
          employee_name: 'Bob Johnson',
          employee_number: 'EMP-0003',
          leave_type: 'personal',
          start_date: '2024-12-18',
          end_date: '2024-12-19',
          days_count: 2,
          reason: 'Personal matters',
          status: 'rejected',
          approved_by: 'manager-1',
          created_at: '2024-12-05T00:00:00Z',
        },
      ],
      meta: {
        total: 3,
        page: 1,
        limit: 50,
        total_pages: 1,
      },
    },
    isLoading: false,
  };
};

const useLeaveTypes = () => {
  return {
    data: ['vacation', 'sick', 'personal', 'maternity', 'paternity', 'unpaid'],
    isLoading: false,
  };
};

export default function LeaveManagementPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('hr');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [leaveType, setLeaveType] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');

  const { data, isLoading } = useLeaveRequests();
  const { data: leaveTypes } = useLeaveTypes();

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setActionType('approve');
    setActionNotes('');
    setActionDialogOpen(true);
  };

  const handleReject = (request: any) => {
    setSelectedRequest(request);
    setActionType('reject');
    setActionNotes('');
    setActionDialogOpen(true);
  };

  const handleActionSubmit = () => {
    // TODO: Implement actual API call to approve/reject
    console.log(`${actionType} request:`, selectedRequest?.id, actionNotes);
    setActionDialogOpen(false);
    setSelectedRequest(null);
    setActionNotes('');
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'employee_number',
      header: t('leave.fields.employee'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.employee_name}</div>
          <div className="text-sm text-muted-foreground">
            {row.original.employee_number}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'leave_type',
      header: t('leave.fields.leaveType'),
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {t(`leave.types.${row.original.leave_type}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'start_date',
      header: t('leave.fields.startDate'),
      cell: ({ row }) => new Date(row.original.start_date).toLocaleDateString(locale),
    },
    {
      accessorKey: 'end_date',
      header: t('leave.fields.endDate'),
      cell: ({ row }) => new Date(row.original.end_date).toLocaleDateString(locale),
    },
    {
      accessorKey: 'days_count',
      header: t('leave.fields.daysCount'),
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.days_count}</span>
      ),
    },
    {
      accessorKey: 'reason',
      header: t('leave.fields.reason'),
      cell: ({ row }) => (
        <span className="max-w-xs truncate block">
          {row.original.reason || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('leave.fields.status'),
      cell: ({ row }) => {
        const statusColors: Record<string, any> = {
          pending: 'secondary',
          approved: 'default',
          rejected: 'destructive',
        };
        return (
          <Badge variant={statusColors[row.original.status]}>
            {t(`leave.statuses.${row.original.status}`)}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: tc('actions'),
      cell: ({ row }) => {
        if (row.original.status !== 'pending') return null;
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleApprove(row.original)}
            >
              <Check className="h-3 w-3 me-1" />
              {t('leave.approveRequest')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReject(row.original)}
            >
              <X className="h-3 w-3 me-1" />
              {t('leave.rejectRequest')}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('leave.title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="me-2 h-4 w-4" />
            {tc('export')}
          </Button>
          <Button onClick={() => router.push(`/${locale}/hr/leave/new`)}>
            <Plus className="me-2 h-4 w-4" />
            {t('leave.newRequest')}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('leave.stats.pendingRequests')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((r) => r.status === 'pending').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('leave.stats.approvedThisMonth')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((r) => r.status === 'approved').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('leave.stats.rejectedThisMonth')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.filter((r) => r.status === 'rejected').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('leave.stats.totalDaysRequested')}</CardDescription>
            <CardTitle className="text-3xl">
              {data?.data?.reduce((sum, r) => sum + r.days_count, 0) || 0}
            </CardTitle>
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

            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('leave.fields.leaveType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('leave.fields.leaveType')}</SelectItem>
                {leaveTypes?.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="capitalize">{t(`leave.types.${type}`)}</span>
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
                <SelectItem value="pending">{t('leave.statuses.pending')}</SelectItem>
                <SelectItem value="approved">{t('leave.statuses.approved')}</SelectItem>
                <SelectItem value="rejected">{t('leave.statuses.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Approve/Reject Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? t('leave.dialogs.approve.title') : t('leave.dialogs.reject.title')}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? t('leave.dialogs.approve.description')
                : t('leave.dialogs.reject.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t('leave.fields.employee')}:</span>
                  <span className="text-sm">{selectedRequest.employee_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t('leave.fields.leaveType')}:</span>
                  <span className="text-sm capitalize">{t(`leave.types.${selectedRequest.leave_type}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t('leave.fields.startDate')} - {t('leave.fields.endDate')}:</span>
                  <span className="text-sm">
                    {new Date(selectedRequest.start_date).toLocaleDateString(locale)} -{' '}
                    {new Date(selectedRequest.end_date).toLocaleDateString(locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t('leave.fields.daysCount')}:</span>
                  <span className="text-sm">{selectedRequest.days_count}</span>
                </div>
                {selectedRequest.reason && (
                  <div>
                    <span className="text-sm font-medium">{t('leave.fields.reason')}:</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRequest.reason}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {actionType === 'approve' ? t('leave.dialogs.approve.notes') : t('leave.dialogs.reject.reason')}
              </Label>
              <Textarea
                id="notes"
                placeholder={tc('searchPlaceholder')}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleActionSubmit}
              disabled={actionType === 'reject' && !actionNotes.trim()}
            >
              {actionType === 'approve' ? t('leave.approveRequest') : t('leave.rejectRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
