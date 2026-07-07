'use client';

/**
 * Invoice Form Component
 *
 * Full invoice form with autosave support using the draft store.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Save, Send, FileText, Check } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useDraftStore, getDraftSubtotal, getDraftTaxAmount, getDraftTotal, isDraftValid } from '@/stores/draft-store';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { PartySelect } from '@/components/forms/party-select';
import { CurrencySelect } from '@/components/forms/currency-select';
import { ItemQuickAdd, type QuickAddItem } from '@/components/forms/item-quick-add';
import { RecordPaymentDialog } from '@/components/dialogs/record-payment-dialog';
import {
  useCreateInvoice,
  useUpdateInvoice,
  useFinalizeInvoice,
  useStockAvailability,
} from '@/hooks/use-invoices';
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
  defaultWarehouseId,
  onSaved,
  readOnly = false,
}: InvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('sales.form');
  const tCommon = useTranslations('common');

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

  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  // Post-finalize payment workflow: after a final invoice is saved, offer to
  // record the receipt/disbursement immediately. `savedInvoice` holds the
  // finalized invoice while the prompt/modal are open, deferring `onSaved`
  // (the parent's redirect) until the user finishes or skips the payment.
  const [savedInvoice, setSavedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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

    const newDraftId = createDraft(type, defaultWarehouseId);
    // Pre-select the first party of the matching type so a new invoice opens
    // with a customer/supplier already chosen (common single-customer flows).
    const defaultParty = parties.find(
      (p) => p.type === (type === 'sale' ? 'customer' : 'supplier')
    );
    if (defaultParty) {
      updateDraft(newDraftId, { partyId: defaultParty.id });
    }
    setCurrentDraftId(newDraftId);
  }, [currentDraftId, existingInvoice, type, defaultWarehouseId, createDraft, listDrafts, deleteDraft, parties, updateDraft]);

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

      // Offer to record a payment against a party invoice. Walk-in invoices
      // (no party) skip straight to the parent's redirect.
      if (finalizeResult.data.partyId) {
        setSavedInvoice(finalizeResult.data);
        setShowPaymentModal(true);
      } else {
        onSaved?.(finalizeResult.data);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error instanceof Error ? error.message : t('toasts.finalizeFailed'),
      });
    }
  }, [draft, currentDraftId, createInvoice, finalizeInvoice, deleteDraft, toast, onSaved, t, tCommon]);

  // Calculate totals
  const subtotal = draft ? getDraftSubtotal(draft) : 0;
  const taxAmount = draft ? getDraftTaxAmount(draft) : 0;
  const total = draft ? getDraftTotal(draft) : 0;
  const isValid = draft ? isDraftValid(draft) : false;

  // Filter parties by type
  const filteredParties = parties.filter(
    (p) => p.type === (type === 'sale' ? 'customer' : 'supplier')
  );

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
      {/* Header toolbar — party · warehouse · currency · date, kept compact so
          the items area stays near the top of the page. */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px] flex-1">
            <PartySelect
              value={draft?.partyId || null}
              onChange={handlePartyChange}
              parties={filteredParties}
              partyType={type === 'sale' ? 'customer' : 'supplier'}
              placeholder={type === 'sale' ? t('selectCustomer') : t('selectSupplier')}
              disabled={readOnly}
            />
          </div>
          <div className="min-w-[160px] flex-1">
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
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t('items')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        <div className="flex items-center gap-3 justify-end">
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
          >
            <Save className="h-4 w-4 mr-2" />
            {existingInvoice ? t('saveChanges') : t('saveDraft')}
          </Button>
          {!existingInvoice && (
            <Button
              onClick={() => setShowFinalizeConfirm(true)}
              disabled={!isValid || createInvoice.isPending || finalizeInvoice.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {t('finalize')}
            </Button>
          )}
        </div>
      )}

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('finalizeConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('finalizeConfirm.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('finalizeConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowFinalizeConfirm(false);
                handleFinalize();
              }}
            >
              {t('finalizeConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {paymentWorkflowDialogs}

    </div>
  );
}

export default InvoiceForm;
