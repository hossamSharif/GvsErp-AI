'use client';

/**
 * Transfers List Page
 *
 * Displays a list of stock transfers with filters and actions.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Plus,
  TruckIcon,
  Search,
  MoreHorizontal,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  useTransfers,
  useStartTransfer,
  useCompleteTransfer,
  useQuickCompleteTransfer,
  useCancelTransfer,
} from '@/hooks/use-warehouses';
import type { TransferWithDetails, TransferQueryParams, TransferStatus } from '@erp/shared';

const statusConfig: Record<
  TransferStatus,
  { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    variant: 'secondary',
  },
  in_transit: {
    label: 'In Transit',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: 'default',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle className="h-3 w-3" />,
    variant: 'outline',
  },
  canceled: {
    label: 'Canceled',
    icon: <XCircle className="h-3 w-3" />,
    variant: 'destructive',
  },
};

export default function TransfersPage() {
  const t = useTranslations('transfers');
  const router = useRouter();
  const { locale } = useParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'all'>('all');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'start' | 'complete' | 'quickComplete' | 'cancel' } | null>(null);
  const [queryParams, setQueryParams] = useState<TransferQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const { data: transfersData, isLoading, error } = useTransfers({
    ...queryParams,
    search: searchQuery || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const startMutation = useStartTransfer();
  const completeMutation = useCompleteTransfer();
  const quickCompleteMutation = useQuickCompleteTransfer();
  const cancelMutation = useCancelTransfer();

  const transfers = transfersData?.data || [];
  const meta = transfersData?.meta;

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setQueryParams((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value as TransferStatus | 'all');
    setQueryParams((prev) => ({ ...prev, page: 1 }));
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction.action) {
        case 'start': await startMutation.mutateAsync(confirmAction.id); break;
        case 'complete': await completeMutation.mutateAsync(confirmAction.id); break;
        case 'quickComplete': await quickCompleteMutation.mutateAsync(confirmAction.id); break;
        case 'cancel': await cancelMutation.mutateAsync(confirmAction.id); break;
      }
    } finally {
      setConfirmAction(null);
    }
  };

  const confirmMessages: Record<string, string> = {
    start: t('confirmStart'),
    complete: t('confirmComplete'),
    quickComplete: t('confirmQuickComplete'),
    cancel: t('confirmCancel'),
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 3,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => router.push(`/${locale}/warehouses/transfers/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newTransfer')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transfers.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                of {meta?.total || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transfers.filter((t) => t.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">on this page</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('inTransit')}</CardTitle>
            <TruckIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {transfers.filter((t) => t.status === 'in_transit').length}
            </div>
            <p className="text-xs text-muted-foreground">on this page</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('completed')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {transfers.filter((t) => t.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">on this page</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={t('searchPlaceholder')}
            aria-label="Search transfers"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="in_transit">{t('inTransit')}</SelectItem>
            <SelectItem value="completed">{t('completed')}</SelectItem>
            <SelectItem value="canceled">{t('canceled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('transfersList')}</CardTitle>
          <CardDescription>{t('transfersListDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">{t('errorLoading')}</div>
          ) : transfers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery || statusFilter !== 'all'
                ? t('noResultsFound')
                : t('noTransfers')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('transferNumber')}</TableHead>
                  <TableHead>{t('route')}</TableHead>
                  <TableHead className="text-center">{t('items')}</TableHead>
                  <TableHead className="text-center">{t('status')}</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer: TransferWithDetails) => {
                  const config = statusConfig[transfer.status];
                  return (
                    <TableRow
                      key={transfer.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/${locale}/warehouses/transfers/${transfer.id}`)
                      }
                    >
                      <TableCell className="font-medium font-mono">
                        {transfer.transferNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px]">
                            {transfer.fromWarehouse.name}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {transfer.toWarehouse.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {transfer.totalItems} ({formatNumber(transfer.totalQuantity)})
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={config.variant} className="gap-1">
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(transfer.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/${locale}/warehouses/transfers/${transfer.id}`
                                );
                              }}
                            >
                              {t('viewDetails')}
                            </DropdownMenuItem>

                            {transfer.status === 'pending' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ id: transfer.id, action: 'start' });
                                  }}
                                >
                                  {t('startTransfer')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ id: transfer.id, action: 'quickComplete' });
                                  }}
                                >
                                  {t('quickComplete')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ id: transfer.id, action: 'cancel' });
                                  }}
                                  className="text-red-600"
                                >
                                  {t('cancelTransfer')}
                                </DropdownMenuItem>
                              </>
                            )}

                            {transfer.status === 'in_transit' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ id: transfer.id, action: 'complete' });
                                  }}
                                >
                                  {t('completeTransfer')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ id: transfer.id, action: 'cancel' });
                                  }}
                                  className="text-red-600"
                                >
                                  {t('cancelTransfer')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t('showing', {
                  from: (meta.page - 1) * meta.limit + 1,
                  to: Math.min(meta.page * meta.limit, meta.total),
                  total: meta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() =>
                    setQueryParams((prev) => ({ ...prev, page: prev.page! - 1 }))
                  }
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.total_pages}
                  onClick={() =>
                    setQueryParams((prev) => ({ ...prev, page: prev.page! + 1 }))
                  }
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Action Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmAction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmMessages[confirmAction.action] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
