'use client';

/**
 * Items Bulk-Edit Grid
 *
 * A spreadsheet-style screen for correcting a catalogue: item main info,
 * retail/cost prices and warehouse opening stock, all on one row.
 *
 * The interaction model is the point of the page:
 *  - Tab moves across cells, arrows move between rows, Enter saves the row and
 *    drops the caret on the same column one row down.
 *  - Saves are fired without awaiting, so the user never waits on the previous
 *    row. A row locks itself while its request is in flight and then reports
 *    per-section success or failure through its colour and status popover.
 */

import { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ItemGridTable } from '@/components/tables/item-grid/item-grid-table';
import { buildPayload, dirtyColumns } from '@/components/tables/item-grid/row-values';
import {
  COLUMN_SECTION,
  GRID_COLUMNS,
  type FocusTarget,
  type GridColumn,
  type RowDraft,
  type RowStatus,
} from '@/components/tables/item-grid/types';
import { useItemGrid, useSaveItemGridRow, itemGridKeys } from '@/hooks/use-item-grid';
import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useCategories } from '@/hooks/use-categories';
import { useDebounce } from '@/hooks/use-debounce';
import { useOnline } from '@/hooks/use-online';
import type { ItemGridQueryParams, ItemGridRow } from '@erp/shared';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Table2,
} from 'lucide-react';

const PAGE_SIZE = 50;

/** Advanced filters — each one surfaces a different kind of catalogue gap */
const FILTER_KEYS = [
  'missingBarcode',
  'missingRetail',
  'missingCost',
  'zeroOpeningQty',
  'missingOpeningCost',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

/** Filters that only mean something once a warehouse scopes the opening columns */
const WAREHOUSE_FILTERS: FilterKey[] = ['zeroOpeningQty', 'missingOpeningCost'];

export default function ItemsBulkEditPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('itemsGrid');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const isOnline = useOnline();

  // --- Toolbar state --------------------------------------------------------
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [categoryId, setCategoryId] = useState<string>('');
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    missingBarcode: false,
    missingRetail: false,
    missingCost: false,
    zeroOpeningQty: false,
    missingOpeningCost: false,
  });
  const [page, setPage] = useState(1);

  // --- Row state ------------------------------------------------------------
  // Held outside the query cache on purpose: a refetch must never wipe what the
  // user has typed or which rows just succeeded.
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [pendingFocus, setPendingFocus] = useState<FocusTarget | null>(null);

  const { data: warehousesData } = useActiveWarehouses();
  const { data: categoriesData } = useCategories();
  const warehouses = useMemo(() => warehousesData?.data ?? [], [warehousesData]);

  // Default to the first active warehouse so the grid is usable on arrival
  // rather than making the user pick before anything renders.
  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // Reset to page 1 whenever the result set changes shape underneath us.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, filters, warehouseId]);

  const queryParams = useMemo<ItemGridQueryParams>(
    () => ({
      warehouseId: warehouseId || undefined,
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      missingBarcode: filters.missingBarcode || undefined,
      missingRetail: filters.missingRetail || undefined,
      missingCost: filters.missingCost || undefined,
      zeroOpeningQty: filters.zeroOpeningQty || undefined,
      missingOpeningCost: filters.missingOpeningCost || undefined,
      page,
      limit: PAGE_SIZE,
      sortBy: 'name',
      sortDir: 'asc',
    }),
    [warehouseId, debouncedSearch, categoryId, filters, page]
  );

  const queryKey = useMemo(() => itemGridKeys.list(queryParams), [queryParams]);
  const { data, isLoading, isFetching, error } = useItemGrid(queryParams);

  const rows = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 0;

  // Keep a live handle on the current rows so keyboard handlers registered in
  // callbacks always act on what is actually on screen.
  const rowsRef = useRef<ItemGridRow[]>(rows);
  rowsRef.current = rows;

  const saveMutation = useSaveItemGridRow();
  const saveMutationRef = useRef(saveMutation);
  saveMutationRef.current = saveMutation;

  // --- Focus ----------------------------------------------------------------

  const focusCell = useCallback((rowIndex: number, column: GridColumn) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-grid-cell][data-row-index="${rowIndex}"][data-col="${column}"]`
    );
    if (el) {
      el.focus();
      el.select();
      return true;
    }
    return false;
  }, []);

  // Focus is resolved after render, not inside the key handler: the row the
  // caret is leaving may be re-rendering as disabled at that exact moment.
  useLayoutEffect(() => {
    if (!pendingFocus) return;
    if (focusCell(pendingFocus.rowIndex, pendingFocus.column)) {
      setPendingFocus(null);
    }
  }, [pendingFocus, rows, focusCell]);

  // --- Draft + status helpers ----------------------------------------------

  const handleCellChange = useCallback(
    (itemId: string, column: GridColumn, value: string) => {
      setDrafts((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [column]: value },
      }));
      // Typing again clears a stale success/failure marker so the row's colour
      // always describes its current, unsaved content.
      setStatuses((prev) => {
        if (!prev[itemId] || prev[itemId].kind === 'saving') return prev;
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    },
    []
  );

  const revertRow = useCallback((itemId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  /** Toast only the first failure of a burst — TOAST_LIMIT is 1, so a toast per
   *  row would just clobber itself while the row colours already tell the story. */
  const lastFailureToast = useRef(0);
  const notifyFailure = useCallback(
    (description: string) => {
      const now = Date.now();
      if (now - lastFailureToast.current < 4000) return;
      lastFailureToast.current = now;
      toast({
        title: t('toasts.rowFailed'),
        description,
        variant: 'destructive',
      });
    },
    [toast, t]
  );

  const saveRow = useCallback(
    (rowIndex: number) => {
      const row = rowsRef.current[rowIndex];
      if (!row) return;

      const draft = drafts[row.itemId];
      if (dirtyColumns(row, draft).length === 0) return;
      if (statuses[row.itemId]?.kind === 'saving') return;

      const { input, error: localError } = buildPayload(row, draft, {
        warehouseId: warehouseId || undefined,
        asOfDate,
      });

      if (!input) {
        if (localError) {
          const message =
            localError === 'BELOW_SOLD'
              ? t('errors.belowSold', { qty: row.openingSoldQuantity })
              : localError === 'NO_WAREHOUSE'
                ? t('errors.noWarehouse')
                : t('errors.emptyName');
          setStatuses((prev) => ({
            ...prev,
            [row.itemId]: { kind: 'error', localError: message, at: Date.now() },
          }));
          notifyFailure(`${row.name} — ${message}`);
        }
        return;
      }

      setStatuses((prev) => ({
        ...prev,
        [row.itemId]: { kind: 'saving', at: Date.now() },
      }));

      // Fire and forget — the caret has already moved on.
      saveMutationRef.current.mutate(
        { itemId: row.itemId, input, queryKey },
        {
          onSuccess: (response) => {
            const result = response.data;
            setStatuses((prev) => ({
              ...prev,
              [row.itemId]: {
                kind: result.ok ? 'success' : 'error',
                sections: result.sections,
                at: Date.now(),
              },
            }));

            // Drop the drafts of sections that landed; keep the ones that failed
            // so the user still has their text to correct and retry.
            const failedSections = new Set(
              result.sections.filter((s) => s.status === 'failed').map((s) => s.section)
            );
            setDrafts((prev) => {
              const current = prev[row.itemId];
              if (!current) return prev;
              const kept: RowDraft = {};
              for (const column of GRID_COLUMNS) {
                if (
                  current[column] !== undefined &&
                  failedSections.has(COLUMN_SECTION[column])
                ) {
                  kept[column] = current[column];
                }
              }
              const next = { ...prev };
              if (Object.keys(kept).length > 0) {
                next[row.itemId] = kept;
              } else {
                delete next[row.itemId];
              }
              return next;
            });

            if (!result.ok) {
              const first = result.sections.find((s) => s.status === 'failed');
              notifyFailure(`${row.name} — ${first?.message ?? t('toasts.rowFailed')}`);
            }
          },
          onError: (err) => {
            setStatuses((prev) => ({
              ...prev,
              [row.itemId]: {
                kind: 'error',
                localError: err.message || t('toasts.rowFailed'),
                at: Date.now(),
              },
            }));
            notifyFailure(`${row.name} — ${err.message}`);
          },
        }
      );
    },
    [drafts, statuses, warehouseId, asOfDate, queryKey, t, notifyFailure]
  );

  // --- Keyboard -------------------------------------------------------------

  const moveTo = useCallback(
    (rowIndex: number, column: GridColumn) => {
      if (rowIndex < 0) {
        // Above the first row: step back a page and land on its last row.
        if (page > 1) {
          setPage((p) => p - 1);
          setPendingFocus({ rowIndex: PAGE_SIZE - 1, column });
        }
        return;
      }
      if (rowIndex >= rowsRef.current.length) {
        if (page < totalPages) {
          setPage((p) => p + 1);
          setPendingFocus({ rowIndex: 0, column });
        }
        return;
      }
      setPendingFocus({ rowIndex, column });
    },
    [page, totalPages]
  );

  const handleCellKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, column: GridColumn) => {
      const row = rowsRef.current[rowIndex];

      if (event.key === 'Enter') {
        event.preventDefault();
        saveRow(rowIndex);
        moveTo(rowIndex + 1, column);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveTo(rowIndex + 1, column);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveTo(rowIndex - 1, column);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (row) revertRow(row.itemId);
      }
    },
    [saveRow, moveTo, revertRow]
  );

  // --- Derived counters -----------------------------------------------------

  const counts = useMemo(() => {
    let dirty = 0;
    let saving = 0;
    let saved = 0;
    let failed = 0;
    for (const row of rows) {
      const status = statuses[row.itemId];
      if (status?.kind === 'saving') saving++;
      else if (status?.kind === 'success') saved++;
      else if (status?.kind === 'error') failed++;
      else if (dirtyColumns(row, drafts[row.itemId]).length > 0) dirty++;
    }
    return { dirty, saving, saved, failed };
  }, [rows, statuses, drafts]);

  const hasUnsaved = counts.dirty > 0 || counts.saving > 0;

  // Losing a page of typed corrections to a stray refresh would be brutal.
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  const retryFailed = useCallback(() => {
    rowsRef.current.forEach((row, index) => {
      if (statuses[row.itemId]?.kind === 'error') {
        saveRow(index);
      }
    });
  }, [statuses, saveRow]);

  const activeFilters = FILTER_KEYS.filter((k) => filters[k]);
  const clearFilters = useCallback(() => {
    setFilters({
      missingBarcode: false,
      missingRetail: false,
      missingCost: false,
      zeroOpeningQty: false,
      missingOpeningCost: false,
    });
    setCategoryId('');
  }, []);

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-destructive">{t('errorLoading')}</p>
        <Button onClick={() => window.location.reload()}>{tCommon('retry')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Table2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/${locale}/items`)}>
          {t('backToItems')}
        </Button>
      </div>

      {!isOnline && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {t('offlineNotice')}
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="min-w-[200px] space-y-1">
            <Label>{t('warehouse')}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder={t('warehouse')} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{t('asOfDate')}</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-[170px]"
            />
          </div>

          <div className="space-y-1">
            <Label>{t('search')}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-[260px] pe-8 ps-8"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={t('clearSearch')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Advanced filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal className="me-2 h-4 w-4" />
                {t('filters.button')}
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ms-2">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3">
              <p className="text-sm font-medium">{t('filters.title')}</p>
              <div className="space-y-2">
                {FILTER_KEYS.map((key) => {
                  const disabled = WAREHOUSE_FILTERS.includes(key) && !warehouseId;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-2 text-sm"
                    >
                      <Checkbox
                        checked={filters[key]}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          setFilters((prev) => ({ ...prev, [key]: checked === true }))
                        }
                      />
                      <span className={disabled ? 'text-muted-foreground' : undefined}>
                        {t(`filters.${key}`)}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="space-y-1 border-t pt-3">
                <Label className="text-xs">{t('filters.category')}</Label>
                <Select
                  value={categoryId || 'all'}
                  onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('filters.allCategories')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
                    {(categoriesData?.data ?? []).map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(activeFilters.length > 0 || categoryId) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                  {t('filters.clearAll')}
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {activeFilters.map((key) => (
            <Badge key={key} variant="secondary" className="gap-1">
              {t(`filters.${key}`)}
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, [key]: false }))}
                aria-label={t('filters.remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{t('rowCount', { count: meta?.total ?? 0 })}</span>
          {counts.dirty > 0 && (
            <span className="text-blue-600 dark:text-blue-400">
              {t('counts.dirty', { count: counts.dirty })}
            </span>
          )}
          {counts.saving > 0 && <span>{t('counts.saving', { count: counts.saving })}</span>}
          {counts.saved > 0 && (
            <span className="text-green-600 dark:text-green-400">
              {t('counts.saved', { count: counts.saved })}
            </span>
          )}
          {counts.failed > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {t('counts.failed', { count: counts.failed })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {counts.failed > 0 && (
            <Button variant="outline" size="sm" onClick={retryFailed}>
              <RotateCcw className="me-2 h-3.5 w-3.5" />
              {t('retryFailed')}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label={tCommon('previousPage')}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="text-muted-foreground">
            {t('pageOf', { page, total: Math.max(totalPages, 1) })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => p + 1)}
            aria-label={tCommon('nextPage')}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t('keyboardHint')}</p>

      <ItemGridTable
        rows={rows}
        drafts={drafts}
        statuses={statuses}
        warehouseSelected={!!warehouseId}
        isLoading={isLoading}
        onCellChange={handleCellChange}
        onCellKeyDown={handleCellKeyDown}
        onSaveRow={saveRow}
      />
    </div>
  );
}
