'use client';

/**
 * Item Quick-Add Bar
 *
 * A persistent "scan or search" control that lives directly above the invoice
 * items table. It supports two distinct flows:
 *
 *  1. Barcode scan (instant) — a scanner types a code in a machine-speed burst
 *     (or one paste-like jump). We detect that timing signature and auto-add an
 *     exact barcode/SKU match with quantity 1, no Enter required.
 *
 *  2. Manual add (deliberate) — the user types, then picks an item from the
 *     dropdown. The dropdown closes and the item is "staged": focus jumps to the
 *     Quantity field, Tab moves to Price, and Enter (from either) commits the
 *     line with the chosen quantity/price. This avoids the old glitch where the
 *     dropdown reopened after a click.
 *
 * Parent owns the actual add/increment (see `onSelect`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ScanLine, Check, Loader2, AlertCircle, Plus, Pencil, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useItems, useItem } from '@/hooks/use-items';
import { useDebounce } from '@/hooks/use-debounce';
import { useOnline } from '@/hooks/use-online';
import { ItemQuickModal } from '@/components/forms/item-quick-modal';
import { api } from '@/lib/api-client';
import type { ItemWithCategory, ItemWithRelations, PriceTier } from '@erp/shared';

// =============================================================================
// TYPES
// =============================================================================

/** Shape handed to the parent when an item is chosen. */
export interface QuickAddItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitOfMeasure: string;
  unitPrice: number;
  taxRate: number;
}

interface ItemQuickAddProps {
  /**
   * Called when an item is scanned/selected. `opts` carries a manual
   * quantity/price; scans omit it so the parent defaults to quantity 1.
   */
  onSelect: (item: QuickAddItem, opts?: { quantity?: number; unitPrice?: number }) => void;
  /** Price tier to default the unit price from — 'retail' for sales, 'cost' for purchases. */
  priceTier: PriceTier;
  /** Optional external ref so callers can focus the input (e.g. empty state). */
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function toQuickAddItem(i: ItemWithCategory, priceTier: PriceTier): QuickAddItem {
  const prices = i.prices ?? [];
  // Sales default to the first retail price, purchases to the first cost price;
  // fall back to whatever price exists so an item is never priced at 0 by accident.
  const tierPrice = prices.find((p) => p.priceTier === priceTier)?.price;
  return {
    id: i.id,
    name: i.name,
    sku: i.sku,
    barcode: i.barcode,
    unitOfMeasure: i.unitOfMeasure,
    unitPrice: tierPrice ?? prices[0]?.price ?? 0,
    taxRate: i.taxRate,
  };
}

// --- Barcode-scanner auto-detection tuning -----------------------------------
// Scanners emit characters in a tight machine-speed burst (or one paste-like
// jump), then go quiet. We use that signature to auto-add without an Enter key.
const SCAN_CHAR_GAP_MS = 40; // keystrokes faster than this look machine-generated
const SCAN_MIN_BURST = 3; // consecutive fast chars before we call it a scan
const SCAN_SETTLE_MS = 110; // quiet period after the burst before auto-adding
const SCAN_MIN_LEN = 3; // ignore very short bursts

// =============================================================================
// COMPONENT
// =============================================================================

export function ItemQuickAdd({ onSelect, priceTier, inputRef: externalRef, disabled }: ItemQuickAddProps) {
  const t = useTranslations('sales.form');
  const tCommon = useTranslations('common');
  const online = useOnline();

  // Quick add/edit item modal state — lets the user create or fix an item
  // without leaving the invoice. Editing fetches the full item on demand so
  // the modal has prices/etc. even though the search result is a lighter shape.
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const { data: editItemData } = useItem(editItemId ?? undefined);

  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Scanner auto-detect bookkeeping (see SCAN_* constants above).
  const queryRef = useRef('');
  const lastChangeRef = useRef(0);
  const prevLenRef = useRef(0);
  const fastCountRef = useRef(0);
  const pasteRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanTimer = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const resetScanState = useCallback(() => {
    clearScanTimer();
    queryRef.current = '';
    prevLenRef.current = 0;
    fastCountRef.current = 0;
    pasteRef.current = false;
  }, [clearScanTimer]);

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isResolving, setIsResolving] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);

  // Manual-add staging: an item awaiting a quantity/price before it is committed.
  const [stagedItem, setStagedItem] = useState<QuickAddItem | null>(null);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');

  // Server-side search.
  const debouncedQuery = useDebounce(query, 250);
  const { data, isLoading, isFetching, refetch } = useItems({
    isActive: true,
    search: debouncedQuery || undefined,
    limit: 50,
  });

  const results = useMemo(
    () => (data?.data ?? []).map((i) => toQuickAddItem(i, priceTier)),
    [data, priceTier]
  );

  // Reset the manual highlight whenever the result set changes.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [debouncedQuery]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    if (highlightedIndex >= 0) {
      rowRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Cancel any pending scan timer if the component unmounts mid-burst.
  useEffect(() => () => clearScanTimer(), [clearScanTimer]);

  /** Commit an add and reset the bar back to a fresh "ready to scan" state. */
  const finishAdd = useCallback(
    (item: QuickAddItem, opts?: { quantity?: number; unitPrice?: number }) => {
      onSelect(item, opts);
      resetScanState();
      setStagedItem(null);
      setQuery('');
      setQty('1');
      setPrice('');
      setHighlightedIndex(-1);
      setNotFoundCode(null);
      setLastAdded(item.name);
      setAddedCount((c) => c + 1);
      // Refocus the search for the next scan once the DOM settles.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onSelect, resetScanState, inputRef]
  );

  /** Stage a manually-picked item: close dropdown, fill qty/price, focus qty. */
  const stageItem = useCallback(
    (item: QuickAddItem) => {
      clearScanTimer();
      setStagedItem(item);
      setQuery(item.name);
      setQty('1');
      setPrice(item.unitPrice ? String(item.unitPrice) : '0');
      setHighlightedIndex(-1);
      setNotFoundCode(null);
      requestAnimationFrame(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      });
    },
    [clearScanTimer]
  );

  /** After a quick create/edit save, stage the item immediately — no extra click. */
  const handleQuickModalSaved = useCallback(
    (saved: ItemWithRelations) => {
      stageItem(toQuickAddItem(saved, priceTier));
      setQuickCreateOpen(false);
      setEditItemId(null);
    },
    [stageItem, priceTier]
  );

  const commitStaged = useCallback(() => {
    if (!stagedItem) return;
    const quantity = Math.max(0.001, parseFloat(qty) || 1);
    const unitPrice = Math.max(0, parseFloat(price) || 0);
    finishAdd(stagedItem, { quantity, unitPrice });
  }, [stagedItem, qty, price, finishAdd]);

  const cancelStaged = useCallback(() => {
    setStagedItem(null);
    setQuery('');
    setQty('1');
    setPrice('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [inputRef]);

  /**
   * Resolve a code via a fresh lookup that bypasses the debounce.
   *  - exactOnly (scanner path): add only on a confident barcode/SKU match;
   *    on a miss stay silent and let the normal search list show fuzzy results.
   *  - lenient (Enter path): fall back to the first match and flash "not found".
   * Both paths add instantly (quantity 1) — staging is only for dropdown picks.
   */
  const resolveExact = useCallback(
    async (code: string, opts?: { exactOnly?: boolean }) => {
      const exactOnly = opts?.exactOnly ?? false;
      setIsResolving(true);
      if (!exactOnly) setNotFoundCode(null);
      try {
        const resp = await api.get<{ data: ItemWithCategory[] }>('/items', {
          isActive: true,
          search: code,
          limit: 10,
        });
        const candidates = resp.data ?? [];
        const exact = candidates.find((i) => i.barcode === code || i.sku === code);
        const chosen = exact ?? (exactOnly ? undefined : candidates[0]);
        if (chosen) {
          finishAdd(toQuickAddItem(chosen, priceTier));
        } else if (!exactOnly) {
          setNotFoundCode(code);
          inputRef.current?.focus();
        }
      } catch {
        if (!exactOnly) setNotFoundCode(code);
      } finally {
        setIsResolving(false);
      }
    },
    [finishAdd, inputRef, priceTier]
  );

  const handleEnter = useCallback(() => {
    clearScanTimer();
    if (stagedItem) {
      commitStaged();
      return;
    }
    if (highlightedIndex >= 0 && results[highlightedIndex]) {
      stageItem(results[highlightedIndex]);
      return;
    }
    const code = query.trim();
    if (!code) return;
    void resolveExact(code);
  }, [clearScanTimer, stagedItem, commitStaged, highlightedIndex, results, query, stageItem, resolveExact]);

  /**
   * Search-field change handler with scanner auto-detect: when characters arrive
   * in a machine-speed burst (or one paste-like jump) and the input then settles,
   * we auto-resolve an exact barcode/SKU match and add it — no Enter needed.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Typing over a staged selection cancels staging and searches anew.
      if (stagedItem) setStagedItem(null);

      const now = Date.now();
      const val = e.target.value;
      const delta = now - lastChangeRef.current;
      const grew = val.length - prevLenRef.current;
      lastChangeRef.current = now;
      prevLenRef.current = val.length;
      queryRef.current = val;
      setQuery(val);
      setNotFoundCode(null);

      if (grew >= 4) {
        pasteRef.current = true; // HID/keyboard-wedge scanner dumps the code at once
      } else if (grew === 1 && delta < SCAN_CHAR_GAP_MS) {
        fastCountRef.current += 1;
      } else if (grew === 1) {
        fastCountRef.current = 0; // a human-paced keystroke breaks the burst
      }

      clearScanTimer();
      scanTimerRef.current = setTimeout(() => {
        const isScan = pasteRef.current || fastCountRef.current >= SCAN_MIN_BURST;
        pasteRef.current = false;
        fastCountRef.current = 0;
        const code = queryRef.current.trim();
        if (isScan && code.length >= SCAN_MIN_LEN) {
          void resolveExact(code, { exactOnly: true });
        }
      }, SCAN_SETTLE_MS);
    },
    [stagedItem, clearScanTimer, resolveExact]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          handleEnter();
          break;
        case 'Escape':
          resetScanState();
          setQuery('');
          setHighlightedIndex(-1);
          setNotFoundCode(null);
          break;
      }
    },
    [results.length, handleEnter, resetScanState]
  );

  // Enter on Qty/Price commits the staged line; Escape cancels staging.
  const handleFieldKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitStaged();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelStaged();
      }
    },
    [commitStaged, cancelStaged]
  );

  const fieldsDisabled = disabled || !stagedItem;
  const showDropdown =
    isFocused && !stagedItem && !disabled && query.trim().length > 0;

  return (
    <div>
      <div className="flex items-stretch gap-2">
        {/* Search + dropdown */}
        <div className="relative flex-1">
          <div
            className={cn(
              'flex h-11 items-center gap-2 rounded-md border bg-background px-3 transition-colors',
              isFocused ? 'border-primary ring-1 ring-primary' : 'border-input',
              disabled && 'opacity-50'
            )}
          >
            <ScanLine className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              enterKeyHint="enter"
              disabled={disabled}
              value={query}
              placeholder={t('scanOrSearch')}
              aria-label={t('scanOrSearch')}
              onChange={handleChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setIsFocused(true)}
              // Delay blur so a result click registers before the dropdown closes.
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            {isResolving && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <button
              type="button"
              aria-label={tCommon('refresh')}
              title={tCommon('refresh')}
              disabled={disabled || isFetching}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void refetch()}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </button>
          </div>

          {showDropdown && (
            <div
              className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
              role="listbox"
            >
              {isLoading && results.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {tCommon('loading')}
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t('noItemsFound')}
                </div>
              ) : (
                results.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={index === highlightedIndex}
                    // Use onMouseDown so selection fires before the input blur.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      stageItem(item);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-start last:border-b-0',
                      index === highlightedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.sku, item.barcode].filter(Boolean).join(' · ') ||
                          item.unitOfMeasure}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-medium">{item.unitPrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{item.unitOfMeasure}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <Input
          ref={qtyRef}
          type="number"
          inputMode="decimal"
          value={qty}
          disabled={fieldsDisabled}
          min={0.001}
          step={0.001}
          placeholder={t('quantity')}
          aria-label={t('quantity')}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={handleFieldKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-20 text-center"
        />

        {/* Price */}
        <Input
          ref={priceRef}
          type="number"
          inputMode="decimal"
          value={price}
          disabled={fieldsDisabled}
          min={0}
          step={0.01}
          placeholder={t('price')}
          aria-label={t('price')}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={handleFieldKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-28 text-end"
        />

        {/* Add */}
        <Button
          type="button"
          onClick={commitStaged}
          disabled={fieldsDisabled}
          className="h-11 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="ms-1 hidden sm:inline">{t('add')}</span>
        </Button>

        {/* Quick create a new item without leaving the invoice */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          disabled={disabled || !online}
          title={online ? t('quickAddNewItem') : t('quickAddOfflineTitle')}
          aria-label={t('quickAddNewItem')}
          onClick={() => setQuickCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Status line: staging / confirmation / not-found / hint */}
      <div className="mt-1 min-h-[1.25rem] px-1 text-xs">
        {stagedItem ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {t('stagedHint', { name: stagedItem.name })}
            <button
              type="button"
              className="text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              disabled={!online}
              title={online ? t('editStagedItem', { name: stagedItem.name }) : t('quickAddOfflineTitle')}
              onClick={() => setEditItemId(stagedItem.id)}
            >
              <Pencil className="inline h-3 w-3" />
            </button>
          </span>
        ) : notFoundCode ? (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {t('itemNotFound', { code: notFoundCode })}
          </span>
        ) : lastAdded ? (
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
            <Check className="h-3.5 w-3.5" />
            {t('itemAdded', { name: lastAdded })}
            <span className="text-muted-foreground">
              · {t('itemsAddedCount', { count: addedCount })}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('quickAddHint')}</span>
        )}
      </div>

      <ItemQuickModal
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        mode="create"
        onSaved={handleQuickModalSaved}
      />
      <ItemQuickModal
        open={!!editItemId}
        onOpenChange={(next) => {
          if (!next) setEditItemId(null);
        }}
        mode="edit"
        item={editItemData?.data ?? null}
        onSaved={handleQuickModalSaved}
      />
    </div>
  );
}

export default ItemQuickAdd;
