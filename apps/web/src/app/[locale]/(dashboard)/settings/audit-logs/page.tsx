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
} from '@erp/shared';
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
      title: 'Filters applied',
      description: 'Audit logs have been filtered.',
    });
  }, [toast]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setQueryParams({ page: 1, limit: 50 });
    setFiltersPanelOpen(false);
    toast({
      title: 'Filters cleared',
      description: 'All filters have been removed.',
    });
  }, [toast]);

  const handleViewDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  }, []);

  // Table columns
  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Timestamp',
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
        header: 'User',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.userName || 'System'}
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
        header: 'Action',
        cell: ({ row }) => (
          <Badge className={actionColors[row.original.action]}>
            {row.original.action.toUpperCase()}
          </Badge>
        ),
      },
      {
        accessorKey: 'entityType',
        header: 'Entity Type',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.entityType}
          </span>
        ),
      },
      {
        accessorKey: 'entityId',
        header: 'Entity ID',
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
        header: 'IP Address',
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
                View Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleViewDetails]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            View and filter system audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setFiltersPanelOpen(true)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" disabled title="Audit log export is not yet available">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.userId || filters.entityType || filters.action || filters.dateFrom || filters.dateTo) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Filters</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {filters.action && (
              <Badge variant="secondary">
                Action: {filters.action}
              </Badge>
            )}
            {filters.entityType && (
              <Badge variant="secondary">
                Entity: {filters.entityType}
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="secondary">
                From: {format(new Date(filters.dateFrom), 'MMM dd, yyyy')}
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="secondary">
                To: {format(new Date(filters.dateTo), 'MMM dd, yyyy')}
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
            emptyMessage="No audit logs found"
          />
        </CardContent>
      </Card>

      {/* Filters Dialog */}
      <Dialog open={filtersPanelOpen} onOpenChange={setFiltersPanelOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Filter Audit Logs</DialogTitle>
            <DialogDescription>
              Apply filters to narrow down the audit logs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Action Filter */}
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
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
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="finalize">Finalize</SelectItem>
                  <SelectItem value="cancel">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity Type</Label>
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
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All entities</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">From Date</Label>
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
                <Label htmlFor="dateTo">To Date</Label>
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
              Cancel
            </Button>
            <Button onClick={handleApplyFilters}>Apply Filters</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Full details of the audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Timestamp
                  </Label>
                  <p className="font-medium">
                    {format(
                      new Date(selectedLog.createdAt),
                      'MMM dd, yyyy HH:mm:ss'
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <p className="font-medium">
                    {selectedLog.userName || 'System'}
                  </p>
                  {selectedLog.userEmail && (
                    <p className="text-sm text-muted-foreground">
                      {selectedLog.userEmail}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Action
                  </Label>
                  <p>
                    <Badge className={actionColors[selectedLog.action]}>
                      {selectedLog.action.toUpperCase()}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Entity Type
                  </Label>
                  <p className="font-mono">{selectedLog.entityType}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Entity ID
                  </Label>
                  <p className="font-mono text-xs">
                    {selectedLog.entityId || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    IP Address
                  </Label>
                  <p className="font-mono">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
              </div>

              {/* Old Values */}
              {selectedLog.oldValues && (
                <div>
                  <Label className="text-sm font-semibold">Old Values</Label>
                  <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Values */}
              {selectedLog.newValues && (
                <div>
                  <Label className="text-sm font-semibold">New Values</Label>
                  <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    User Agent
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
