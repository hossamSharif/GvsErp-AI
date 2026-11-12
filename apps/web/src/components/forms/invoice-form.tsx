'use client';

/**
 * Invoice Form Component
 *
 * Full invoice form with autosave support using the draft store.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Save,
  Send,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Eraser,
  MoreVertical,
  Plus,
  ShoppingCart,
  StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-media-query';
import { useDraftStore, getDraftSubtotal, getDraftTaxAmount, getDraftTotal, isDraftValid } from '@/stores/draft-store';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { InvoiceItemCards } from '@/components/tables/invoice-item-cards';
import { MobileItemPicker } from '@/components/forms/mobile-item-picker';
import { InvoiceCheckoutSheet } from '@/components/forms/invoice-checkout-sheet';
import { PartySelect } from '@/components/forms/party-select';
import { CurrencySelect } from '@/components/forms/currency-select';
import { ItemQuickAdd, type QuickAddItem } from '@/components/forms/item-quick-add';
import { RecordPaymentDialog, SENTINEL_CASH } from '@/components/dialogs/record-payment-dialog';
import { LinkedPaymentsDialog } from '@/components/dialogs/linked-payments-dialog';
import { buildInvoicePaymentPayload } from '@/lib/build-invoice-payment';
import {
  useCreateInvoice,
  useUpdateInvoice,
  useFinalizeInvoice,
  useStockAvailability,
} from '@/hooks/use-invoices';
import { useCreatePayment } from '@/hooks/use-payments';
import { usePaymentFlow } from '@/hooks/use-payment-flow';
import { useCurrencies } from '@/hooks/use-currencies';
import { useBanks } from '@/hooks/use-banks';
import { ApiClientError } from '@/lib/api-client';
import type {
  DraftInvoiceItem,
  InvoiceType,
  InvoiceWithRelations,
  LinkedPaymentsMeta,
} from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceFormProps {
  /** Draft ID for editing existing draft */
  draftId?: string;
  /** Existing invoice for editing (server-side) */
  existingInvoice?: InvoiceWithRelations;
  /** Invoice type */
  type: InvoiceType;
  /** Available warehouses */
  warehouses: Array<{ id: string; name: string }>;
  /** Available parties */
  parties: Array<{
    id: string;
    name: string;
    type: 'customer' | 'supplier';
    balance: number;
    email?: string | null;
    phone?: string | null;
  }>;
  /** Default warehouse ID */
  defaultWarehouseId?: string;
  /** Callback after successful save */
  onSaved?: (invoice: InvoiceWithRelations) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** When set, the form renders its own title row (title + back + date) at the top. New pages only. */
  headerTitle?: string;
  /** Back link target for the in-form title row. */
  headerBackHref?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InvoiceForm({
  draftId,
  existingInvoice,
  type,
  warehouses,
  parties,
  onSaved,
  readOnly = false,
  headerTitle,
  headerBackHref,
}: InvoiceFormProps) {
  const router = useRouter();
  const { locale } = useParams();
  const { toast } = useToast();
  const t = useTranslations('sales.form');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('payments.recordDialog');
  const tPayForm = useTranslations('payments.form');

  // Whether this is a brand-new invoice (vs. editing/viewing). Gates the
  // payment-accelerator fields and the in-form title row.
  const isNew = !existingInvoice && !readOnly;

  // Draft store
  const {
    drafts,
    createDraft,
    getDraft,
    updateDraft,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    deleteDraft,
    listDrafts,
    findDraftBySource,
    cleanupOldDrafts,
  } = useDraftStore();

  // Current draft
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const draft = currentDraftId ? getDraft(currentDraftId) : undefined;


  // Post-finalize payment workflow: after a final invoice is saved, offer to
  // record the receipt/disbursement immediately. `savedInvoice` holds the
  // finalized invoice while the prompt/modal are open, deferring `onSaved`
  // (the parent's redirect) until the user finishes or skips the payment.
  const [savedInvoice, setSavedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // A finalized invoice can't be edited while payments reference it. The server
  // returns the blocking payments as `error.meta`; holding them here opens the
  // dialog that offers to delete them and re-run the save in one step, so the
  // user never has to leave the invoice for the payments section.
  const [paymentsPrompt, setPaymentsPrompt] = useState<LinkedPaymentsMeta | null>(null);

  // Payment accelerators (new invoices only): the user picks the payment way and
  // reference up front so the post-finalize payment modal opens ready to save.
  // First option (cash) is pre-selected, matching the pre-selected customer.
  const [paymentBankAccountId, setPaymentBankAccountId] = useState(SENTINEL_CASH);
  const [paymentReference, setPaymentReference] = useState('');
  const { data: banks = [] } = useBanks();

  // Party/warehouse header card starts collapsed to keep the item-entry area
  // near the top; a chevron toggles it open when the user needs to change
  // the customer/supplier, warehouse, currency, or date.
  const [headerOpen, setHeaderOpen] = useState(false);

  // Confirmation for the "clear invoice" action in the sticky bottom bar.
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Mobile layout (< md): full-screen item picker, accordion item cards, and a
  // checkout sheet in place of the desktop quick-add bar / table / summary.
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Quick-add bar: ref to focus the input, and a transient row highlight shown
  // when a scan/selection increments an already-present line.
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const [flashLocalId, setFlashLocalId] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashRow = useCallback((localId: string) => {
    setFlashLocalId(localId);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlashLocalId(null), 800);
  }, []);

  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
  }, []);

  // Mutations
  const createInvoice = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const finalizeInvoice = useFinalizeInvoice();
  const createPayment = useCreatePayment();

  // Configured payment workflow for this invoice type (dialog | background |
  // skip). Read from tenant settings, mirrored to localStorage for offline use.
  const paymentFlow = usePaymentFlow(type);

  // Tenant default currency — pre-selected on new invoices to save data entry.
  // Same query params as CurrencySelect so the fetch is shared from cache.
  const { data: currenciesData } = useCurrencies({
    limit: 100,
    sortBy: 'code',
    sortDir: 'asc',
  });
  const defaultCurrencyCode = currenciesData?.data.find((c) => c.is_default)?.code;

  // Tracks the draft we created fresh (vs. a recovered one) and whether we've
  // already applied the default currency to it, so we set it exactly once and
  // never clobber a currency the user changed on a recovered draft.
  const freshDraftIdRef = useRef<string | null>(null);
  const defaultCurrencyAppliedRef = useRef(false);

  // Stock availability
  const itemIds = draft?.items.map((i) => i.itemId) || [];
  const { data: stockData } = useStockAvailability(
    draft?.warehouseId || undefined,
    itemIds
  );

  // Garbage-collect drafts abandoned more than 7 days ago. Declared before the
  // restore effect below so it runs first on mount — otherwise it could delete
  // the draft that effect has just recovered, leaving the form with no draft.
  const cleanupDoneRef = useRef(false);
  useEffect(() => {
    if (cleanupDoneRef.current) return;
    cleanupDoneRef.current = true;
    cleanupOldDrafts();
  }, [cleanupOldDrafts]);

  // Initialize draft — rehydrate most recent non-empty draft, else create new
  useEffect(() => {
    if (currentDraftId || existingInvoice) return;

    // Only drafts of a *new* invoice are recoverable here. Drafts carrying a
    // `sourceInvoiceId` hold unsaved edits of an existing invoice and belong to
    // that invoice's edit screen — offering them here is what made a stale
    // invoice reappear after every finalize.
    const existingDrafts = listDrafts(type).filter((d) => d.sourceInvoiceId === null);
    // Party, warehouse, currency and date are pre-filled by this form, not
    // typed by the user, so they must not count as content — otherwise every
    // empty sales draft looks recoverable, never gets purged below, and the
    // drafts pile up in localStorage.
    const hasContent = (d: typeof existingDrafts[number]) =>
      d.items.length > 0 || (d.notes ?? '') !== '' || d.discountAmount !== 0;

    const recoverable = existingDrafts
      .filter(hasContent)
      .sort((a, b) => new Date(b.lastSavedAt).getTime() - new Date(a.lastSavedAt).getTime())[0];

    if (recoverable) {
      setCurrentDraftId(recoverable.id);
      return;
    }

    // Purge empty orphan drafts so we don't leak them across sessions
    existingDrafts.filter((d) => !hasContent(d)).forEach((d) => deleteDraft(d.id));

    const newDraftId = createDraft(type);
    freshDraftIdRef.current = newDraftId;
    const initialUpdates: Parameters<typeof updateDraft>[1] = {};
    // For sales, pre-select the first customer and first warehouse so a new
    // invoice opens ready to enter items (common single-customer flows).
    if (type === 'sale') {
      const firstCustomer = parties.find((p) => p.type === 'customer');
      if (firstCustomer) initialUpdates.partyId = firstCustomer.id;
      const firstWarehouseId = warehouses[0]?.id;
      if (firstWarehouseId) initialUpdates.warehouseId = firstWarehouseId;
    }
    // Tenant default currency is pre-filled for both types. Currencies may
    // still be loading — the effect below applies it once ready.
    if (defaultCurrencyCode) {
      initialUpdates.currency = defaultCurrencyCode;
      defaultCurrencyAppliedRef.current = true;
    }
    if (Object.keys(initialUpdates).length > 0) {
      updateDraft(newDraftId, initialUpdates);
    }
    setCurrentDraftId(newDraftId);
  }, [currentDraftId, existingInvoice, type, createDraft, listDrafts, deleteDraft, updateDraft, defaultCurrencyCode, parties, warehouses]);

  // If currencies finish loading after the fresh draft was created, apply the
  // tenant default currency then. Guarded to the draft we created (not a
  // recovered one) and to run once, so a user's currency change is never
  // overwritten.
  useEffect(() => {
    if (existingInvoice) return;
    if (defaultCurrencyAppliedRef.current) return;
    if (!defaultCurrencyCode || !currentDraftId) return;
    if (currentDraftId !== freshDraftIdRef.current) return;
    updateDraft(currentDraftId, { currency: defaultCurrencyCode });
    defaultCurrencyAppliedRef.current = true;
  }, [defaultCurrencyCode, currentDraftId, existingInvoice, updateDraft]);

  // Sync existing invoice to draft
  useEffect(() => {
    if (existingInvoice && !currentDraftId) {
      // Resume the unsaved edits for this same invoice if we already have them,
      // so a refresh mid-edit doesn't lose work and repeat visits don't leave a
      // new draft behind on every mount.
      const resumable = findDraftBySource(type, existingInvoice.id);
      if (resumable) {
        setCurrentDraftId(resumable.id);
        return;
      }

      // Create draft from existing invoice, tagged so it can only ever be
      // restored here and never on the "new invoice" screen.
      const newDraftId = createDraft(type, existingInvoice.warehouseId, existingInvoice.id);
      setCurrentDraftId(newDraftId);

      // Update with existing invoice data
      updateDraft(newDraftId, {
        partyId: existingInvoice.partyId,
        warehouseId: existingInvoice.warehouseId,
        currency: existingInvoice.currency,
        invoiceDate: existingInvoice.invoiceDate,
        exchangeRate: existingInvoice.exchangeRate,
        discountAmount: existingInvoice.discountAmount,
        notes: existingInvoice.notes || '',
        items: existingInvoice.items.map((item) => ({
          localId: crypto.randomUUID(),
          itemId: item.itemId,
          itemName: item.item.name,
          itemSku: item.item.sku,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
          sortOrder: item.sortOrder,
        })),
      });
    }
  }, [existingInvoice, currentDraftId, type, createDraft, updateDraft, findDraftBySource]);

  // Autosave (debounced updates)
  useEffect(() => {
    if (!draft || readOnly) return;
    // The draft store automatically updates lastSavedAt on every change
  }, [draft, readOnly]);

  // Focus the item search field once the form is ready (new or edit mode) so
  // the user can start scanning/searching items immediately. Runs once per
  // mounted form; the quick-add bar only renders when the form is editable.
  const initialFocusDoneRef = useRef(false);
  useEffect(() => {
    if (readOnly || initialFocusDoneRef.current) return;
    if (!currentDraftId) return;
    // Defer to the next frame so the input is mounted and any autofocus from
    // child selects has settled before we claim focus.
    const id = requestAnimationFrame(() => {
      quickAddInputRef.current?.focus();
      initialFocusDoneRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [currentDraftId, readOnly]);

  // Handlers
  const handlePartyChange = useCallback(
    (partyId: string | null) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { partyId });
    },
    [currentDraftId, updateDraft]
  );

  const handleWarehouseChange = useCallback(
    (warehouseId: string) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { warehouseId });
    },
    [currentDraftId, updateDraft]
  );

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { currency });
    },
    [currentDraftId, updateDraft]
  );

  const handleDateChange = useCallback(
    (invoiceDate: string) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { invoiceDate });
    },
    [currentDraftId, updateDraft]
  );

  const handleNotesChange = useCallback(
    (notes: string) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { notes });
    },
    [currentDraftId, updateDraft]
  );

  const handleDiscountChange = useCallback(
    (discountAmount: number) => {
      if (!currentDraftId) return;
      updateDraft(currentDraftId, { discountAmount });
    },
    [currentDraftId, updateDraft]
  );

  // Empty-state button: focuses the quick-add bar on desktop, opens the
  // full-screen picker on mobile.
  const handleAddItem = useCallback(() => {
    if (isMobile) setPickerOpen(true);
    else quickAddInputRef.current?.focus();
  }, [isMobile]);

  // Add the scanned/selected item — or, if it is already on the invoice,
  // increment that line's quantity and flash it (key for barcode scanning).
  // `opts` carries a manual quantity/price; scans omit it and default to qty 1.
  const handleSelectItem = useCallback(
    (selectedItem: QuickAddItem, opts?: { quantity?: number; unitPrice?: number }) => {
      if (!currentDraftId) return;
      const quantity = opts?.quantity ?? 1;
      const existing = draft?.items.find((i) => i.itemId === selectedItem.id);
      if (existing) {
        updateItem(currentDraftId, existing.localId, {
          quantity: existing.quantity + quantity,
        });
        flashRow(existing.localId);
        return;
      }
      addItem(currentDraftId, {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        itemSku: selectedItem.sku,
        description: '',
        quantity,
        unitPrice: opts?.unitPrice ?? selectedItem.unitPrice,
        discountPercent: 0,
        taxRate: selectedItem.taxRate,
      });
    },
    [currentDraftId, draft, addItem, updateItem, flashRow]
  );

  const handleRemoveItem = useCallback(
    (localId: string) => {
      if (!currentDraftId) return;
      removeItem(currentDraftId, localId);
    },
    [currentDraftId, removeItem]
  );

  // Clear the invoice body (items, notes, discount) while keeping the header
  // selections the user already made — party, warehouse, currency, date and
  // exchange rate are deliberately absent from the patch, and the payment
  // accelerators are component state we never touch. Confirmed first when the
  // table has rows so a mis-click can't drop a long scanned list.
  const clearDraftBody = useCallback(() => {
    if (!currentDraftId) return;
    updateDraft(currentDraftId, { items: [], notes: '', discountAmount: 0 });
    setShowClearConfirm(false);
    quickAddInputRef.current?.focus();
    toast({ title: t('toasts.draftCleared') });
  }, [currentDraftId, updateDraft, toast, t]);

  const handleClearClick = useCallback(() => {
    if ((draft?.items.length ?? 0) > 0) setShowClearConfirm(true);
    else clearDraftBody();
  }, [draft, clearDraftBody]);

  const handleReorderItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!currentDraftId) return;
      reorderItems(currentDraftId, fromIndex, toIndex);
    },
    [currentDraftId, reorderItems]
  );

  const handleItemUpdate = useCallback(
    (localId: string, field: keyof DraftInvoiceItem, value: unknown) => {
      if (!currentDraftId) return;
      updateItem(currentDraftId, localId, { [field]: value } as Partial<DraftInvoiceItem>);
    },
    [currentDraftId, updateItem]
  );

  // Save: create a new invoice OR update the existingInvoice if we're editing.
  // `deletePayments` re-runs a save that was blocked by linked payments, asking
  // the server to delete those payments as part of the same request.
  const handleSaveDraft = useCallback(async (opts?: { deletePayments?: boolean }) => {
    if (!draft || !draft.warehouseId) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('toasts.selectWarehouse'),
      });
      return;
    }

    if (draft.items.length === 0) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('toasts.addOneItem'),
      });
      return;
    }

    const itemsPayload = draft.items.map((item) => ({
      itemId: item.itemId,
      description: item.description || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      sortOrder: item.sortOrder,
    }));

    try {
      if (existingInvoice) {
        const result = await updateInvoiceMutation.mutateAsync({
          id: existingInvoice.id,
          deletePayments: opts?.deletePayments,
          data: {
            partyId: draft.partyId,
            warehouseId: draft.warehouseId,
            currency: draft.currency,
            invoiceDate: draft.invoiceDate,
            exchangeRate: draft.exchangeRate,
            discountAmount: draft.discountAmount,
            notes: draft.notes || undefined,
            items: itemsPayload,
          },
        });

        if (currentDraftId) {
          deleteDraft(currentDraftId);
        }

        setPaymentsPrompt(null);

        toast({
          title: t('toasts.draftSaved'),
          description: t('toasts.draftSavedDescription', { number: result.data.invoiceNumber }),
        });

        onSaved?.(result.data);
        return;
      }

      const result = await createInvoice.mutateAsync({
        type: draft.type,
        partyId: draft.partyId,
        warehouseId: draft.warehouseId,
        currency: draft.currency,
        invoiceDate: draft.invoiceDate,
        exchangeRate: draft.exchangeRate,
        discountAmount: draft.discountAmount,
        notes: draft.notes || undefined,
        items: itemsPayload,
      });

      // Clean up local draft
      if (currentDraftId) {
        deleteDraft(currentDraftId);
      }
      setCheckoutOpen(false);

      toast({
        title: t('toasts.draftSaved'),
        description: t('toasts.draftSavedDescription', { number: result.data.invoiceNumber }),
      });

      onSaved?.(result.data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Blocked by linked payments — show them and offer to delete them as
        // part of the save. INVOICE_HAS_SHARED_PAYMENTS comes back when the
        // cascade was attempted but a payment also covers other invoices; the
        // dialog renders that as a blocking warning with links to each payment.
        if (
          (error.code === 'INVOICE_HAS_PAYMENTS' ||
            error.code === 'INVOICE_HAS_SHARED_PAYMENTS') &&
          error.meta
        ) {
          setPaymentsPrompt((error.meta as unknown) as LinkedPaymentsMeta);
          return;
        }

        // The cascade needs payments:delete on top of invoices:write.
        if (error.status === 403 && opts?.deletePayments) {
          setPaymentsPrompt(null);
          toast({
            variant: 'destructive',
            title: tCommon('error'),
            description: t('toasts.deletePaymentsForbidden'),
          });
          return;
        }
      }

      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('toasts.saveFailed'),
      });
    }
  }, [draft, existingInvoice, currentDraftId, createInvoice, updateInvoiceMutation, deleteDraft, toast, onSaved, t, tCommon]);

  // Finalize invoice
  const handleFinalize = useCallback(async () => {
    if (!draft || !draft.warehouseId) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('toasts.selectWarehouse'),
      });
      return;
    }

    if (draft.items.length === 0) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('toasts.addOneItem'),
      });
      return;
    }

    // First create the invoice
    try {
      const createResult = await createInvoice.mutateAsync({
        type: draft.type,
        partyId: draft.partyId,
        warehouseId: draft.warehouseId,
        currency: draft.currency,
        invoiceDate: draft.invoiceDate,
        exchangeRate: draft.exchangeRate,
        discountAmount: draft.discountAmount,
        notes: draft.notes || undefined,
        items: draft.items.map((item) => ({
          itemId: item.itemId,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
          sortOrder: item.sortOrder,
        })),
      });

      // Then finalize it
      const finalizeResult = await finalizeInvoice.mutateAsync({
        id: createResult.data.id,
      });

      // Clean up local draft and hand the form a blank slate. Resetting
      // `currentDraftId` lets the restore effect build a fresh draft on the
      // next render, so the user can carry on selling even if the parent never
      // remounts us (e.g. the payment dialog is dismissed).
      if (currentDraftId) {
        deleteDraft(currentDraftId);
        setCurrentDraftId(null);
      }
      // Close the mobile checkout sheet before any payment dialog opens.
      setCheckoutOpen(false);

      toast({
        title: t('toasts.finalized'),
        description: t('toasts.finalizedDescription', { number: finalizeResult.data.invoiceNumber }),
      });

      const finalized = finalizeResult.data;

      // Walk-in invoices (no party) never record an immediate payment. The rest
      // follow the tenant's configured workflow for this invoice type.
      if (!finalized.partyId || paymentFlow === 'skip') {
        onSaved?.(finalized);
        return;
      }

      if (paymentFlow === 'background') {
        // Record the payment automatically (no dialog) using the invoice total
        // and the top-card accelerators. Works offline via the outbox.
        try {
          await createPayment.mutateAsync(
            buildInvoicePaymentPayload(finalized, {
              bankAccountId: paymentBankAccountId,
              reference: paymentReference,
            })
          );
          toast({
            title: tPay('toastSuccess'),
            description: tPay('toastSuccessDesc', {
              amount: finalized.total.toLocaleString(undefined, { minimumFractionDigits: 2 }),
              currency: finalized.currency,
            }),
          });
          onSaved?.(finalized);
        } catch (error) {
          // The invoice is already finalized — fall back to the dialog so the
          // user can retry/adjust the payment without losing anything.
          toast({
            variant: 'destructive',
            title: tPay('toastError'),
            description: error instanceof Error ? error.message : tPay('toastErrorDesc'),
          });
          setSavedInvoice(finalized);
          setShowPaymentModal(true);
        }
        return;
      }

      // Default ('dialog'): offer to record the payment in the dialog.
      setSavedInvoice(finalized);
      setShowPaymentModal(true);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('toasts.finalizeFailed'),
      });
    }
  }, [draft, currentDraftId, createInvoice, finalizeInvoice, deleteDraft, toast, onSaved, t, tCommon, paymentFlow, createPayment, paymentBankAccountId, paymentReference, tPay]);

  // Calculate totals
  const subtotal = draft ? getDraftSubtotal(draft) : 0;
  const taxAmount = draft ? getDraftTaxAmount(draft) : 0;
  const total = draft ? getDraftTotal(draft) : 0;
  const isValid = draft ? isDraftValid(draft) : false;

  // Filter parties by type
  const filteredParties = parties.filter(
    (p) => p.type === (type === 'sale' ? 'customer' : 'supplier')
  );

  const partyLabel =
    filteredParties.find((p) => p.id === draft?.partyId)?.name ||
    (type === 'sale' ? t('selectCustomer') : t('selectSupplier'));

  // Why the invoice can't be submitted yet (shown in the mobile checkout sheet).
  const missingWarehouse = !draft?.warehouseId;
  const missingItems = (draft?.items.length ?? 0) === 0;
  const validationMessage =
    missingWarehouse && missingItems
      ? t('validation.warehouseAndItems')
      : missingWarehouse
        ? t('validation.warehouseOnly')
        : missingItems
          ? t('validation.itemsOnly')
          : null;

  // Ctrl/Cmd+S finalizes the invoice (overriding the browser's save-page
  // dialog). When editing an existing invoice there is no finalize step, so it
  // saves the changes instead. Guarded by the same conditions as the buttons.
  const actionPending =
    createInvoice.isPending || updateInvoiceMutation.isPending || finalizeInvoice.isPending;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 's' || e.key === 'S') &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        if (readOnly || !isValid || actionPending) return;
        if (existingInvoice) {
          handleSaveDraft();
        } else {
          handleFinalize();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, isValid, actionPending, existingInvoice, handleSaveDraft, handleFinalize]);

  // Post-finalize payment workflow dialogs. Rendered in both the loading branch
  // and the main return, because finalizing deletes the local draft (so the
  // form falls into the loading state below) while the prompt/modal must stay
  // mounted until the user records the payment or skips.
  const paymentWorkflowDialogs = (
    <>
      <LinkedPaymentsDialog
        open={paymentsPrompt !== null}
        onOpenChange={(open) => !open && setPaymentsPrompt(null)}
        mode="edit"
        meta={paymentsPrompt}
        locale={locale as string}
        isPending={updateInvoiceMutation.isPending}
        onConfirm={() => handleSaveDraft({ deletePayments: true })}
      />
      {savedInvoice && (
        <RecordPaymentDialog
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          invoice={savedInvoice}
          defaultBankAccountId={
            paymentBankAccountId === SENTINEL_CASH ? '' : paymentBankAccountId
          }
          defaultReference={paymentReference}
          onDone={() => {
            setShowPaymentModal(false);
            onSaved?.(savedInvoice);
          }}
        />
      )}
    </>
  );

  if (!draft && !existingInvoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('loading')}</p>
        {paymentWorkflowDialogs}
      </div>
    );
  }

  // Payment way + reference — rendered in the header card on desktop and in
  // the checkout sheet on mobile; both write the same component state.
  const paymentFields = (
    <>
      <div className="w-full sm:w-44">
        <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId}>
          <SelectTrigger aria-label={tPay('paymentWay')} className={cn(isMobile && 'h-11')}>
            <SelectValue placeholder={tPayForm('bankAccountPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL_CASH}>{tPayForm('bankAccountCash')}</SelectItem>
            {banks
              .filter((b) => b.is_active)
              .map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="font-mono text-xs me-2">{b.ledger?.code ?? ''}</span>
                  {b.name}
                  {b.bank_name ? ` · ${b.bank_name}` : ''}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-44">
        <Input
          aria-label={tPayForm('reference')}
          placeholder={tPayForm('referencePlaceholder')}
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          className={cn('h-10', isMobile && 'h-11 text-base')}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* In-form title row (new invoices): title + back on the start, date on
          the end — moved here from the header card so the date sits with the
          page title and the card row has room for the payment fields. */}
      {headerTitle && (
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            {headerBackHref && (
              <Button variant="ghost" size="icon" asChild aria-label={tCommon('back')}>
                <Link href={headerBackHref}>
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            )}
            <h1 className="truncate text-xl font-bold md:text-2xl">{headerTitle}</h1>
          </div>
          <div className="w-36 shrink-0 md:w-40">
            <Input
              type="date"
              aria-label={t('date')}
              value={draft?.invoiceDate || ''}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={readOnly}
              className="h-10"
            />
          </div>
        </div>
      )}

      {/* Header toolbar — party · warehouse · currency · date. Collapsed by
          default (showing a compact summary) so the items area stays near the
          top of the page; the chevron toggles the full controls. */}
      <Card className="p-3">
        {/* Always-visible summary row with the collapse toggle */}
        <button
          type="button"
          onClick={() => setHeaderOpen((o) => !o)}
          aria-expanded={headerOpen}
          aria-label={t('toggleHeader')}
          className="flex w-full items-center justify-between gap-3 text-start"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm min-w-0">
            <span className="font-medium truncate">
              {partyLabel}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">
              {warehouses.find((w) => w.id === draft?.warehouseId)?.name ||
                t('selectWarehouse')}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{draft?.currency || 'USD'}</span>
            {draft?.invoiceDate && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{draft.invoiceDate}</span>
              </>
            )}
          </div>
          {headerOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {headerOpen && (
          <div className="grid grid-cols-1 gap-3 mt-3 pt-3 border-t sm:flex sm:flex-wrap sm:items-center">
            {/* Party/warehouse narrowed (from flex-1) so the payment-accelerator
                fields fit on the same row for new invoices. */}
            <div className="w-full sm:w-48">
              <PartySelect
                value={draft?.partyId || null}
                onChange={handlePartyChange}
                parties={filteredParties}
                partyType={type === 'sale' ? 'customer' : 'supplier'}
                placeholder={type === 'sale' ? t('selectCustomer') : t('selectSupplier')}
                disabled={readOnly}
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                value={draft?.warehouseId || ''}
                onValueChange={handleWarehouseChange}
                disabled={readOnly}
              >
                <SelectTrigger aria-label={t('warehouse')}>
                  <SelectValue placeholder={t('selectWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-32">
              <CurrencySelect
                value={draft?.currency || 'USD'}
                onValueChange={handleCurrencyChange}
                disabled={readOnly}
              />
            </div>
            {/* Payment accelerators (new invoices only) — prefill the post-finalize
                payment modal so the user can just save it. On mobile they live
                in the checkout sheet instead. */}
            {isNew && !isMobile && paymentFields}
            {/* Date only shown here when there is no in-form title row (edit/view). */}
            {!headerTitle && (
              <div className="w-full sm:w-40">
                <Input
                  type="date"
                  aria-label={t('date')}
                  value={draft?.invoiceDate || ''}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={readOnly}
                  className="h-10"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {isMobile ? (
        <>
          {/* Mobile items: big "Add items" button → full-screen picker, then
              accordion cards for the lines. */}
          <div className="space-y-3">
            {!readOnly && (
              <Button
                type="button"
                className="h-12 w-full text-base"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="me-2 h-5 w-5" />
                {t('addItems')}
              </Button>
            )}
            <InvoiceItemCards
              items={draft?.items || []}
              onRemoveItem={handleRemoveItem}
              onItemUpdate={handleItemUpdate}
              stockAvailability={stockData?.data}
              highlightLocalId={flashLocalId}
              readOnly={readOnly}
            />
          </div>

          {/* Notes — collapsed behind a toggle until used */}
          {notesOpen || draft?.notes ? (
            <Textarea
              value={draft?.notes || ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={t('notesPlaceholder')}
              aria-label={t('notes')}
              rows={3}
              disabled={readOnly}
              autoFocus={notesOpen && !draft?.notes}
              className="text-base"
            />
          ) : (
            !readOnly && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full justify-start text-muted-foreground"
                onClick={() => setNotesOpen(true)}
              >
                <StickyNote className="me-2 h-4 w-4" />
                {t('addNote')}
              </Button>
            )
          )}

          {/* Mobile sticky bar: total + one primary action; secondary actions
              live in the overflow menu. */}
          {!readOnly && (
            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center gap-2 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {t('itemCount', { count: draft?.items.length ?? 0 })}
                </p>
                <p className="truncate text-xl font-bold tabular-nums">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              {existingInvoice ? (
                <Button
                  className="h-12 px-5 text-base"
                  onClick={() => handleSaveDraft()}
                  disabled={!isValid || updateInvoiceMutation.isPending}
                >
                  <Save className="me-2 h-4 w-4" />
                  {t('saveChanges')}
                </Button>
              ) : (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 shrink-0"
                        aria-label={t('moreActions')}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-56">
                      {draft?.lastSavedAt && (
                        <>
                          <DropdownMenuLabel className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                            <Check className="h-3 w-3 text-green-500" />
                            {t('draftSavedAt', {
                              time: new Date(draft.lastSavedAt).toLocaleTimeString(),
                            })}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        className="min-h-[44px]"
                        disabled={!isValid || createInvoice.isPending}
                        onSelect={() => handleSaveDraft()}
                      >
                        <Save className="me-2 h-4 w-4" />
                        {t('saveDraft')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="min-h-[44px] text-destructive focus:text-destructive"
                        disabled={
                          !currentDraftId ||
                          ((draft?.items.length ?? 0) === 0 &&
                            !draft?.notes &&
                            !draft?.discountAmount)
                        }
                        onSelect={handleClearClick}
                      >
                        <Eraser className="me-2 h-4 w-4" />
                        {t('clearDraft')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    className="h-12 px-5 text-base"
                    onClick={() => setCheckoutOpen(true)}
                    disabled={(draft?.items.length ?? 0) === 0}
                  >
                    <ShoppingCart className="me-2 h-5 w-5" />
                    {t('checkout')}
                  </Button>
                </>
              )}
            </div>
          )}

          {!readOnly && (
            <MobileItemPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              priceTier={type === 'sale' ? 'retail' : 'cost'}
              lines={draft?.items || []}
              onSelect={handleSelectItem}
              onQuantityChange={(localId, quantity) =>
                handleItemUpdate(localId, 'quantity', quantity)
              }
              onRemove={handleRemoveItem}
              total={total}
            />
          )}

          {isNew && (
            <InvoiceCheckoutSheet
              open={checkoutOpen}
              onOpenChange={setCheckoutOpen}
              partyLabel={partyLabel}
              onEditDetails={() => {
                setCheckoutOpen(false);
                setHeaderOpen(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              itemCount={draft?.items.length ?? 0}
              subtotal={subtotal}
              taxAmount={taxAmount}
              discountAmount={draft?.discountAmount || 0}
              onDiscountChange={handleDiscountChange}
              total={total}
              currency={draft?.currency || 'USD'}
              // Walk-in invoices and the 'skip' flow record no payment.
              paymentFields={
                paymentFlow !== 'skip' && draft?.partyId ? (
                  <div className="space-y-2">{paymentFields}</div>
                ) : undefined
              }
              validationMessage={
                validationMessage ?? (!isValid ? t('validation.itemsOnly') : null)
              }
              onFinalize={() => void handleFinalize()}
              onSaveDraft={() => void handleSaveDraft()}
              pending={createInvoice.isPending || finalizeInvoice.isPending}
            />
          )}
        </>
      ) : (
        <>
          {/* Items Table */}
          <Card>
            <CardContent className="space-y-4 pt-4">
              {/* Persistent scan/search bar — always visible above the table */}
              {!readOnly && (
                <ItemQuickAdd
                  onSelect={handleSelectItem}
                  priceTier={type === 'sale' ? 'retail' : 'cost'}
                  inputRef={quickAddInputRef}
                />
              )}
              <InvoiceItemsTable
                items={draft?.items || []}
                onItemsChange={(items) => {
                  if (currentDraftId) {
                    updateDraft(currentDraftId, { items });
                  }
                }}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onReorder={handleReorderItems}
                onItemUpdate={handleItemUpdate}
                stockAvailability={stockData?.data}
                highlightLocalId={flashLocalId}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>

          {/* Notes & Discount */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t('notes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={draft?.notes || ''}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder={t('notesPlaceholder')}
                  rows={3}
                  disabled={readOnly}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t('summary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('tax')}</span>
                  <span>{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('discount')}</span>
                  <Input
                    type="number"
                    value={draft?.discountAmount || 0}
                    onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-end"
                    min={0}
                    step={0.01}
                    disabled={readOnly}
                    aria-label={t('discountAriaLabel')}
                  />
                </div>
                <div className="flex justify-between text-lg font-semibold pt-3 border-t">
                  <span>{t('total')}</span>
                  <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="sticky bottom-0 z-10 bg-background border-t -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 py-3 flex items-center gap-3 justify-between">
              {/* Running total — always visible, opposite the action buttons */}
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">{t('total')}</span>
                <span className="text-lg font-semibold">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {draft?.lastSavedAt && !existingInvoice && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    {t('draftSavedAt', { time: new Date(draft.lastSavedAt).toLocaleTimeString() })}
                  </span>
                )}
                {!existingInvoice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearClick}
                    disabled={
                      !currentDraftId ||
                      ((draft?.items.length ?? 0) === 0 &&
                        !draft?.notes &&
                        !draft?.discountAmount)
                    }
                    className="text-muted-foreground"
                  >
                    <Eraser className="h-4 w-4 me-2" />
                    {t('clearDraft')}
                  </Button>
                )}
                <Button
                  variant={existingInvoice ? 'default' : 'outline'}
                  onClick={() => handleSaveDraft()}
                  disabled={!isValid || createInvoice.isPending || updateInvoiceMutation.isPending}
                  title={existingInvoice ? 'Ctrl+S' : undefined}
                >
                  <Save className="h-4 w-4 me-2" />
                  {existingInvoice ? t('saveChanges') : t('saveDraft')}
                </Button>
                {!existingInvoice && (
                  <Button
                    onClick={handleFinalize}
                    disabled={!isValid || createInvoice.isPending || finalizeInvoice.isPending}
                    title="Ctrl+S"
                  >
                    <Send className="h-4 w-4 me-2" />
                    {t('finalize')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {paymentWorkflowDialogs}

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('clearConfirm.body', { count: draft?.items.length ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('clearConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={clearDraftBody}>
              {t('clearConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default InvoiceForm;
