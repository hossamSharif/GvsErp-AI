'use client';

/**
 * Sale Detail Page
 *
 * View and manage a single sales invoice.
 */

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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
import { useToast } from '@/hooks/use-toast';
import { useInvoice, useFinalizeInvoice, useDeleteInvoice, invoiceKeys } from '@/hooks/use-invoices';
import { usePrintInvoice } from '@/hooks/use-print-invoice';
import { ReturnInvoiceDialog } from '@/components/dialogs/return-invoice-dialog';
import { RecordPaymentDialog } from '@/components/dialogs/record-payment-dialog';
import { EntityAuditTrail } from '@/components/audit/entity-audit-trail';
import { InvoicePdf } from '@/components/reports/invoice-pdf';
import type { InvoiceStatus, InvoiceWithRelations } from '@erp/shared';

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
  const t = useTranslations('sales.detail');
  const tStatus = useTranslations('sales.status');
  const tActions = useTranslations('sales.actions');
  const tPrompt = useTranslations('sales.form');
  const queryClient = useQueryClient();

  const invoiceId = params.id as string;
  const locale = params.locale as string;
  const showReturn = searchParams.get('return') === 'true';

  // Fetch invoice
  const { data, isLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  // Mutations
  const finalizeInvoice = useFinalizeInvoice();
  const deleteInvoice = useDeleteInvoice();

  // Print ref
  const { printRef, handlePrint } = usePrintInvoice(invoice);

  // Dialog state
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(showReturn);

  // Post-finalize payment workflow (same as the invoice form): after finalizing
  // a draft from the detail page, offer to record a payment against it.
  const [savedInvoice, setSavedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Handle finalize
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
        setShowPaymentPrompt(true);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toasts.finalizeFailed'),
        description: error instanceof Error ? error.message : t('toasts.finalizeFailed'),
      });
    }
  }, [invoiceId, finalizeInvoice, toast, t]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      await deleteInvoice.mutateAsync(invoiceId);
      setShowDeleteDialog(false);
      toast({
        title: t('toasts.deleted'),
        description: t('toasts.deletedDescription'),
      });
      router.push(`/${locale}/sales`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toasts.deleteFailed');
      const lower = message.toLowerCase();
      const title =
        lower.includes('payment') ? t('toasts.blockedByPayments')
        : lower.includes('return') ? t('toasts.blockedByReturn')
        : t('toasts.deleteFailed');
      toast({
        variant: 'destructive',
        title,
        description: message,
      });
    }
  }, [invoiceId, deleteInvoice, toast, t, router, locale]);

  // Handle return success
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
          <Link href={`/${locale}/sales`}>{tActions('backToSales')}</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_ICONS[invoice.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label={tActions('back')}>
            <Link href={`/${locale}/sales`}>
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
              {t('createdOn', { date: new Date(invoice.createdAt).toLocaleDateString() })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {(invoice.status === 'draft' || invoice.status === 'final') && (
            <Button variant="outline" asChild>
              <Link href={`/${locale}/sales/${invoiceId}/edit`}>
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

      {/* Invoice Details */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionCustomer')}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.party ? (
              <div className="space-y-1">
                <Link
                  href={`/${locale}/customers/${invoice.partyId}`}
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
              </div>
            ) : (
              <p className="text-muted-foreground">{t('walkInCustomer')}</p>
            )}
          </CardContent>
        </Card>

        {/* Warehouse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionWarehouse')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{invoice.warehouse.name}</p>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('sectionSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.subtotal')}</span>
              <span>{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.tax')}</span>
              <span>{invoice.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('summary.discount')}</span>
              <span>-{invoice.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>{t('summary.total')}</span>
              <span>{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
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
                <TableHead className="w-12">{t('itemsTable.row')}</TableHead>
                <TableHead>{t('itemsTable.item')}</TableHead>
                <TableHead>{t('itemsTable.description')}</TableHead>
                <TableHead className="text-right">{t('itemsTable.qty')}</TableHead>
                <TableHead className="text-right">{t('itemsTable.unitPrice')}</TableHead>
                <TableHead className="text-right">{t('itemsTable.discountPercent')}</TableHead>
                <TableHead className="text-right">{t('itemsTable.taxPercent')}</TableHead>
                <TableHead className="text-right">{t('itemsTable.total')}</TableHead>
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
                    {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{item.discountPercent}%</TableCell>
                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">
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
            <CardTitle className="text-sm font-medium">{t('sectionNotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Hidden Printable Invoice */}
      <div className="hidden">
        <InvoicePdf ref={printRef} invoice={invoice} />
      </div>

      {/* Finalize Confirmation Dialog */}
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

      {/* Post-finalize: offer to record a payment now */}
      <Dialog open={showPaymentPrompt} onOpenChange={setShowPaymentPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tPrompt('paymentPrompt.title')}</DialogTitle>
            <DialogDescription>{tPrompt('paymentPrompt.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentPrompt(false)}>
              {tPrompt('paymentPrompt.later')}
            </Button>
            <Button
              onClick={() => {
                setShowPaymentPrompt(false);
                setShowPaymentModal(true);
              }}
            >
              {tPrompt('paymentPrompt.addNow')}
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

      {/* Delete Confirmation Dialog */}
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
              onClick={handleDelete}
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending ? t('deleteDialog.pending') : t('deleteDialog.confirm')}
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

      {/* Phase 8: invoice + its auto-posted journal entry audit trail */}
      <div className="mt-6 space-y-4">
        <EntityAuditTrail entityType="invoice" entityId={invoiceId} />
      </div>
    </div>
  );
}
