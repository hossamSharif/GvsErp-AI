'use client';

/**
 * Share Invoice via WhatsApp Dialog
 *
 * Sends a sales/purchase invoice PDF over WhatsApp. WhatsApp offers no web
 * hook that both targets a number and attaches a file, so two routes exist:
 *
 * - File share (phones, and desktops whose browser supports sharing files):
 *   the OS share sheet with the real PDF attached; the user picks the chat.
 * - Chat link (everywhere): wa.me/<number> opens the chosen number's chat with
 *   the message and a short /s/<token> link to the uploaded PDF. On desktop the
 *   PDF is also downloaded so it can be dragged into the chat.
 *
 * The PDF is rendered as soon as the dialog opens: navigator.share must run
 * inside the click's user activation, so the file has to exist already.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InvoicePdf } from '@/components/reports/invoice-pdf';
import { formatAmount, formatShortDate } from '@/components/reports/invoice-format';
import { useToast } from '@/hooks/use-toast';
import { useTenantSettings } from '@/hooks/use-settings';
import { useCreateInvoiceShare, useInvoiceBalanceSnapshot } from '@/hooks/use-invoices';
import { PRINT_TEMPLATES, printTemplateFromSettings } from '@/lib/print-template';
import { blobToBase64, renderInvoicePdfBlob } from '@/lib/invoice-pdf-blob';
import {
  DEFAULT_DIAL_CODE,
  buildWhatsAppUrl,
  isValidWhatsAppNumber,
  toWhatsAppNumber,
} from '@/lib/whatsapp';
import type { InvoicePrintTemplate, InvoiceWithRelations } from '@erp/shared';

interface ShareInvoiceWhatsAppDialogProps {
  invoice: InvoiceWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RenderedPdf {
  key: string;
  file: File;
  /** Share link already uploaded for this exact PDF (reused on repeat clicks) */
  link?: string;
}

/** Let late async content (QR code, logo) paint before capturing. */
async function settle(node: HTMLElement) {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 300));
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
    )
  );
}

/**
 * Phones/tablets, where the share sheet reliably lists WhatsApp. Desktop
 * browsers (Windows Chrome/Edge, macOS Safari) can share files too, but the
 * sheet only lists WhatsApp when the desktop app happens to be installed.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
    .userAgentData;
  if (uaData?.mobile) return true;
  const ua = navigator.userAgent;
  // iPadOS reports a Mac user agent; touch support gives it away.
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Public link for a share token. Defaults to the app's own short /s/<token>
 * route; NEXT_PUBLIC_SHARE_URL overrides the base (e.g. the deployed API's
 * /public/shares when running on localhost, which WhatsApp won't linkify and
 * the recipient's phone can't reach).
 */
function buildShareLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_SHARE_URL?.replace(/\/+$/, '');
  return base ? `${base}/${token}` : `${window.location.origin}/s/${token}`;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ShareInvoiceWhatsAppDialog({
  invoice,
  open,
  onOpenChange,
}: ShareInvoiceWhatsAppDialogProps) {
  const t = useTranslations('invoice.share');
  const tPrint = useTranslations('invoice.printMenu');
  const locale = useLocale();
  const { toast } = useToast();
  const createShare = useCreateInvoiceShare();

  const { data: settingsResp } = useTenantSettings();
  const settings = settingsResp?.data;
  const dialCode = settings?.default_dial_code || DEFAULT_DIAL_CODE;

  const [template, setTemplate] = useState<InvoicePrintTemplate>(() =>
    printTemplateFromSettings(settings, invoice.type)
  );
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [pdf, setPdf] = useState<RenderedPdf | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [captureNode, setCaptureNode] = useState<HTMLDivElement | null>(null);

  const snapshotQuery = useInvoiceBalanceSnapshot(invoice.id, open && template === 'statement');
  const snapshotReady = template !== 'statement' || !snapshotQuery.isLoading;

  const fileName = useMemo(() => {
    const prefix =
      template === 'statement' ? 'Statement' : invoice.type === 'sale' ? 'Sale' : 'Purchase';
    return `${prefix}-${invoice.invoiceNumber}.pdf`;
  }, [template, invoice.type, invoice.invoiceNumber]);

  // Reset the form each time the dialog opens.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTemplate(printTemplateFromSettings(settings, invoice.type));
      setPhone(toWhatsAppNumber(invoice.party?.phone, dialCode));
      setPhoneTouched(false);
      setMessage(
        t(invoice.type === 'sale' ? 'messageSale' : 'messagePurchase', {
          name: invoice.party?.name ?? '',
          number: invoice.invoiceNumber,
          date: formatShortDate(invoice.invoiceDate || invoice.createdAt),
          total: formatAmount(invoice.total),
          currency: invoice.currency,
        }).trim()
      );
    }
    wasOpen.current = open;
  }, [open, settings, invoice, dialCode, t]);

  // Render the PDF whenever the dialog is open and the template/invoice changes.
  const renderKey = `${invoice.id}:${invoice.updatedAt}:${template}:${locale}`;
  useEffect(() => {
    if (!open || !captureNode || !snapshotReady) return;
    let cancelled = false;
    setPdf(null);
    setRenderFailed(false);
    (async () => {
      try {
        await settle(captureNode);
        if (cancelled) return;
        const blob = await renderInvoicePdfBlob(captureNode);
        if (cancelled) return;
        setPdf({ key: renderKey, file: new File([blob], fileName, { type: 'application/pdf' }) });
      } catch (error) {
        console.error('[share-invoice] PDF render failed', error);
        if (!cancelled) setRenderFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, captureNode, snapshotReady, renderKey, fileName]);

  const canShareFiles = useMemo(() => {
    if (!pdf || typeof navigator === 'undefined' || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [pdf.file] });
    } catch {
      return false;
    }
  }, [pdf]);

  const isMobile = useMemo(isMobileDevice, []);
  // Phones: the share sheet with the file is the main action. Desktop: open
  // the number's chat (link + download); the share sheet is a secondary option.
  const preferFileShare = canShareFiles && isMobile;

  const phoneValid = isValidWhatsAppNumber(phone);
  const ready = !!pdf && !renderFailed;

  const handleShareFile = useCallback(async () => {
    if (!pdf) return;
    try {
      await navigator.share({ files: [pdf.file], text: message, title: pdf.file.name });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ variant: 'destructive', title: t('shareFailed') });
    }
  }, [pdf, message, onOpenChange, toast, t]);

  const handleOpenChat = useCallback(async () => {
    setPhoneTouched(true);
    if (!pdf || !phoneValid) return;

    // Open the tab inside the click so the popup blocker allows it; it is
    // pointed at WhatsApp once the upload finishes.
    const win = window.open('', '_blank');

    try {
      let link = pdf.key === renderKey ? pdf.link : undefined;
      if (!link) {
        const response = await createShare.mutateAsync({
          id: invoice.id,
          pdfBase64: await blobToBase64(pdf.file),
          phone,
        });
        link = buildShareLink(response.data.token);
        setPdf((current) => (current && current.key === pdf.key ? { ...current, link } : current));
      }

      const url = buildWhatsAppUrl(phone, `${message}\n\n${t('linkLine', { url: link })}`);
      if (win) win.location.href = url;
      else window.location.href = url;

      // Desktop: also keep the file, to drag into WhatsApp as an attachment.
      if (!isMobile) downloadFile(pdf.file);
      onOpenChange(false);
    } catch (error) {
      win?.close();
      toast({
        variant: 'destructive',
        title: t('uploadFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, [
    pdf,
    phoneValid,
    renderKey,
    createShare,
    invoice.id,
    phone,
    message,
    t,
    isMobile,
    onOpenChange,
    toast,
  ]);

  const busy = createShare.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg p-4 sm:max-w-lg sm:p-6">
          {/* pr-8 keeps the title clear of the close button in both directions */}
          <DialogHeader className="pr-8 text-start sm:text-start">
            <DialogTitle className="flex items-center gap-2 leading-snug">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              {t('title')}
            </DialogTitle>
            <DialogDescription>
              {t('description', { number: invoice.invoiceNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-phone">{t('phoneLabel')}</Label>
              <div className="relative" dir="ltr">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  +
                </span>
                <Input
                  id="share-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="pl-7 text-left tabular-nums"
                  placeholder={`${dialCode}9XXXXXXXX`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
                  onBlur={() => {
                    const normalized = toWhatsAppNumber(phone, dialCode);
                    setPhone(normalized);
                    // An empty field is only flagged once the user tries to send.
                    if (normalized) setPhoneTouched(true);
                  }}
                  aria-invalid={phoneTouched && !phoneValid}
                />
              </div>
              {phoneTouched && !phoneValid ? (
                <p className="text-sm text-destructive">{t('phoneInvalid')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {invoice.party?.phone ? t('phoneHintParty') : t('phoneHintNone')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('templateLabel')}</Label>
              <Select
                value={template}
                onValueChange={(value) => setTemplate(value as InvoicePrintTemplate)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_TEMPLATES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tPrint(option === 'standard' ? 'templateStandard' : 'templateStatement')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-message">{t('messageLabel')}</Label>
              <Textarea
                id="share-message"
                rows={4}
                className="min-h-[96px] resize-y"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {renderFailed ? (
                <span className="text-destructive">{t('renderFailed')}</span>
              ) : !ready ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('preparing')}
                </span>
              ) : preferFileShare ? (
                t('hintFileShare')
              ) : (
                t('hintLink')
              )}
            </p>
          </div>

          {/* Stacked full-width on phones; one wrapping row from sm up.
              sm:space-x-0 drops the base footer's LTR-only margins (gap handles spacing). */}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:space-x-0 [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              variant="ghost"
              disabled={!ready || busy}
              onClick={() => pdf && downloadFile(pdf.file)}
            >
              <Download className="h-4 w-4 me-2" />
              {t('download')}
            </Button>
            {preferFileShare && (
              <Button variant="outline" disabled={!ready || busy} onClick={handleOpenChat}>
                {busy ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 me-2" />
                )}
                {t('openChatLink')}
              </Button>
            )}
            {canShareFiles && !preferFileShare && (
              <Button variant="outline" disabled={!ready || busy} onClick={handleShareFile}>
                <Share2 className="h-4 w-4 me-2" />
                {t('shareFileDesktop')}
              </Button>
            )}
            {preferFileShare ? (
              <Button
                className="bg-[#25D366] text-white hover:bg-[#1ebe5a]"
                disabled={!ready || busy}
                onClick={handleShareFile}
              >
                <Share2 className="h-4 w-4 me-2" />
                {t('shareFile')}
              </Button>
            ) : (
              <Button
                className="bg-[#25D366] text-white hover:bg-[#1ebe5a]"
                disabled={!ready || busy}
                onClick={handleOpenChat}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 me-2" />
                )}
                {t('openChat')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Off-screen render of the template for the PDF (display:none can't be rasterized). */}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-hidden
            style={{ position: 'fixed', top: 0, left: -10000, pointerEvents: 'none' }}
          >
            <InvoicePdf
              ref={setCaptureNode}
              invoice={invoice}
              template={template}
              snapshot={snapshotQuery.data}
            />
          </div>,
          document.body
        )}
    </>
  );
}

export default ShareInvoiceWhatsAppDialog;
