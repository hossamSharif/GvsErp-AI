'use client';

/**
 * Return Invoice Dialog
 *
 * Dialog for creating a return from a finalized invoice.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateReturn } from '@/hooks/use-invoices';
import type { InvoiceWithRelations, ReturnInvoiceInput } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface ReturnInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceWithRelations;
  onSuccess?: () => void;
}

interface ReturnItem {
  invoiceItemId: string;
  itemName: string;
  originalQuantity: number;
  returnQuantity: number;
  unitPrice: number;
  selected: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReturnInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: ReturnInvoiceDialogProps) {
  const t = useTranslations('sales.return');

  // Initialize return items from invoice
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(() =>
    invoice.items.map((item) => ({
      invoiceItemId: item.id,
      itemName: item.item.name,
      originalQuantity: item.quantity,
      returnQuantity: item.quantity, // Default to full return
      unitPrice: item.unitPrice,
      selected: false,
    }))
  );

  const [notes, setNotes] = useState(t('notesDefault', { number: invoice.invoiceNumber }));
  const [error, setError] = useState<string | null>(null);

  // Mutation
  const createReturn = useCreateReturn();

  // Toggle item selection
  const handleToggleItem = useCallback((invoiceItemId: string) => {
    setReturnItems((items) =>
      items.map((item) =>
        item.invoiceItemId === invoiceItemId
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  }, []);

  // Update return quantity
  const handleQuantityChange = useCallback((invoiceItemId: string, quantity: number) => {
    setReturnItems((items) =>
      items.map((item) =>
        item.invoiceItemId === invoiceItemId
          ? {
              ...item,
              returnQuantity: Math.min(Math.max(0.001, quantity), item.originalQuantity),
            }
          : item
      )
    );
  }, []);

  // Select/deselect all
  const handleSelectAll = useCallback((selected: boolean) => {
    setReturnItems((items) => items.map((item) => ({ ...item, selected })));
  }, []);

  // Calculate return total
  const selectedItems = returnItems.filter((item) => item.selected);
  const returnTotal = useMemo(() => {
    return selectedItems.reduce(
      (sum, item) => sum + item.returnQuantity * item.unitPrice,
      0
    );
  }, [selectedItems]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (selectedItems.length === 0) {
      setError(t('errorSelectOne'));
      return;
    }

    // Validate quantities
    const invalidItems = selectedItems.filter(
      (item) => item.returnQuantity <= 0 || item.returnQuantity > item.originalQuantity
    );
    if (invalidItems.length > 0) {
      setError(t('errorQuantity'));
      return;
    }

    setError(null);

    try {
      const input: ReturnInvoiceInput = {
        items: selectedItems.map((item) => ({
          invoiceItemId: item.invoiceItemId,
          returnQuantity: item.returnQuantity,
        })),
        notes: notes || undefined,
      };

      await createReturn.mutateAsync({
        originalInvoiceId: invoice.id,
        data: input,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    }
  }, [selectedItems, notes, invoice.id, createReturn, onSuccess, onOpenChange, t]);

  const allSelected = returnItems.length > 0 && returnItems.every((item) => item.selected);
  const someSelected = returnItems.some((item) => item.selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 aria-hidden="true" className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description', { number: invoice.invoiceNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Items Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label={t('selectAll')}
                    />
                  </TableHead>
                  <TableHead>{t('columns.item')}</TableHead>
                  <TableHead className="text-right w-24">{t('columns.original')}</TableHead>
                  <TableHead className="w-32">{t('columns.returnQty')}</TableHead>
                  <TableHead className="text-right w-28">{t('columns.unitPrice')}</TableHead>
                  <TableHead className="text-right w-28">{t('columns.returnValue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnItems.map((item) => (
                  <TableRow
                    key={item.invoiceItemId}
                    className={cn(!item.selected && 'opacity-50')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => handleToggleItem(item.invoiceItemId)}
                        aria-label={t('selectItem', { name: item.itemName })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right">{item.originalQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.returnQuantity}
                        onChange={(e) =>
                          handleQuantityChange(item.invoiceItemId, parseFloat(e.target.value) || 0)
                        }
                        min={0.001}
                        max={item.originalQuantity}
                        step={0.001}
                        disabled={!item.selected}
                        className="h-8 w-24"
                        aria-label={t('returnQtyAriaLabel', { name: item.itemName })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.selected
                        ? (item.returnQuantity * item.unitPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="return-notes">{t('notesLabel')}</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={2}
            />
          </div>

          {/* Summary */}
          <div className="flex justify-between items-center p-4 bg-muted/50 rounded-md">
            <div className="text-sm text-muted-foreground">
              {t('selectedSummary', { selected: selectedItems.length, total: returnItems.length })}
            </div>
            <div className="text-lg font-semibold">
              {t('returnTotal', {
                amount: returnTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }),
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!someSelected || createReturn.isPending}
          >
            {createReturn.isPending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReturnInvoiceDialog;
