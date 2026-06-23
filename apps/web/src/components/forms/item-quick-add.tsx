'use client';

/**
 * Item Quick-Add Bar
 *
 * A persistent "scan or search" control that lives directly above the invoice
 * items table. It is optimized for barcode scanners (which type a code quickly
 * then emit Enter) while remaining fast for manual keyboard/mouse entry.
 *
 * Behavior:
 *  - Typing shows a live, server-filtered result list (debounced) with
 *    ArrowUp/ArrowDown + Enter navigation.
 *  - Pressing Enter with no row highlighted resolves the *current input* exactly
 *    against barcode → SKU → first match via a fresh (non-debounced) lookup, so a
 *    scanner adds the right item even before the debounced list catches up.
 *  - The bar never closes: after each add the input clears, refocuses, and an
 *    ephemeral "Added ✓ {name}" confirmation + running counter is shown.
 *
 * Parent owns the add-vs-increment decision (see `onSelect`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ScanLine, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useItems } from '@/hooks/use-items';
import { useDebounce } from '@/hooks/use-debounce';
import { api } from '@/lib/api-client';
import type { ItemWithCategory } from '@erp/shared';

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
  /** Called when an item is scanned/selected. Parent adds or increments. */
  onSelect: (item: QuickAddItem) => void;
  /** Optional external ref so callers can focus the input (e.g. empty state). */
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function toQuickAddItem(i: ItemWithCategory): QuickAddItem {
  return {
    id: i.id,
    name: i.name,
    sku: i.sku,
    barcode: i.barcode,
    unitOfMeasure: i.unitOfMeasure,
    unitPrice: i.prices?.[0]?.price ?? 0,
    taxRate: i.taxRate,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ItemQuickAdd({ onSelect, inputRef: externalRef, disabled }: ItemQuickAddProps) {
  const t = useTranslations('sales.form');
  const tCommon = useTranslations('common');

  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isResolving, setIsResolving] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);

  // Server-side search — always enabled so an empty query shows a browse list.
  const debouncedQuery = useDebounce(query, 250);
  const { data, isLoading } = useItems({
    isActive: true,
    search: debouncedQuery || undefined,
    limit: 50,
  });

  const results = useMemo(
    () => (data?.data ?? []).map(toQuickAddItem),
    [data]
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

  const handleSelect = useCallback(
    (item: QuickAddItem) => {
      onSelect(item);
      setQuery('');
      setHighlightedIndex(-1);
      setNotFoundCode(null);
      setLastAdded(item.name);
      setAddedCount((c) => c + 1);
      // Refocus for the next scan once the DOM settles.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onSelect, inputRef]
  );

  /**
   * Resolve the raw input exactly (barcode → SKU → first match) via a fresh
   * lookup that bypasses the debounce. This is the reliable scanner path.
   */
  const resolveExact = useCallback(
    async (code: string) => {
      setIsResolving(true);
      setNotFoundCode(null);
      try {
        const resp = await api.get<{ data: ItemWithCategory[] }>('/items', {
          isActive: true,
          search: code,
          limit: 10,
        });
        const candidates = resp.data ?? [];
        const exact = candidates.find((i) => i.barcode === code || i.sku === code);
        const chosen = exact ?? candidates[0];
        if (chosen) {
          handleSelect(toQuickAddItem(chosen));
        } else {
          setNotFoundCode(code);
          inputRef.current?.focus();
        }
      } catch {
        setNotFoundCode(code);
      } finally {
        setIsResolving(false);
      }
    },
    [handleSelect, inputRef]
  );

  const handleEnter = useCallback(() => {
    if (highlightedIndex >= 0 && results[highlightedIndex]) {
      handleSelect(results[highlightedIndex]);
      return;
    }
    const code = query.trim();
    if (!code) return;
    void resolveExact(code);
  }, [highlightedIndex, results, query, handleSelect, resolveExact]);

  const handleKeyDown = useCallback(
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
          setQuery('');
          setHighlightedIndex(-1);
          setNotFoundCode(null);
          break;
      }
    },
    [results.length, handleEnter]
  );

  const showDropdown =
    isFocused && !disabled && (query.length > 0 || results.length > 0 || isLoading);

  return (
    <div className="relative">
      {/* Input row */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-background px-3 transition-colors',
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          // Delay blur so a result click registers before the dropdown closes.
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {isResolving && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Status line: confirmation / not-found / hint */}
      <div className="mt-1 min-h-[1.25rem] px-1 text-xs">
        {notFoundCode ? (
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

      {/* Results dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
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
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-start last:border-b-0',
                  index === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[item.sku, item.barcode].filter(Boolean).join(' · ') || item.unitOfMeasure}
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
  );
}

export default ItemQuickAdd;
