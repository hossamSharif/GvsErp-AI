'use client';

/**
 * Mobile Item Picker
 *
 * Full-screen sheet for adding invoice lines on a phone. The user searches,
 * then taps "+" on as many results as they like; a result already on the
 * invoice turns into a − qty + stepper bound to that line. "Done" closes the
 * sheet. Adds go through the form's `onSelect` (same path as the desktop
 * quick-add bar), so duplicates merge and everything works offline.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Minus, Plus, ScanLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useItems } from '@/hooks/use-items';
import { useDebounce } from '@/hooks/use-debounce';
import { useOnline } from '@/hooks/use-online';
import { ItemQuickModal } from '@/components/forms/item-quick-modal';
import { toQuickAddItem, type QuickAddItem } from '@/components/forms/item-quick-add';
import { api } from '@/lib/api-client';
import type { DraftInvoiceItem, ItemWithCategory, ItemWithRelations, PriceTier } from '@erp/shared';

interface MobileItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceTier: PriceTier;
  /** Current invoice lines — used to show steppers for items already added. */
  lines: DraftInvoiceItem[];
  onSelect: (item: QuickAddItem, opts?: { quantity?: number; unitPrice?: number }) => void;
  onQuantityChange: (localId: string, quantity: number) => void;
  onRemove: (localId: string) => void;
  total: number;
}

export function MobileItemPicker({
  open,
  onOpenChange,
  priceTier,
  lines,
  onSelect,
  onQuantityChange,
  onRemove,
  total,
}: MobileItemPickerProps) {
  const t = useTranslations('sales.form');
  const tItems = useTranslations('sales.items');
  const tCommon = useTranslations('common');
  const online = useOnline();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Same server search as the desktop quick-add bar (served from IndexedDB offline).
  const debouncedQuery = useDebounce(query, 250);
  const { data, isLoading, isFetching } = useItems({
    isActive: true,
    search: debouncedQuery || undefined,
    limit: 50,
  });
  const results = useMemo(
    () => (data?.data ?? []).map((i) => toQuickAddItem(i, priceTier)),
    [data, priceTier]
  );

  const lineByItemId = useMemo(() => {
    const map = new Map<string, DraftInvoiceItem>();
    for (const line of lines) map.set(line.itemId, line);
    return map;
  }, [lines]);

  // Fresh search each time the sheet opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setNotFoundCode(null);
    }
  }, [open]);

  // Enter (typed or sent by a barcode scanner) adds an exact barcode/SKU match.
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
        const exact =
          candidates.find((i) => i.barcode === code || i.sku === code) ??
          (candidates.length === 1 ? candidates[0] : undefined);
        if (exact) {
          onSelect(toQuickAddItem(exact, priceTier));
          setQuery('');
        } else if (candidates.length === 0) {
          setNotFoundCode(code);
        }
      } catch {
        setNotFoundCode(code);
      } finally {
        setIsResolving(false);
      }
    },
    [onSelect, priceTier]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const code = query.trim();
      if (code) void resolveExact(code);
    },
    [query, resolveExact]
  );

  const handleQuickCreated = useCallback(
    (saved: ItemWithRelations) => {
      onSelect(toQuickAddItem(saved, priceTier));
      setQuickCreateOpen(false);
    },
    [onSelect, priceTier]
  );

  const lineCount = lines.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="full"
        hideClose
        onOpenAutoFocus={(e) => {
          // Focus the search field instead of the first button.
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="gap-0"
      >
        <SheetTitle className="sr-only">{tItems('addItem')}</SheetTitle>
        <SheetDescription className="sr-only">{t('scanOrSearch')}</SheetDescription>

        {/* Search header */}
        <div className="flex items-center gap-2 border-b p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label={tCommon('back')}
          >
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <ScanLine className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              placeholder={t('scanOrSearch')}
              aria-label={t('scanOrSearch')}
              onChange={(e) => {
                setQuery(e.target.value);
                setNotFoundCode(null);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {(isResolving || isFetching) && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            {query && !isResolving && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded p-1 text-muted-foreground"
                aria-label={t('clearSearch')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={!online}
            title={online ? t('quickAddNewItem') : t('quickAddOfflineTitle')}
            aria-label={t('quickAddNewItem')}
            onClick={() => setQuickCreateOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {notFoundCode && (
          <p className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {t('itemNotFound', { code: notFoundCode })}
          </p>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isLoading && results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{tCommon('loading')}</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('noItemsFound')}</p>
          ) : (
            <ul className="divide-y">
              {results.map((item) => {
                const line = lineByItemId.get(item.id);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex min-h-[64px] items-center gap-3 px-4 py-2',
                      line && 'bg-primary/5'
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => onSelect(item)}
                    >
                      <p className="line-clamp-2 font-medium leading-snug">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.sku, item.unitOfMeasure].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </button>
                    {line ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() =>
                            line.quantity <= 1
                              ? onRemove(line.localId)
                              : onQuantityChange(line.localId, line.quantity - 1)
                          }
                          aria-label={tItems('ariaDecrement', { name: item.name })}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center font-semibold tabular-nums">
                          {line.quantity}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => onSelect(item)}
                          aria-label={tItems('ariaIncrement', { name: item.name })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full"
                        onClick={() => onSelect(item)}
                        aria-label={t('add')}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer: running count/total + Done */}
        <div className="flex items-center gap-3 border-t bg-background p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {t('itemsAddedCount', { count: lineCount })}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Button type="button" className="h-12 min-w-[120px]" onClick={() => onOpenChange(false)}>
            {t('done')}
          </Button>
        </div>
      </SheetContent>

      <ItemQuickModal
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        mode="create"
        onSaved={handleQuickCreated}
      />
    </Sheet>
  );
}

export default MobileItemPicker;
