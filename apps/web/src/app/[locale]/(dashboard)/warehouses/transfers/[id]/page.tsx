'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Clock, Truck, CheckCircle2, XCircle, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  useTransfer,
  useStartTransfer,
  useCompleteTransfer,
  useQuickCompleteTransfer,
  useCancelTransfer,
} from '@/hooks/use-warehouses';
import type { TransferStatus } from '@erp/shared';

type ActionKind = 'start' | 'complete' | 'quickComplete' | 'cancel';

const statusVariant = (status: TransferStatus) => {
  switch (status) {
    case 'pending':
      return { variant: 'secondary' as const, icon: <Clock className="h-3 w-3" /> };
    case 'in_transit':
      return { variant: 'default' as const, icon: <Truck className="h-3 w-3" /> };
    case 'completed':
      return { variant: 'default' as const, icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'canceled':
      return { variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" /> };
    default:
      return { variant: 'outline' as const, icon: null };
  }
};

export default function TransferDetailPage() {
  const t = useTranslations('transfers');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const transferId = params.id as string;

  const { data, isLoading, error } = useTransfer(transferId);
  const startMutation = useStartTransfer();
  const completeMutation = useCompleteTransfer();
  const quickMutation = useQuickCompleteTransfer();
  const cancelMutation = useCancelTransfer();

  const [confirm, setConfirm] = useState<ActionKind | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8">
        <p className="text-destructive">{error?.message || t('transferNotFound')}</p>
        <Button onClick={() => router.push(`/${locale}/warehouses/transfers`)}>
          {t('backToList')}
        </Button>
      </div>
    );
  }

  const transfer = data.data;
  const config = statusVariant(transfer.status);
  const statusLabel: Record<TransferStatus, string> = {
    pending: t('pending'),
    in_transit: t('inTransit'),
    completed: t('completed'),
    canceled: t('canceled'),
  };

  const actionPrompts: Record<ActionKind, string> = {
    start: t('confirmStart'),
    complete: t('confirmComplete'),
    quickComplete: t('confirmQuickComplete'),
    cancel: t('confirmCancel'),
  };

  const runAction = async () => {
    if (!confirm) return;
    try {
      if (confirm === 'start') await startMutation.mutateAsync(transferId);
      else if (confirm === 'complete') await completeMutation.mutateAsync(transferId);
      else if (confirm === 'quickComplete') await quickMutation.mutateAsync(transferId);
      else if (confirm === 'cancel') await cancelMutation.mutateAsync(transferId);
    } finally {
      setConfirm(null);
    }
  };

  const isPending = transfer.status === 'pending';
  const isInTransit = transfer.status === 'in_transit';

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('backToList')}
          onClick={() => router.push(`/${locale}/warehouses/transfers`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {transfer.transferNumber}
          </h1>
          <p className="text-muted-foreground">
            {formatDistanceToNow(new Date(transfer.createdAt), { addSuffix: true })}
          </p>
        </div>
        <Badge variant={config.variant} className="gap-1">
          {config.icon}
          {statusLabel[transfer.status]}
        </Badge>
        {(isPending || isInTransit) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPending && (
                <>
                  <DropdownMenuItem onClick={() => setConfirm('start')}>
                    {t('startTransfer')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirm('quickComplete')}>
                    {t('quickComplete')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirm('cancel')}
                    className="text-red-600"
                  >
                    {t('cancelTransfer')}
                  </DropdownMenuItem>
                </>
              )}
              {isInTransit && (
                <>
                  <DropdownMenuItem onClick={() => setConfirm('complete')}>
                    {t('completeTransfer')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirm('cancel')}
                    className="text-red-600"
                  >
                    {t('cancelTransfer')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('summary')}</CardTitle>
          <CardDescription>{t('summaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('fromWarehouse')}</p>
              <p className="font-medium">{transfer.fromWarehouse.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('toWarehouse')}</p>
              <p className="font-medium">{transfer.toWarehouse.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mt-4">
            <span>{transfer.fromWarehouse.name}</span>
            <ArrowRight className="h-4 w-4" />
            <span>{transfer.toWarehouse.name}</span>
          </div>
          {transfer.notes && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">{t('notes')}</p>
              <p className="whitespace-pre-wrap">{transfer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transferItems')}</CardTitle>
          <CardDescription>
            {transfer.totalItems} · {t('totalQuantity')}: {transfer.totalQuantity}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('item')}</TableHead>
                <TableHead className="text-right">{t('quantity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.item.name}</TableCell>
                  <TableCell className="text-right">
                    {Number(it.quantity)} {it.item.unitOfMeasure}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmAction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? actionPrompts[confirm] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelButton')}</AlertDialogCancel>
            <AlertDialogAction onClick={runAction}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
