'use client';

/**
 * Purchase Detail Page
 *
 * View and manage a single purchase invoice.
 */

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Edit,
  Send,
  Undo2,
  Printer,
  FileText,
  Download,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Package,
  Trash2,
} from 'lucide-react';
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
import { LinkedPaymentsDialog } from '@/components/dialogs/linked-payments-dialog';
import { useToast } from '@/hooks/use-toast';
import { useInvoice, useFinalizeInvoice, useDeleteInvoice, invoiceKeys } from '@/hooks/use-invoices';
import { usePrintInvoice } from '@/hooks/use-print-invoice';
import { ReturnInvoiceDialog } from '@/components/dialogs/return-invoice-dialog';
import { RecordPaymentDialog } from '@/components/dialogs/record-payment-dialog';
import { EntityAuditTrail } from '@/components/audit/entity-audit-trail';
import { InvoicePdf } from '@/components/reports/invoice-pdf';
import { formatAmount, formatShortDate } from '@/components/reports/invoice-format';
import { ApiClientError } from '@/lib/api-client';
import type {
  InvoiceStatus,
  InvoiceWithRelations,
  LinkedPaymentsMeta,
} from '@erp/shared';


const STATUS_ICONS: Record<InvoiceStatus, { icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { icon: Clock, variant: 'secondary' },
  final: { icon: CheckCircle, variant: 'default' },
  returned: { icon: RotateCcw, variant: 'outline' },
  canceled: { icon: XCircle, variant: 'destructive' },
};

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations('purchases.detail');
  const tActions = useTranslations('purchases.actions');
  const tStatus = useTranslations('sales.status');
  const tCommon = useTranslations('common');
  const tCols = useTranslations('sales.detail.itemsTable');
  const queryClient = useQueryClient();

  const invoiceId = params.id as string;
  const locale = params.locale as string;
  const showReturn = searchParams.get('return') === 'true';

  const { data, isLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  const finalizeInvoice = useFinalizeInvoice();
  const deleteInvoice = useDeleteInvoice();

  const { printRef, handlePrint, activeTemplate, snapshot } = usePrintInvoice(invoice);
  const tPrint = useTranslations('invoice.printMenu');

  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(showReturn);
  // Second-step confirmation: linked payments to also delete (cascade).
  const [paymentsPrompt, setPaymentsPrompt] = useState<LinkedPaymentsMeta | null>(null);

  // Post-finalize payment workflow (same as the invoice form): after finalizing
  // a draft from the detail page, offer to record a payment against it.
  const [savedInvoice, setSavedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleFinalize = useCallback(async () => {
    try {
      const result = await finalizeInvoice.mutateAsync({ id: invoiceId });
      setShowFinalizeDialog(false);
      toast({
        title: t('toasts.finalized'),
        description: t('toasts.finalizedDescription'),
      });
      // Offer to record a payment for party invoices; walk-ins just finalize.
      if (result.data.partyId) {
        setSavedInvoice(result.data);
        setShowPaymentModal(true);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: err instanceof Error ? err.message : t('toasts.finalizeFailed'),
      });
    }
  }, [invoiceId, finalizeInvoice, toast, t, tCommon]);

  // Handle delete. Pass `deletePayments` to also remove payments linked solely
  // to this invoice (second-step confirmation).
  const handleDelete = useCallback(async (deletePayments = false) => {
    try {
      await deleteInvoice.mutateAsync(
        deletePayments ? { id: invoiceId, deletePayments: true } : invoiceId
      );
      setShowDeleteDialog(false);
      setPaymentsPrompt(null);
      toast({
        title: t('toasts.deleted'),
        description: t('toasts.deletedDescription'),
      });
      router.push(`/${locale}/purchases`);
    } catch (err) {
      // Linked-payment block: offer a cascade delete unless a payment is shared
      // across other invoices (which we won't auto-delete).
      if (
        err instanceof ApiClientError &&
        err.code === 'INVOICE_HAS_PAYMENTS' &&
        err.meta
      ) {
        const meta = err.meta as unknown as LinkedPaymentsMeta;
        setShowDeleteDialog(false);
        if (meta.hasSharedPayments) {
          setPaymentsPrompt(null);
          toast({
            variant: 'destructive',
            title: t('toasts.blockedBySharedPayment'),
            description: err.message,
          });
          return;
        }
        setPaymentsPrompt(meta);
        return;
      }

      const message = err instanceof Error ? err.message : t('toasts.deleteFailed');
      const lower = message.toLowerCase();
      const isShared =
        err instanceof ApiClientError && err.code === 'INVOICE_HAS_SHARED_PAYMENTS';
      const title =
        isShared ? t('toasts.blockedBySharedPayment')
        : lower.includes('payment') ? t('toasts.blockedByPayments')
        : lower.includes('return') ? t('toasts.blockedByReturn')
        : t('toasts.deleteFailed');
      toast({
        variant: 'destructive',
        title,
        description: message,
      });
    }
  }, [invoiceId, deleteInvoice, toast, t, router, locale]);

  const handleReturnSuccess = useCallback(() => {
    setShowReturnDialog(false);
    toast({
      title: t('toasts.returnCreated'),
      description: t('toasts.returnCreatedDescription'),
    });
  }, [toast, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{t('notFound')}</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/purchases`}>{tActions('backToPurchases')}</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_ICONS[invoice.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label={tActions('back')}>
            <Link href={`/${locale}/purchases`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {tStatus(invoice.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {t('createdOn', { date: formatShortDate(invoice.createdAt) })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {(invoice.status === 'draft' || invoice.status === 'final') && (
            <Button variant="outline" asChild>
              <Link href={`/${locale}/purchases/${invoiceId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                {tActions('edit')}
              </Link>
            </Button>
          )}
          {invoice.status === 'draft' && (
            <Button onClick={() => setShowFinalizeDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              {tActions('finalize')}
            </Button>
          )}
          {invoice.status === 'final' && (
            <Button variant="outline" onClick={() => setShowReturnDialog(true)}>
              <Undo2 className="h-4 w-4 mr-2" />
              {tActions('createReturn')}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={tActions('label')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tActions('label')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrint()}>
                <Printer className="h-4 w-4 mr-2" />
                {tActions('print')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint()}>
                <Download className="h-4 w-4 mr-2" />
                {tActions('exportPdf')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrint('standard')}>
                <Printer className="h-4 w-4 mr-2" />
                {tPrint('printStandard')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('statement')}>
                <FileText className="h-4 w-4 mr-2" />
                {tPrint('printStatement')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tActions('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionSupplier')}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.party ? (
              <div className="space-y-1">
                <Link
                  href={`/${locale}/suppliers/${invoice.partyId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {invoice.party.name}
                </Link>
                {invoice.party.email && (
                  <p className="text-sm text-muted-foreground">{invoice.party.email}</p>
                )}
                {invoice.party.phone && (
                  <p className="text-sm text-muted-foreground">{invoice.party.phone}</p>
                )}
                {invoice.party.address && (
                  <p className="text-sm text-muted-foreground">{invoice.party.address}</p>
                )}
                <div className="pt-2">
                  <Badge variant={invoice.party.balance > 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {t('summary.total').replace(':', '')}: {formatAmount(invoice.party.balance)}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{t('noSupplier')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionWarehouse')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{invoice.warehouse.name}</p>
            </div>
            {invoice.status === 'final' && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('sectionWarehouseNote')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.subtotal')}</span>
              <span>{formatAmount(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.tax')}</span>
              <span>{formatAmount(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.discount')}</span>
              <span>-{formatAmount(invoice.discountAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>{t('summary.total')}</span>
              <span>{formatAmount(invoice.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sectionItems')}</CardTitle>
          <CardDescription>
            {t('sectionItemsCount', { count: invoice.items.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{tCols('row')}</TableHead>
                <TableHead>{tCols('item')}</TableHead>
                <TableHead>{tCols('description')}</TableHead>
                <TableHead className="text-right">{tCols('qty')}</TableHead>
                <TableHead className="text-right">{tCols('unitPrice')}</TableHead>
                <TableHead className="text-right">{tCols('discountPercent')}</TableHead>
                <TableHead className="text-right">{tCols('taxPercent')}</TableHead>
                <TableHead className="text-right">{tCols('total')}</TableHead>
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
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">{item.discountPercent}%</TableCell>
                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(item.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionNotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="hidden">
        <InvoicePdf
          ref={printRef}
          invoice={invoice}
          template={activeTemplate}
          snapshot={snapshot}
        />
      </div>

      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('finalizeDialog.title')}</DialogTitle>
            <DialogDescription asChild>
              <div>
                {t('finalizeDialog.intro')}
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>{t('finalizeDialog.bullet1')}</li>
                  <li>{t('finalizeDialog.bullet2')}</li>
                  <li>{t('finalizeDialog.bullet3')}</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              {t('finalizeDialog.cancel')}
            </Button>
            <Button onClick={handleFinalize} disabled={finalizeInvoice.isPending}>
              {finalizeInvoice.isPending ? t('finalizeDialog.pending') : t('finalizeDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {savedInvoice && (
        <RecordPaymentDialog
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          invoice={savedInvoice}
          onDone={() => {
            setShowPaymentModal(false);
            queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
          }}
        />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {invoice.status === 'final'
                ? t('deleteDialog.bodyFinal')
                : invoice.status === 'returned'
                ? t('deleteDialog.bodyReturned')
                : invoice.status === 'canceled'
                ? t('deleteDialog.bodyCanceled')
                : t('deleteDialog.bodyDraft')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete()}
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending ? t('deleteDialog.pending') : t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade-delete confirmation: also delete the linked payment(s) */}
      <LinkedPaymentsDialog
        open={paymentsPrompt !== null}
        onOpenChange={(open) => !open && setPaymentsPrompt(null)}
        mode="delete"
        meta={paymentsPrompt}
        locale={locale as string}
        isPending={deleteInvoice.isPending}
        onConfirm={() => handleDelete(true)}
      />

      {showReturnDialog && invoice && (
        <ReturnInvoiceDialog
          open={showReturnDialog}
          onOpenChange={setShowReturnDialog}
          invoice={invoice}
          onSuccess={handleReturnSuccess}
        />
      )}

      {/* Phase 8: invoice + its auto-posted journal entry audit trail */}
      <div className="mt-6 space-y-4">
        <EntityAuditTrail entityType="invoice" entityId={invoiceId} />
      </div>
    </div>
  );
}
