'use client';

/**
 * Invoice List Sharer
 *
 * Lets the sales/purchase list pages share an invoice over WhatsApp straight
 * from a row's actions menu. It loads the full invoice (usually already cached
 * by the row-hover prefetch) and opens the same share dialog as the detail page.
 */

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ShareInvoiceWhatsAppDialog } from '@/components/dialogs/share-invoice-whatsapp-dialog';
import { useInvoice } from '@/hooks/use-invoices';
import { useToast } from '@/hooks/use-toast';

interface InvoiceListSharerProps {
  /** Invoice to share; null → closed */
  invoiceId: string | null;
  onClose: () => void;
}

export function InvoiceListSharer({ invoiceId, onClose }: InvoiceListSharerProps) {
  const { toast } = useToast();
  const t = useTranslations('invoice.share');

  const { data, isError } = useInvoice(invoiceId ?? undefined);
  const invoice = data?.data?.id === invoiceId ? data?.data : undefined;

  useEffect(() => {
    if (invoiceId && isError) {
      toast({ variant: 'destructive', title: t('loadFailed') });
      onClose();
    }
  }, [invoiceId, isError, toast, t, onClose]);

  if (!invoiceId || !invoice) return null;

  return (
    <ShareInvoiceWhatsAppDialog
      invoice={invoice}
      open
      onOpenChange={(open) => !open && onClose()}
    />
  );
}

export default InvoiceListSharer;
