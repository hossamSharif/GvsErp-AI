'use client';

/**
 * Settlement Detail Page
 *
 * Shows a settlement's lines (system vs counted vs difference vs value) and
 * exposes Post / Reverse depending on status.
 */

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';

import {
  useSettlement,
  usePostSettlement,
  useReverseSettlement,
} from '@/hooks/use-settlements';
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

export default function SettlementDetailPage() {
  const t = useTranslations('settlements');
  const router = useRouter();
  const params = useParams();
  const { isRtl } = useDirection();
  const { toast } = useToast();

  const locale = params.locale as string;
  const id = params.id as string;

  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmReverse, setConfirmReverse] = useState(false);

  const { data, isLoading } = useSettlement(id);
  const postSettlement = usePostSettlement();
  const reverseSettlement = useReverseSettlement();

  const settlement = data?.data;

  const formatQty = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handlePost = async () => {
    setConfirmPost(false);
    try {
      const result = await postSettlement.mutateAsync(id);
      toast({
        title: t('toasts.posted'),
        description: t('toasts.postedDetail', {
          count: result.data.linesApplied,
          value: formatMoney(result.data.netValueDelta),
        }),
      });
      if (result.data.accountingWarning) {
        toast({
          variant: 'destructive',
          title: t('toasts.accountingWarning'),
          description: result.data.accountingWarning,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.postFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleReverse = async () => {
    setConfirmReverse(false);
    try {
      const result = await reverseSettlement.mutateAsync(id);
      toast({
        title: t('toasts.reversed'),
        description: result.data.reversal.settlementNumber,
      });
      router.push(
        `/${locale}/warehouses/settlements/${result.data.reversal.id}`
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.reverseFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('notFound')}
      </p>
    );
  }

  const net = settlement.totalIncreaseValue - settlement.totalDecreaseValue;
  const isPosted = settlement.status === 'posted';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/warehouses/settlements`)}
            aria-label={t('actions.back')}
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {settlement.settlementNumber}
              </h1>
              <Badge variant={STATUS_VARIANT[settlement.status]}>
                {t(`status.${settlement.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {settlement.warehouseName} · {settlement.settlementDate} ·{' '}
              {t(`reasons.${settlement.reason}`)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {settlement.status === 'draft' && (
            <Button
              onClick={() => setConfirmPost(true)}
              disabled={postSettlement.isPending}
            >
              {postSettlement.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 h-4 w-4" />
              )}
              {t('actions.post')}
            </Button>
          )}
          {isPosted && !settlement.reversalOfId && (
            <Button
              variant="outline"
              onClick={() => setConfirmReverse(true)}
              disabled={reverseSettlement.isPending}
            >
              {reverseSettlement.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="me-2 h-4 w-4" />
              )}
              {t('actions.reverse')}
            </Button>
          )}
        </div>
      </div>

      {settlement.reversalOfId && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Undo2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          {t('detail.isReversal')}
        </div>
      )}

      {settlement.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('fields.notes')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {settlement.notes}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {isPosted && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('form.increaseValue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(settlement.totalIncreaseValue)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('form.decreaseValue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatMoney(settlement.totalDecreaseValue)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('form.netValue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">
              {formatMoney(net)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.linesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.item')}</TableHead>
                  <TableHead className="text-end">{t('fields.systemQty')}</TableHead>
                  <TableHead className="text-end">{t('fields.countedQty')}</TableHead>
                  <TableHead className="text-end">{t('fields.difference')}</TableHead>
                  <TableHead className="text-end">{t('fields.unitCost')}</TableHead>
                  <TableHead className="text-end">{t('fields.valueImpact')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlement.items.map((line) => {
                  // Drafts have no computed difference yet — derive it for display.
                  const difference =
                    line.differenceQuantity ?? line.countedQuantity - line.systemQuantity;

                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium">{line.itemName}</div>
                        {line.itemSku && (
                          <div className="text-xs text-muted-foreground">
                            {line.itemSku}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {formatQty(line.systemQuantity)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatQty(line.countedQuantity)}
                      </TableCell>
                      <TableCell
                        className={`text-end tabular-nums font-medium ${
                          difference > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : difference < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {difference > 0 ? '+' : ''}
                        {formatQty(difference)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMoney(line.unitCost)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {line.valueDelta === null ? '—' : formatMoney(line.valueDelta)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Post confirmation */}
      <AlertDialog open={confirmPost} onOpenChange={setConfirmPost}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('postDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('postDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost}>
              {t('actions.post')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse confirmation */}
      <AlertDialog open={confirmReverse} onOpenChange={setConfirmReverse}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('reverseDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('reverseDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverse}>
              {t('actions.reverse')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
