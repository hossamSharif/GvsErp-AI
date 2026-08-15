'use client';

/**
 * Settlements List Page
 *
 * Inventory settlements (stock adjustments) for the tenant, with status and
 * warehouse filters.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Search, MoreHorizontal, Loader2, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/components/ui/use-toast';

import { useSettlements, useDeleteSettlement } from '@/hooks/use-settlements';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useDirection } from '@/hooks/use-direction';
import type { SettlementStatus } from '@erp/shared';

const STATUS_VARIANT: Record<
  SettlementStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  draft: 'secondary',
  posted: 'default',
  canceled: 'outline',
};

export default function SettlementsPage() {
  const t = useTranslations('settlements');
  const router = useRouter();
  const params = useParams();
  const { isRtl } = useDirection();
  const { toast } = useToast();

  const locale = params.locale as string;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [warehouseId, setWarehouseId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: warehousesData } = useActiveWarehouses();
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading } = useSettlements({
    search: search || undefined,
    status: status === 'all' ? undefined : (status as SettlementStatus),
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    page,
    limit: 20,
  });

  const deleteSettlement = useDeleteSettlement();

  const settlements = data?.data ?? [];
  const meta = data?.meta;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSettlement.mutateAsync(deleteId);
      toast({ title: t('toasts.deleted') });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.deleteFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleteId(null);
    }
  };

  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/warehouses`)}
            aria-label={t('actions.back')}
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>

        <Button onClick={() => router.push(`/${locale}/warehouses/settlements/new`)}>
          <Plus className="me-2 h-4 w-4" />
          {t('actions.new')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('filters.searchPlaceholder')}
              className="ps-8"
            />
          </div>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
              <SelectItem value="draft">{t('status.draft')}</SelectItem>
              <SelectItem value="posted">{t('status.posted')}</SelectItem>
              <SelectItem value="canceled">{t('status.canceled')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={warehouseId}
            onValueChange={(value) => {
              setWarehouseId(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allWarehouses')}</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : settlements.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.number')}</TableHead>
                    <TableHead>{t('fields.date')}</TableHead>
                    <TableHead>{t('fields.warehouse')}</TableHead>
                    <TableHead>{t('fields.reason')}</TableHead>
                    <TableHead className="text-end">{t('fields.lines')}</TableHead>
                    <TableHead className="text-end">{t('fields.netValue')}</TableHead>
                    <TableHead>{t('fields.status')}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((settlement) => {
                    const net =
                      settlement.totalIncreaseValue - settlement.totalDecreaseValue;

                    return (
                      <TableRow
                        key={settlement.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/${locale}/warehouses/settlements/${settlement.id}`
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          {settlement.settlementNumber}
                        </TableCell>
                        <TableCell>{settlement.settlementDate}</TableCell>
                        <TableCell>{settlement.warehouseName}</TableCell>
                        <TableCell>{t(`reasons.${settlement.reason}`)}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {settlement.itemCount}
                        </TableCell>
                        <TableCell
                          className={`text-end tabular-nums ${
                            settlement.status !== 'posted'
                              ? 'text-muted-foreground'
                              : net > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : net < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : ''
                          }`}
                        >
                          {settlement.status === 'posted' ? formatMoney(net) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[settlement.status]}>
                            {t(`status.${settlement.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/${locale}/warehouses/settlements/${settlement.id}`
                                  )
                                }
                              >
                                {t('actions.view')}
                              </DropdownMenuItem>
                              {settlement.status === 'draft' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteId(settlement.id)}
                                >
                                  {t('actions.delete')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('pagination.showing', {
                  from: (meta.page - 1) * meta.limit + 1,
                  to: Math.min(meta.page * meta.limit, meta.total),
                  total: meta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
