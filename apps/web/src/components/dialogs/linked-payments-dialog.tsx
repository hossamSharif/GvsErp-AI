'use client';

/**
 * Linked Payments Dialog
 *
 * Shown when an invoice edit or delete is blocked by the payments linked to it
 * (server: 409 INVOICE_HAS_PAYMENTS / INVOICE_HAS_SHARED_PAYMENTS, with the
 * payment list attached as `error.meta`). Lists the payments and offers to
 * delete them as part of the same request, so the user never has to leave the
 * invoice for the payments section.
 *
 * A payment shared with other invoices can't be removed automatically — those
 * rows are badged and linked out, and the confirm button is disabled.
 */

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { LinkedPaymentsMeta } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface LinkedPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which operation is blocked — drives the copy and the confirm label. */
  mode: 'edit' | 'delete';
  /** The `error.meta` payload from the 409. */
  meta: LinkedPaymentsMeta | null;
  /** Active locale, for the links into the payments section. */
  locale: string;
  isPending: boolean;
  onConfirm: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2 });

// =============================================================================
// COMPONENT
// =============================================================================

export function LinkedPaymentsDialog({
  open,
  onOpenChange,
  mode,
  meta,
  locale,
  isPending,
  onConfirm,
}: LinkedPaymentsDialogProps) {
  const t = useTranslations('linkedPayments');

  if (!meta) return null;

  const blocked = meta.hasSharedPayments;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(mode === 'edit' ? 'editTitle' : 'deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t(mode === 'edit' ? 'editBody' : 'deleteBody', {
              count: meta.paymentCount,
              total: formatAmount(meta.totalPaid),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {blocked && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('sharedWarning')}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.reference')}</TableHead>
                  <TableHead>{t('columns.method')}</TableHead>
                  <TableHead className="text-end w-28">{t('columns.amount')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">
                      {payment.paymentDate}
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {payment.reference ?? payment.id.slice(0, 8)}
                        {payment.shared && (
                          <Badge variant="destructive">{t('sharedBadge')}</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.bankAccountName ?? payment.paymentMethod ?? t('cash')}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatAmount(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${locale}/payments/${payment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('openPayment')}
                        title={t('openPayment')}
                        className="text-muted-foreground hover:text-foreground inline-flex"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end text-sm text-muted-foreground">
            {t('totalPaid', {
              count: meta.paymentCount,
              total: formatAmount(meta.totalPaid),
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(blocked ? 'close' : 'cancel')}
          </Button>
          {!blocked && (
            <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
              {isPending
                ? t('pending')
                : t(mode === 'edit' ? 'confirmEdit' : 'confirmDelete')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LinkedPaymentsDialog;
