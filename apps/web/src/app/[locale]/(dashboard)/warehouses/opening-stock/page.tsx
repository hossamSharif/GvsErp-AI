'use client';

/**
 * Opening Stock Page
 *
 * Lets users set the initial inventory for a warehouse:
 *  - Select warehouse + as-of date
 *  - Search / filter items by name or SKU
 *  - Quick-create a new item without leaving the page
 *  - Enter quantity + unit cost per item
 *  - Additive submit (warns when a prior opening entry exists for an item)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PackagePlus, AlertCircle, Loader2, Search, X, Plus, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ItemQuickModal } from '@/components/forms/item-quick-modal';

import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useOpeningStockRows, useSetOpeningStock, openingStockKeys } from '@/hooks/use-opening-stock';
import type { ItemWithRelations, OpeningStockItemInput } from '@erp/shared';

export default function OpeningStockPage() {
  const t = useTranslations('openingStock');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);

  const [warehouseId, setWarehouseId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(today);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [isDraftDirty, setIsDraftDirty] = useState(false);

  const warehousesQuery = useActiveWarehouses();
  const rowsQuery = useOpeningStockRows(warehouseId || undefined);
  const mutation = useSetOpeningStock(warehouseId || undefined);

  const rows = rowsQuery.data ?? [];

  // Draft key scoped per warehouse
  const draftKey = warehouseId ? `erp:opening-stock-draft:${warehouseId}` : null;

  // Client-side filter — instant, preserves unsaved qty/cost state across searches
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(term) ||
        (r.sku && r.sku.toLowerCase().includes(term))
    );
  }, [rows, search]);

  const handleWarehouseChange = useCallback((id: string) => {
    setWarehouseId(id);
    setSearch('');
    // Attempt to restore a previously saved draft for this warehouse
    try {
      const raw = localStorage.getItem(`erp:opening-stock-draft:${id}`);
      if (raw) {
        const draft = JSON.parse(raw) as { quantities: Record<string, string>; costs: Record<string, string>; asOfDate: string };
        setQuantities(draft.quantities ?? {});
        setCosts(draft.costs ?? {});
        if (draft.asOfDate) setAsOfDate(draft.asOfDate);
        setIsDraftDirty(true);
        return;
      }
    } catch {
      // ignore corrupted draft
    }
    setQuantities({});
    setCosts({});
    setIsDraftDirty(false);
  }, []);

  // Pre-fill cost when rows load (if nothing entered yet)
  const handleRowsLoaded = useCallback(() => {
    if (!rows.length) return;
    setCosts((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (!next[row.itemId] && row.suggestedUnitCost > 0) {
          next[row.itemId] = String(row.suggestedUnitCost);
        }
      });
      return next;
    });
  }, [rows]);

  // Trigger pre-fill when rows arrive
  if (rows.length > 0 && Object.keys(costs).length === 0) {
    handleRowsLoaded();
  }

  // Persist quantities/costs to localStorage with 800ms debounce
  useEffect(() => {
    if (!draftKey) return;
    if (Object.keys(quantities).length === 0 && Object.keys(costs).length === 0) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ quantities, costs, asOfDate }));
        setIsDraftDirty(true);
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [quantities, costs, asOfDate, draftKey]);

  // buildItems always reads from the full rows list (not filteredRows) so that
  // quantities entered before filtering are included in the save.
  const buildItems = useCallback((): OpeningStockItemInput[] => {
    return rows
      .filter((row) => {
        const qty = parseFloat(quantities[row.itemId] || '0');
        return qty > 0;
      })
      .map((row) => ({
        itemId: row.itemId,
        quantity: parseFloat(quantities[row.itemId]),
        unitCost: parseFloat(costs[row.itemId] || '0'),
      }));
  }, [rows, quantities, costs]);

  const handleSave = useCallback(() => {
    const items = buildItems();
    if (items.length === 0) return;

    const hasExisting = items.some((item) => {
      const row = rows.find((r) => r.itemId === item.itemId);
      return row?.hasOpeningEntry;
    });

    if (hasExisting) {
      setShowConfirm(true);
    } else {
      doSave(items);
    }
  }, [buildItems, rows]);

  const doSave = useCallback(
    (items: OpeningStockItemInput[]) => {
      mutation.mutate(
        { asOfDate, items },
        {
          onSuccess: () => {
            toast({ title: t('saved') });
            setQuantities({});
            setCosts({});
            if (draftKey) {
              try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
            }
            setIsDraftDirty(false);
          },
          onError: () => {
            toast({ title: t('saveError'), variant: 'destructive' });
          },
        }
      );
    },
    [mutation, asOfDate, t, toast]
  );

  // After quick-creating an item, reload rows and highlight the new item in the search box
  const handleItemCreated = useCallback(
    (item: ItemWithRelations) => {
      if (warehouseId) {
        queryClient.invalidateQueries({ queryKey: openingStockKeys.rows(warehouseId) });
      }
      setSearch(item.name);
      setQuickAddOpen(false);
    },
    [warehouseId, queryClient]
  );

  const warehouses = warehousesQuery.data?.data ?? [];
  const submittableItems = buildItems();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <PackagePlus className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 min-w-[220px]">
              <Label>{t('selectWarehouse')}</Label>
              <Select value={warehouseId} onValueChange={handleWarehouseChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectWarehouse')} />
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
                className="w-[180px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items table */}
      {warehouseId && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{t('title')}</CardTitle>
                {rows.length > 0 && (
                  <CardDescription className="mt-1">
                    {t('totalItems', { count: rows.length })}
                  </CardDescription>
                )}
              </div>

              {/* Search + Quick-add */}
              {rows.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('searchItems')}
                      className="ps-8 pe-8 w-[220px] h-9"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    onClick={() => setQuickAddOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    {t('addItem')}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rowsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">{t('noItems')}</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                {t('noResults', { query: search })}
              </p>
            ) : (
              <>
                <div className="rounded-md border overflow-auto max-h-[calc(100vh-18rem)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 bg-background z-10">{t('itemName')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10">{t('sku')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10">{t('unit')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 text-end">{t('currentQty')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 w-32">{t('quantity')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10 w-36">{t('unitCost')}</TableHead>
                        <TableHead className="sticky top-0 bg-background z-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.itemId}>
                          <TableCell className="font-medium">{row.itemName}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.sku ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.unitOfMeasure}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {row.currentQuantity}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="0"
                              value={quantities[row.itemId] ?? ''}
                              onChange={(e) =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [row.itemId]: e.target.value,
                                }))
                              }
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.0001"
                              placeholder="0"
                              value={costs[row.itemId] ?? ''}
                              onChange={(e) =>
                                setCosts((prev) => ({
                                  ...prev,
                                  [row.itemId]: e.target.value,
                                }))
                              }
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            {row.hasOpeningEntry && (
                              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50 whitespace-nowrap">
                                <AlertCircle className="w-3 h-3" />
                                {t('alreadyEntered')}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="sticky bottom-0 z-10 bg-background border-t -mx-6 -mb-6 px-6 py-3 flex items-center justify-between rounded-b-lg mt-0">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    {isDraftDirty && (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        {t('draftSaved')}
                      </>
                    )}
                    {submittableItems.length > 0 && (
                      <span className={isDraftDirty ? 'ms-3' : ''}>
                        {t('itemsWithQty', { count: submittableItems.length })}
                      </span>
                    )}
                  </span>
                  <Button
                    onClick={handleSave}
                    disabled={submittableItems.length === 0 || mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 me-2 animate-spin" />
                        {t('saving')}
                      </>
                    ) : (
                      t('save')
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog for items with existing opening entries */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                doSave(buildItems());
              }}
            >
              {t('confirmProceed')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick-add item modal */}
      <ItemQuickModal
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        mode="create"
        onSaved={handleItemCreated}
      />
    </div>
  );
}
