'use client';

/**
 * Sale Detail Page
 *
 * View and manage a single sales invoice.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { useInvoice, useFinalizeInvoice, useCancelInvoice } from '@/hooks/use-invoices';
import { ReturnInvoiceDialog } from '@/components/dialogs/return-invoice-dialog';
import { InvoicePdf } from '@/components/reports/invoice-pdf';
import type { InvoiceStatus } from '@erp/shared';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: Clock, variant: 'secondary' },
  final: { label: 'Finalized', icon: CheckCircle, variant: 'default' },
  returned: { label: 'Returned', icon: RotateCcw, variant: 'outline' },
  canceled: { label: 'Canceled', icon: XCircle, variant: 'destructive' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const invoiceId = params.id as string;
  const locale = params.locale as string;
  const showReturn = searchParams.get('return') === 'true';

  // Fetch invoice
  const { data, isLoading, error } = useInvoice(invoiceId);
  const invoice = data?.data;

  // Mutations
  const finalizeInvoice = useFinalizeInvoice();
  const cancelInvoice = useCancelInvoice();

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Sale-${invoiceId}`,
  });

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
        title: 'Invoice Finalized',
        description: 'The invoice has been finalized successfully',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to finalize invoice',
      });
    }
  }, [invoiceId, finalizeInvoice, toast]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    try {
      await cancelInvoice.mutateAsync(invoiceId);
      setShowCancelDialog(false);
      toast({
        title: 'Invoice Canceled',
        description: 'The invoice has been canceled',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel invoice',
      });
    }
  }, [invoiceId, cancelInvoice, toast]);

  // Handle return success
  const handleReturnSuccess = useCallback(() => {
    setShowReturnDialog(false);
    toast({
      title: 'Return Created',
      description: 'The return invoice has been created',
    });
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Invoice not found</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/sales`}>Back to Sales</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[invoice.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Go back to sales">
            <Link href={`/${locale}/sales`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {invoice.status === 'draft' && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/sales/${invoiceId}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button onClick={() => setShowFinalizeDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                Finalize
              </Button>
            </>
          )}
          {invoice.status === 'final' && (
            <Button variant="outline" onClick={() => setShowReturnDialog(true)}>
              <Undo2 className="h-4 w-4 mr-2" />
              Create Return
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Invoice actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePrint()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint()}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              {invoice.status === 'draft' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Invoice
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
            <CardTitle className="text-sm font-medium">Customer</CardTitle>
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
              <p className="text-muted-foreground">Walk-in customer</p>
            )}
          </CardContent>
        </Card>

        {/* Warehouse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{invoice.warehouse.name}</p>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span>{invoice.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <span>-{invoice.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Total:</span>
              <span>{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {invoice.items.length} item(s) in this invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Disc %</TableHead>
                <TableHead className="text-right">Tax %</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
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
            <DialogTitle>Finalize Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to finalize this invoice? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Update stock levels</li>
                <li>Update customer balance</li>
                <li>Lock the invoice from further edits</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} disabled={finalizeInvoice.isPending}>
              {finalizeInvoice.isPending ? 'Finalizing...' : 'Finalize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Invoice
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending ? 'Canceling...' : 'Cancel Invoice'}
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
