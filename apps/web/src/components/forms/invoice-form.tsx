'use client';

/**
 * Invoice Form Component
 *
 * Full invoice form with autosave support using the draft store.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Save, Send, FileText, Check, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useDraftStore, getDraftSubtotal, getDraftTaxAmount, getDraftTotal, isDraftValid } from '@/stores/draft-store';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { PartySelect } from '@/components/forms/party-select';
import { CurrencySelect } from '@/components/forms/currency-select';
import { ItemQuickAdd, type QuickAddItem } from '@/components/forms/item-quick-add';
import { RecordPaymentDialog, SENTINEL_CASH } from '@/components/dialogs/record-payment-dialog';
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
import type { DraftInvoiceItem, InvoiceType, InvoiceWithRelations } from '@erp/shared';

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

  // Initialize draft — rehydrate most recent non-empty draft, else create new
  useEffect(() => {
    if (currentDraftId || existingInvoice) return;

    const existingDrafts = listDrafts(type);
    const hasContent = (d: typeof existingDrafts[number]) =>
      d.partyId !== null ||
      d.items.length > 0 ||
      (d.notes ?? '') !== '' ||
      d.discountAmount !== 0;

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
      // Create draft from existing invoice
      const newDraftId = createDraft(type, existingInvoice.warehouseId);
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
  }, [existingInvoice, currentDraftId, type, createDraft, updateDraft]);

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

  // Empty-state button now just focuses the always-visible quick-add bar.
  const handleAddItem = useCallback(() => {
    quickAddInputRef.current?.focus();
  }, []);

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
  const handleSaveDraft = useCallback(async () => {
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

      toast({
        title: t('toasts.draftSaved'),
        description: t('toasts.draftSavedDescription', { number: result.data.invoiceNumber }),
      });

      onSaved?.(result.data);
    } catch (error) {
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

      // Clean up local draft
      if (currentDraftId) {
        deleteDraft(currentDraftId);
      }

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

  return (
    <div className="space-y-6">
      {/* In-form title row (new invoices): title + back on the start, date on
          the end — moved here from the header card so the date sits with the
          page title and the card row has room for the payment fields. */}
      {headerTitle && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {headerBackHref && (
              <Button variant="ghost" size="icon" asChild aria-label={tCommon('back')}>
                <Link href={headerBackHref}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <h1 className="text-2xl font-bold">{headerTitle}</h1>
          </div>
          <div className="w-40">
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
              {filteredParties.find((p) => p.id === draft?.partyId)?.name ||
                (type === 'sale' ? t('selectCustomer') : t('selectSupplier'))}
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
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t">
            {/* Party/warehouse narrowed (from flex-1) so the payment-accelerator
                fields fit on the same row for new invoices. */}
            <div className="w-48">
              <PartySelect
                value={draft?.partyId || null}
                onChange={handlePartyChange}
                parties={filteredParties}
                partyType={type === 'sale' ? 'customer' : 'supplier'}
                placeholder={type === 'sale' ? t('selectCustomer') : t('selectSupplier')}
                disabled={readOnly}
              />
            </div>
            <div className="w-40">
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
            <div className="w-32">
              <CurrencySelect
                value={draft?.currency || 'USD'}
                onValueChange={handleCurrencyChange}
                disabled={readOnly}
              />
            </div>
            {/* Payment accelerators (new invoices only) — prefill the post-finalize
                payment modal so the user can just save it. */}
            {isNew && (
              <>
                <div className="w-44">
                  <Select
                    value={paymentBankAccountId}
                    onValueChange={setPaymentBankAccountId}
                  >
                    <SelectTrigger aria-label={tPay('paymentWay')}>
                      <SelectValue placeholder={tPayForm('bankAccountPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SENTINEL_CASH}>
                        {tPayForm('bankAccountCash')}
                      </SelectItem>
                      {banks
                        .filter((b) => b.is_active)
                        .map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="font-mono text-xs me-2">
                              {b.ledger?.code ?? ''}
                            </span>
                            {b.name}
                            {b.bank_name ? ` · ${b.bank_name}` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-44">
                  <Input
                    aria-label={tPayForm('reference')}
                    placeholder={tPayForm('referencePlaceholder')}
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="h-10"
                  />
                </div>
              </>
            )}
            {/* Date only shown here when there is no in-form title row (edit/view). */}
            {!headerTitle && (
              <div className="w-40">
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
                className="w-24 h-8 text-right"
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
            <Button
              variant={existingInvoice ? 'default' : 'outline'}
              onClick={handleSaveDraft}
              disabled={!isValid || createInvoice.isPending || updateInvoiceMutation.isPending}
              title={existingInvoice ? 'Ctrl+S' : undefined}
            >
              <Save className="h-4 w-4 mr-2" />
              {existingInvoice ? t('saveChanges') : t('saveDraft')}
            </Button>
            {!existingInvoice && (
              <Button
                onClick={handleFinalize}
                disabled={!isValid || createInvoice.isPending || finalizeInvoice.isPending}
                title="Ctrl+S"
              >
                <Send className="h-4 w-4 mr-2" />
                {t('finalize')}
              </Button>
            )}
          </div>
        </div>
      )}

      {paymentWorkflowDialogs}

    </div>
  );
}

export default InvoiceForm;
