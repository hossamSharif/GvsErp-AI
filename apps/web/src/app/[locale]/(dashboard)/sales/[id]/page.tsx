'use client';

/**
 * Sale Detail Page
 *
 * View and manage a single sales invoice.
 */

import React, { useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Edit,
  Send,
  Undo2,
  Printer,
  Download,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useInvoice, useFinalizeInvoice, useCancelInvoice } from '@/hooks/use-invoices';
import { ReturnInvoiceDialog } from '@/components/dialogs/return-invoice-dialog';
import type { InvoiceStatus } from '@erp-saas/shared';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_ICONS: Record<InvoiceStatus, { icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { icon: Clock, variant: 'secondary' },
  final: { icon: CheckCircle, variant: 'default' },
  returned: { icon: RotateCcw, variant: 'outline' },
  canceled: { icon: XCircle, variant: 'destructive' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations('invoices');

  const invoiceId = params.id as string;
  const locale = params.locale as string;
  const showReturn = searchParams.get('return') === 'true';

  // Fetch invoice
  const { data, isLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  // Mutations
  const finalizeInvoice = useFinalizeInvoice();
  const cancelInvoice = useCancelInvoice();

  // Dialog state
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(showReturn);

  // Handle finalize
  const handleFinalize = useCallback(async () => {
    try {
      await finalizeInvoice.mutateAsync({ id: invoiceId });
      setShowFinalizeDialog(false);
      toast({
        title: t('messages.invoiceFinalized'),
        description: t('messages.invoiceFinalizedDesc'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('messages.error'),
        description: error instanceof Error ? error.message : t('messages.failedToFinalize'),
      });
    }
  }, [invoiceId, finalizeInvoice, toast, t]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    try {
      await cancelInvoice.mutateAsync(invoiceId);
      setShowCancelDialog(false);
      toast({
        title: t('messages.invoiceCanceled'),
        description: t('messages.invoiceCanceledDesc'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('messages.error'),
        description: error instanceof Error ? error.message : t('messages.failedToCancel'),
      });
    }
  }, [invoiceId, cancelInvoice, toast, t]);

  // Handle return success
  const handleReturnSuccess = useCallback(() => {
    setShowReturnDialog(false);
    toast({
      title: t('messages.returnCreated'),
      description: t('messages.returnCreatedDesc'),
    });
  }, [toast, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('messages.loading')}</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{t('messages.notFound')}</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/sales`}>{t('actions.backToSales')}</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_ICONS[invoice.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/sales`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {t(`status.${invoice.status}`)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {t('fields.createdAt')} {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === 'draft' && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/sales/${invoiceId}/edit`}>
                  <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t('actions.edit')}
                </Link>
              </Button>
              <Button onClick={() => setShowFinalizeDialog(true)}>
                <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t('actions.finalize')}
              </Button>
            </>
          )}
          {invoice.status === 'final' && (
            <Button variant="outline" onClick={() => setShowReturnDialog(true)}>
              <Undo2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t('createReturn')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('actions.actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t('actions.print')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t('actions.exportPdf')}
              </DropdownMenuItem>
              {invoice.status === 'draft' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <XCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t('actions.cancelInvoice')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('fields.customer')}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.party ? (
              <div className="space-y-1">
                <p className="font-medium">{invoice.party.name}</p>
                {invoice.party.email && (
                  <p className="text-sm text-muted-foreground">{invoice.party.email}</p>
                )}
                {invoice.party.phone && (
                  <p className="text-sm text-muted-foreground">{invoice.party.phone}</p>
                )}
                {invoice.party.address && (
                  <p className="text-sm text-muted-foreground">{invoice.party.address}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{t('messages.walkInCustomer')}</p>
            )}
          </CardContent>
        </Card>

        {/* Warehouse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('fields.warehouse')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{invoice.warehouse.name}</p>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('fields.summary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('fields.subtotal')}:</span>
              <span>{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('fields.taxAmount')}:</span>
              <span>{invoice.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('fields.discountAmount')}:</span>
              <span>-{invoice.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>{t('fields.total')}:</span>
              <span>{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('items.title')}</CardTitle>
          <CardDescription>
            {t('items.itemsCount', { count: invoice.items.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('items.item')}</TableHead>
                <TableHead>{t('items.description')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('items.qty')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('items.unitPrice')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('items.discPercent')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('items.taxPercent')}</TableHead>
                <TableHead className="text-right rtl:text-left">{t('items.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.item.name}</p>
                      {item.item.sku && (
                        <p className="text-xs text-muted-foreground">{item.item.sku}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.description || '-'}
                  </TableCell>
                  <TableCell className="text-right rtl:text-left">{item.quantity}</TableCell>
                  <TableCell className="text-right rtl:text-left">
                    {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right rtl:text-left">{item.discountPercent}%</TableCell>
                  <TableCell className="text-right rtl:text-left">{item.taxRate}%</TableCell>
                  <TableCell className="text-right rtl:text-left font-medium">
                    {item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('fields.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Finalize Confirmation Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('messages.finalizeTitle')}</DialogTitle>
            <DialogDescription>
              {t('messages.finalizeDescription')}
              <ul className="list-disc ltr:list-inside rtl:list-inside mt-2 space-y-1">
                <li>{t('messages.finalizeUpdateStock')}</li>
                <li>{t('messages.finalizeUpdateBalance')}</li>
                <li>{t('messages.finalizeLockInvoice')}</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleFinalize} disabled={finalizeInvoice.isPending}>
              {finalizeInvoice.isPending ? t('messages.finalizing') : t('actions.finalize')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('messages.cancelTitle')}</DialogTitle>
            <DialogDescription>
              {t('messages.cancelDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              {t('actions.keepInvoice')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending ? t('messages.canceling') : t('actions.cancelInvoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Invoice Dialog */}
      {showReturnDialog && invoice && (
        <ReturnInvoiceDialog
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
          invoice={invoice}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
}
