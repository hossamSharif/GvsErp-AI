'use client';

/**
 * Invoice Checkout Sheet
 *
 * Mobile bottom sheet opened from the sticky bar's "Checkout" button on new
 * invoices. Shows the party, totals and invoice discount, plus the payment
 * accelerator fields (payment way / reference) that prefill the post-finalize
 * payment step. Finalize/save call straight into the form's existing handlers,
 * so the configured payment flow and offline queueing are unchanged.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ChevronRight, Loader2, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface InvoiceCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Customer/supplier name, or the "select customer" placeholder. */
  partyLabel: string;
  /** Opens the header card so the user can change party/warehouse. */
  onEditDetails: () => void;
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  onDiscountChange: (value: number) => void;
  total: number;
  currency: string;
  /** Payment way + reference inputs (shared with the desktop header card). */
  paymentFields?: React.ReactNode;
  /** Why the invoice can't be submitted yet, if it can't. */
  validationMessage?: string | null;
  onFinalize: () => void;
  onSaveDraft: () => void;
  /** A create/finalize request is in flight. */
  pending: boolean;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

export function InvoiceCheckoutSheet({
  open,
  onOpenChange,
  partyLabel,
  onEditDetails,
  itemCount,
  subtotal,
  taxAmount,
  discountAmount,
  onDiscountChange,
  total,
  currency,
  paymentFields,
  validationMessage,
  onFinalize,
  onSaveDraft,
  pending,
}: InvoiceCheckoutSheetProps) {
  const t = useTranslations('sales.form');
  const tPay = useTranslations('payments.recordDialog');
  const blocked = !!validationMessage;
  // Which button started the in-flight request, so only it shows a spinner.
  const [action, setAction] = useState<'finalize' | 'save' | null>(null);
  const finalizePending = pending && action === 'finalize';
  const savePending = pending && action === 'save';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{t('checkout')}</SheetTitle>
          <SheetDescription>{t('itemCount', { count: itemCount })}</SheetDescription>
        </SheetHeader>

        <div className="-mx-4 flex-1 space-y-4 overflow-y-auto px-4">
          {/* Party / details */}
          <button
            type="button"
            onClick={onEditDetails}
            className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-start"
          >
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{t('details')}</span>
              <span className="block truncate font-medium">{partyLabel}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </button>

          {/* Totals */}
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tax')}</span>
              <span className="tabular-nums">{fmt(taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('discount')}</span>
              <Input
                type="number"
                inputMode="decimal"
                value={discountAmount || 0}
                onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 w-28 text-end text-base"
                min={0}
                step={0.01}
                aria-label={t('discountAriaLabel')}
              />
            </div>
            <div className="flex items-baseline justify-between border-t pt-2">
              <span className="font-semibold">{t('total')}</span>
              <span className="text-xl font-bold tabular-nums">
                {fmt(total)} <span className="text-sm font-normal text-muted-foreground">{currency}</span>
              </span>
            </div>
          </div>

          {/* Payment accelerators */}
          {paymentFields && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{tPay('paymentWay')}</p>
              {paymentFields}
            </div>
          )}

          {validationMessage && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {validationMessage}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => {
              setAction('save');
              onSaveDraft();
            }}
            disabled={blocked || pending}
          >
            {savePending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            {t('saveDraft')}
          </Button>
          <Button
            type="button"
            className="h-12 flex-[2] text-base"
            onClick={() => {
              setAction('finalize');
              onFinalize();
            }}
            disabled={blocked || pending}
          >
            {finalizePending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="me-2 h-4 w-4 rtl:-scale-x-100" />
            )}
            {t('finalize')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default InvoiceCheckoutSheet;
