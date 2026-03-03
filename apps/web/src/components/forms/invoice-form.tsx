'use client';

/**
 * Invoice Form Component
 *
 * Full invoice form with autosave support using the draft store.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, FileText, AlertCircle, Check } from 'lucide-react';
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useDraftStore, getDraftSubtotal, getDraftTaxAmount, getDraftTotal, isDraftValid } from '@/stores/draft-store';
import { InvoiceItemsTable } from '@/components/tables/invoice-items-table';
import { PartySelect } from '@/components/forms/party-select';
import {
  useCreateInvoice,
  useUpdateInvoice,
  useFinalizeInvoice,
  useStockAvailability,
} from '@/hooks/use-invoices';
import type { DraftInvoice, DraftInvoiceItem, InvoiceType, InvoiceWithRelations } from '@erp/shared';

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
  /** Available items for selection */
  items: Array<{
    id: string;
    name: string;
    sku: string | null;
    unitPrice: number;
    taxRate: number;
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
  items,
  defaultWarehouseId,
  onSaved,
  readOnly = false,
}: InvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();

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
  } = useDraftStore();

  // Current draft
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const draft = currentDraftId ? getDraft(currentDraftId) : undefined;

  // Item selection dialog state
  const [showItemSelect, setShowItemSelect] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

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

  // Initialize draft
  useEffect(() => {
    if (!currentDraftId && !existingInvoice) {
      const newDraftId = createDraft(type, defaultWarehouseId);
      setCurrentDraftId(newDraftId);
    }
  }, [currentDraftId, existingInvoice, type, defaultWarehouseId, createDraft]);

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

  const handleAddItem = useCallback(() => {
    setShowItemSelect(true);
  }, []);

  const handleSelectItem = useCallback(
    (selectedItem: typeof items[0]) => {
      if (!currentDraftId) return;
      addItem(currentDraftId, {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        itemSku: selectedItem.sku,
        description: '',
        quantity: 1,
        unitPrice: selectedItem.unitPrice,
        discountPercent: 0,
        taxRate: selectedItem.taxRate,
      });
      setShowItemSelect(false);
      setItemSearchQuery('');
    },
    [currentDraftId, addItem]
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

  // Save as draft (create invoice in database)
  const handleSaveDraft = useCallback(async () => {
    if (!draft || !draft.warehouseId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a warehouse',
      });
      return;
    }

    if (draft.items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please add at least one item',
      });
      return;
    }

    try {
      const result = await createInvoice.mutateAsync({
        type: draft.type,
        partyId: draft.partyId,
        warehouseId: draft.warehouseId,
        currency: draft.currency,
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

      // Clean up local draft
      if (currentDraftId) {
        deleteDraft(currentDraftId);
      }

      toast({
        title: 'Draft Saved',
        description: `Invoice ${result.data.invoiceNumber} saved as draft`,
      });

      onSaved?.(result.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save draft',
      });
    }
  }, [draft, currentDraftId, createInvoice, deleteDraft, toast, onSaved]);

  // Finalize invoice
  const handleFinalize = useCallback(async () => {
    if (!draft || !draft.warehouseId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a warehouse',
      });
      return;
    }

    if (draft.items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please add at least one item',
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
        title: 'Invoice Finalized',
        description: `Invoice ${finalizeResult.data.invoiceNumber} has been finalized`,
      });

      onSaved?.(finalizeResult.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to finalize invoice',
      });
    }
  }, [draft, currentDraftId, createInvoice, finalizeInvoice, deleteDraft, toast, onSaved]);

  // Filtered items for selection
  const filteredItems = useMemo(() => {
    if (!itemSearchQuery) return items;
    const search = itemSearchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search)
    );
  }, [items, itemSearchQuery]);

  // Calculate totals
  const subtotal = draft ? getDraftSubtotal(draft) : 0;
  const taxAmount = draft ? getDraftTaxAmount(draft) : 0;
  const total = draft ? getDraftTotal(draft) : 0;
  const isValid = draft ? isDraftValid(draft) : false;

  // Filter parties by type
  const filteredParties = parties.filter(
    (p) => p.type === (type === 'sale' ? 'customer' : 'supplier')
  );

  if (!draft && !existingInvoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {type === 'sale' ? 'Customer' : 'Supplier'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PartySelect
              value={draft?.partyId || null}
              onChange={handlePartyChange}
              parties={filteredParties}
              partyType={type === 'sale' ? 'customer' : 'supplier'}
              placeholder={`Select ${type === 'sale' ? 'customer' : 'supplier'}...`}
              disabled={readOnly}
            />
          </CardContent>
        </Card>

        {/* Warehouse Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={draft?.warehouseId || ''}
              onValueChange={handleWarehouseChange}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Currency & Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Currency</Label>
                <p className="font-medium">{draft?.currency || 'USD'}</p>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <p className="font-medium">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      {/* Validation guidance — visible before items are added */}
      {!isValid && !readOnly && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!draft?.warehouseId && (draft?.items?.length || 0) === 0
              ? 'Select a warehouse and add at least one item to create this invoice.'
              : !draft?.warehouseId
                ? 'Please select a warehouse to continue.'
                : 'Add at least one item to continue.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Add items to your {type === 'sale' ? 'sales' : 'purchase'} invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            readOnly={readOnly}
          />
        </CardContent>
      </Card>

      {/* Item Selection Dialog */}
      {showItemSelect && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Add Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search items by name or SKU..."
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="max-h-48 overflow-auto border rounded-md">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No items found
                </div>
              ) : (
                filteredItems.slice(0, 20).map((item) => (
                  <button
                    key={item.id}
                    className="w-full px-3 py-2 text-left hover:bg-muted/50 flex justify-between items-center border-b last:border-b-0"
                    onClick={() => handleSelectItem(item)}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.sku && (
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      )}
                    </div>
                    <span className="text-sm">
                      {item.unitPrice.toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowItemSelect(false);
                setItemSearchQuery('');
              }}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notes & Discount */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={draft?.notes || ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              disabled={readOnly}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span>{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Discount:</span>
              <Input
                type="number"
                value={draft?.discountAmount || 0}
                onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                className="w-24 h-8 text-right"
                min={0}
                step={0.01}
                disabled={readOnly}
              />
            </div>
            <div className="flex justify-between text-lg font-semibold pt-3 border-t">
              <span>Total:</span>
              <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center gap-3 justify-end">
          {draft?.lastSavedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              Draft saved locally {new Date(draft.lastSavedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!isValid || createInvoice.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save as Draft
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={!isValid || createInvoice.isPending || finalizeInvoice.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            Finalize
          </Button>
        </div>
      )}

    </div>
  );
}

export default InvoiceForm;
