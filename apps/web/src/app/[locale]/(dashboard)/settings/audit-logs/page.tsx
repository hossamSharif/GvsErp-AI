'use client';

/**
 * Audit Logs Viewer Page
 *
 * Display and filter audit logs with:
 * - Paginated data table
 * - Filters (user, action, entity type, date range)
 * - Old/new values comparison
 * - Export functionality
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { DataTable } from '@/components/tables/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type {
  AuditLog,
  AuditLogQueryParams,
  AuditAction,
  AuditEntityType,
} from '@erp-saas/shared';
import {
  MoreHorizontal,
  Eye,
  Download,
  Filter,
  Calendar,
  User,
  FileText,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';

// Action color mapping
const actionColors: Record<AuditAction, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  login: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  finalize: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  cancel: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  return: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  transfer: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  export: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  import: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
};

export default function AuditLogsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();
  const t = useTranslations('settings.auditLogs');
  const tc = useTranslations('common');

  // Query state
  const [queryParams, setQueryParams] = useState<AuditLogQueryParams>({
    page: 1,
    limit: 50,
  });

  // Filter state
  const [filters, setFilters] = useState<{
    userId?: string;
    entityType?: AuditEntityType;
    action?: AuditAction;
    dateFrom?: string;
    dateTo?: string;
  }>({});

  // UI state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);

  // Fetch audit logs
  const { data, isLoading, error } = useAuditLogs({ ...queryParams, ...filters });

  // Handlers
  const handlePageChange = useCallback((page: number, limit: number) => {
    setQueryParams((prev) => ({ ...prev, page, limit }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setQueryParams((prev) => ({ ...prev, page: 1 }));
    setFiltersPanelOpen(false);
    toast({
      title: t('messages.filtersApplied'),
      description: t('messages.filtersAppliedDescription'),
    });
  }, [toast, t]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setQueryParams({ page: 1, limit: 50 });
    setFiltersPanelOpen(false);
    toast({
      title: t('messages.filtersCleared'),
      description: t('messages.filtersClearedDescription'),
    });
  }, [toast, t]);

  const handleViewDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  }, []);

  const handleExport = useCallback(() => {
    toast({
      title: t('messages.exportStarted'),
      description: t('messages.exportStartedDescription'),
    });
    // TODO: Implement export functionality
  }, [toast, t]);

  // Table columns
  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('fields.timestamp'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {format(new Date(row.original.createdAt), 'MMM dd, yyyy')}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(row.original.createdAt), 'HH:mm:ss')}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'userName',
        header: t('fields.user'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.userName || t('detailsDialog.system')}
            </span>
            {row.original.userEmail && (
              <span className="text-xs text-muted-foreground">
                {row.original.userEmail}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: t('fields.action'),
        cell: ({ row }) => (
          <Badge className={actionColors[row.original.action]}>
            {row.original.action.toUpperCase()}
          </Badge>
        ),
      },
      {
        accessorKey: 'entityType',
        header: t('fields.entityType'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.entityType}
          </span>
        ),
      },
      {
        accessorKey: 'entityId',
        header: t('fields.entityId'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.entityId
              ? `${row.original.entityId.substring(0, 8)}...`
              : 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'ipAddress',
        header: t('fields.ipAddress'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.ipAddress || 'N/A'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewDetails(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('viewDetails')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleViewDetails, t]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('pageDescription')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setFiltersPanelOpen(true)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {t('filters')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.userId || filters.entityType || filters.action || filters.dateFrom || filters.dateTo) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t('activeFilters')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
              >
                {t('clearAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {filters.action && (
              <Badge variant="secondary">
                {t('filterDialog.action')}: {filters.action}
              </Badge>
            )}
            {filters.entityType && (
              <Badge variant="secondary">
                {t('filterDialog.entityType')}: {filters.entityType}
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="secondary">
                {t('filterDialog.fromDate')}: {format(new Date(filters.dateFrom), 'MMM dd, yyyy')}
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="secondary">
                {t('filterDialog.toDate')}: {format(new Date(filters.dateTo), 'MMM dd, yyyy')}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data?.data || []}
            pageCount={data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0}
            onPageChange={handlePageChange}
            isLoading={isLoading}
            emptyMessage={t('noLogsFound')}
          />
        </CardContent>
      </Card>

      {/* Filters Dialog */}
      <Dialog open={filtersPanelOpen} onOpenChange={setFiltersPanelOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('filterDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('filterDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Action Filter */}
            <div className="space-y-2">
              <Label htmlFor="action">{t('filterDialog.action')}</Label>
              <Select
                value={filters.action || ''}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    action: value as AuditAction,
                  }))
                }
              >
                <SelectTrigger id="action">
                  <SelectValue placeholder={t('filterDialog.allActions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('filterDialog.allActions')}</SelectItem>
                  <SelectItem value="create">{t('actions.create')}</SelectItem>
                  <SelectItem value="update">{t('actions.update')}</SelectItem>
                  <SelectItem value="delete">{t('actions.delete')}</SelectItem>
                  <SelectItem value="login">{t('actions.login')}</SelectItem>
                  <SelectItem value="logout">{t('actions.logout')}</SelectItem>
                  <SelectItem value="finalize">{t('actions.finalize')}</SelectItem>
                  <SelectItem value="cancel">{t('actions.cancel')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="entityType">{t('filterDialog.entityType')}</Label>
              <Select
                value={filters.entityType || ''}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    entityType: value as AuditEntityType,
                  }))
                }
              >
                <SelectTrigger id="entityType">
                  <SelectValue placeholder={t('filterDialog.allEntities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('filterDialog.allEntities')}</SelectItem>
                  <SelectItem value="item">{t('entities.item')}</SelectItem>
                  <SelectItem value="invoice">{t('entities.invoice')}</SelectItem>
                  <SelectItem value="party">{t('entities.party')}</SelectItem>
                  <SelectItem value="payment">{t('entities.payment')}</SelectItem>
                  <SelectItem value="warehouse">{t('entities.warehouse')}</SelectItem>
                  <SelectItem value="expense">{t('entities.expense')}</SelectItem>
                  <SelectItem value="user">{t('entities.user')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">{t('filterDialog.fromDate')}</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateFrom: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">{t('filterDialog.toDate')}</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateTo: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFiltersPanelOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleApplyFilters}>{t('filterDialog.applyFilters')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{t('detailsDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('detailsDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.timestamp')}
                  </Label>
                  <p className="font-medium">
                    {format(
                      new Date(selectedLog.createdAt),
                      'MMM dd, yyyy HH:mm:ss'
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('detailsDialog.user')}</Label>
                  <p className="font-medium">
                    {selectedLog.userName || t('system')}
                  </p>
                  {selectedLog.userEmail && (
                    <p className="text-sm text-muted-foreground">
                      {selectedLog.userEmail}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.action')}
                  </Label>
                  <p>
                    <Badge className={actionColors[selectedLog.action]}>
                      {selectedLog.action.toUpperCase()}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.entityType')}
                  </Label>
                  <p className="font-mono">{selectedLog.entityType}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.entityId')}
                  </Label>
                  <p className="font-mono text-xs">
                    {selectedLog.entityId || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.ipAddress')}
                  </Label>
                  <p className="font-mono">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
              </div>

              {/* Old Values */}
              {selectedLog.oldValues && (
                <div>
                  <Label className="text-sm font-semibold">{t('detailsDialog.oldValues')}</Label>
                  <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Values */}
              {selectedLog.newValues && (
                <div>
                  <Label className="text-sm font-semibold">{t('detailsDialog.newValues')}</Label>
                  <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {t('detailsDialog.userAgent')}
                  </Label>
                  <p className="text-xs font-mono">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
