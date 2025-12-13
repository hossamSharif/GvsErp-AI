/**
 * Draft Invoice Store
 *
 * Zustand store with persistence for autosaving invoice drafts to localStorage.
 * Supports multiple concurrent drafts with automatic cleanup.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DraftInvoice, DraftInvoiceItem, InvoiceType } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

interface DraftStoreState {
  /** All stored drafts */
  drafts: Record<string, DraftInvoice>;
  /** Current active draft ID */
  activeDraftId: string | null;
}

interface DraftStoreActions {
  /** Create a new draft */
  createDraft: (type: InvoiceType, warehouseId?: string) => string;
  /** Get a draft by ID */
  getDraft: (draftId: string) => DraftInvoice | undefined;
  /** Get the active draft */
  getActiveDraft: () => DraftInvoice | undefined;
  /** Set active draft */
  setActiveDraft: (draftId: string | null) => void;
  /** Update draft fields */
  updateDraft: (draftId: string, updates: Partial<DraftInvoice>) => void;
  /** Add item to draft */
  addItem: (draftId: string, item: Omit<DraftInvoiceItem, 'localId' | 'sortOrder' | 'lineTotal'>) => void;
  /** Update item in draft */
  updateItem: (draftId: string, localId: string, updates: Partial<DraftInvoiceItem>) => void;
  /** Remove item from draft */
  removeItem: (draftId: string, localId: string) => void;
  /** Reorder items in draft */
  reorderItems: (draftId: string, fromIndex: number, toIndex: number) => void;
  /** Delete a draft */
  deleteDraft: (draftId: string) => void;
  /** Clear all drafts */
  clearAllDrafts: () => void;
  /** List all drafts of a type */
  listDrafts: (type?: InvoiceType) => DraftInvoice[];
  /** Auto-cleanup old drafts (older than 7 days) */
  cleanupOldDrafts: () => void;
}

type DraftStore = DraftStoreState & DraftStoreActions;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate line total for an item
 */
function calculateLineTotal(item: Pick<DraftInvoiceItem, 'quantity' | 'unitPrice' | 'discountPercent' | 'taxRate'>): number {
  return Math.round(
    item.quantity * item.unitPrice * (1 - item.discountPercent / 100) * (1 + item.taxRate / 100) * 100
  ) / 100;
}

/**
 * Create empty draft
 */
function createEmptyDraft(type: InvoiceType, warehouseId?: string): DraftInvoice {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    type,
    partyId: null,
    warehouseId: warehouseId || null,
    currency: 'USD',
    exchangeRate: 1,
    discountAmount: 0,
    notes: '',
    items: [],
    lastSavedAt: now,
    createdAt: now,
  };
}

// =============================================================================
// STORE
// =============================================================================

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      // State
      drafts: {},
      activeDraftId: null,

      // Actions
      createDraft: (type, warehouseId) => {
        const draft = createEmptyDraft(type, warehouseId);
        set((state) => ({
          drafts: {
            ...state.drafts,
            [draft.id]: draft,
          },
          activeDraftId: draft.id,
        }));
        return draft.id;
      },

      getDraft: (draftId) => {
        return get().drafts[draftId];
      },

      getActiveDraft: () => {
        const { activeDraftId, drafts } = get();
        return activeDraftId ? drafts[activeDraftId] : undefined;
      },

      setActiveDraft: (draftId) => {
        set({ activeDraftId: draftId });
      },

      updateDraft: (draftId, updates) => {
        set((state) => {
          const draft = state.drafts[draftId];
          if (!draft) return state;

          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                ...updates,
                lastSavedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      addItem: (draftId, item) => {
        set((state) => {
          const draft = state.drafts[draftId];
          if (!draft) return state;

          const newItem: DraftInvoiceItem = {
            ...item,
            localId: uuidv4(),
            sortOrder: draft.items.length,
            lineTotal: calculateLineTotal(item),
          };

          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                items: [...draft.items, newItem],
                lastSavedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      updateItem: (draftId, localId, updates) => {
        set((state) => {
          const draft = state.drafts[draftId];
          if (!draft) return state;

          const items = draft.items.map((item) => {
            if (item.localId !== localId) return item;

            const updated = { ...item, ...updates };
            // Recalculate line total if relevant fields changed
            if (
              'quantity' in updates ||
              'unitPrice' in updates ||
              'discountPercent' in updates ||
              'taxRate' in updates
            ) {
              updated.lineTotal = calculateLineTotal(updated);
            }
            return updated;
          });

          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                items,
                lastSavedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      removeItem: (draftId, localId) => {
        set((state) => {
          const draft = state.drafts[draftId];
          if (!draft) return state;

          const items = draft.items
            .filter((item) => item.localId !== localId)
            .map((item, index) => ({ ...item, sortOrder: index }));

          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                items,
                lastSavedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      reorderItems: (draftId, fromIndex, toIndex) => {
        set((state) => {
          const draft = state.drafts[draftId];
          if (!draft) return state;

          const items = [...draft.items];
          const [removed] = items.splice(fromIndex, 1);
          items.splice(toIndex, 0, removed);

          // Update sort orders
          const reorderedItems = items.map((item, index) => ({
            ...item,
            sortOrder: index,
          }));

          return {
            drafts: {
              ...state.drafts,
              [draftId]: {
                ...draft,
                items: reorderedItems,
                lastSavedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      deleteDraft: (draftId) => {
        set((state) => {
          const { [draftId]: _, ...remainingDrafts } = state.drafts;
          return {
            drafts: remainingDrafts,
            activeDraftId: state.activeDraftId === draftId ? null : state.activeDraftId,
          };
        });
      },

      clearAllDrafts: () => {
        set({ drafts: {}, activeDraftId: null });
      },

      listDrafts: (type) => {
        const { drafts } = get();
        const allDrafts = Object.values(drafts);
        if (type) {
          return allDrafts.filter((d) => d.type === type);
        }
        return allDrafts;
      },

      cleanupOldDrafts: () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        set((state) => {
          const freshDrafts: Record<string, DraftInvoice> = {};
          let removedActive = false;

          for (const [id, draft] of Object.entries(state.drafts)) {
            const lastSavedTime = new Date(draft.lastSavedAt).getTime();
            if (lastSavedTime >= sevenDaysAgo) {
              freshDrafts[id] = draft;
            } else if (id === state.activeDraftId) {
              removedActive = true;
            }
          }

          return {
            drafts: freshDrafts,
            activeDraftId: removedActive ? null : state.activeDraftId,
          };
        });
      },
    }),
    {
      name: 'erp-invoice-drafts',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        drafts: state.drafts,
        activeDraftId: state.activeDraftId,
      }),
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get draft subtotal
 */
export function getDraftSubtotal(draft: DraftInvoice): number {
  return draft.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discountPercent / 100),
    0
  );
}

/**
 * Get draft tax amount
 */
export function getDraftTaxAmount(draft: DraftInvoice): number {
  return draft.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (1 - item.discountPercent / 100) * (item.taxRate / 100),
    0
  );
}

/**
 * Get draft total
 */
export function getDraftTotal(draft: DraftInvoice): number {
  const subtotal = getDraftSubtotal(draft);
  const tax = getDraftTaxAmount(draft);
  return Math.round((subtotal + tax - draft.discountAmount) * 100) / 100;
}

/**
 * Check if draft is valid for submission
 */
export function isDraftValid(draft: DraftInvoice): boolean {
  return (
    draft.warehouseId !== null &&
    draft.items.length > 0 &&
    draft.items.every((item) => item.quantity > 0 && item.unitPrice >= 0)
  );
}
