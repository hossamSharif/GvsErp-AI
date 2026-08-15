'use client';

/**
 * Settlement Form Component
 *
 * Physical-count worksheet for a warehouse. Unlike the transfer form (which
 * picks items one at a time), this loads every item in the chosen warehouse
 * with its system quantity and lets the user type what they actually counted.
 *
 * Only lines whose counted quantity differs from the system quantity are
 * submitted — a full count sheet is mostly agreement, and sending hundreds of
 * no-op lines would bloat the document for no benefit.
 */

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useActiveWarehouses } from '@/hooks/use-warehouses';
import { useCountSheet } from '@/hooks/use-settlements';
import type {
  CreateSettlementInput,
  SettlementReason,
  SettlementWithDetails,
} from '@erp/shared';

const REASONS: SettlementReason[] = [
  'count_correction',
  'damage',
  'theft',
  'expiry',
  'other',
];

const EPS = 0.0001;

/** What the user has typed for one item, keyed by itemId. */
interface CountEntry {
  counted: string;
  unitCost: string;
}

interface SettlementFormProps {
  initialWarehouseId?: string;
  /** Supplied when editing an existing draft. */
  settlement?: SettlementWithDetails;
  onSubmit: (data: CreateSettlementInput) => Promise<void>;
  isSubmitting?: boolean;
}

export function SettlementForm({
  initialWarehouseId,
  settlement,
  onSubmit,
  isSubmitting = false,
}: SettlementFormProps) {
  const t = useTranslations('settlements');
  const tc = useTranslations('common');

  const [warehouseId, setWarehouseId] = useState(
    settlement?.warehouseId ?? initialWarehouseId ?? ''
  );
  const [settlementDate, setSettlementDate] = useState(
    settlement?.settlementDate ?? new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState<SettlementReason>(
    settlement?.reason ?? 'count_correction'
  );
  const [notes, setNotes] = useState(settlement?.notes ?? '');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<Record<string, CountEntry>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: warehousesData } = useActiveWarehouses();
  const warehouses = warehousesData?.data ?? [];

  const { data: countSheetData, isLoading: isLoadingSheet } = useCountSheet({
    warehouseId,
    search: search || undefined,
    limit: 200,
  });
  const rows = countSheetData?.data ?? [];

  // Seed the grid from an existing draft so editing shows what was counted.
  useEffect(() => {
    if (!settlement) return;
    setEntries(
      Object.fromEntries(
        settlement.items.map((line) => [
          line.itemId,
          {
            counted: String(line.countedQuantity),
            unitCost: String(line.unitCost),
          },
        ])
      )
    );
  }, [settlement]);

  const setEntry = (itemId: string, patch: Partial<CountEntry>, fallbackCost: number) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        counted: patch.counted ?? prev[itemId]?.counted ?? '',
        unitCost:
          patch.unitCost ?? prev[itemId]?.unitCost ?? String(fallbackCost),
      },
    }));
  };

  /** Lines that actually differ from the system quantity. */
  const changedLines = useMemo(() => {
    return rows
      .map((row) => {
        const entry = entries[row.itemId];
        if (!entry || entry.counted.trim() === '') return null;

        const counted = Number(entry.counted);
        if (!Number.isFinite(counted) || counted < 0) return null;

        const difference = counted - row.systemQuantity;
        if (Math.abs(difference) < EPS) return null;

        const unitCost = Number(entry.unitCost);

        return {
          row,
          counted,
          difference,
          unitCost: Number.isFinite(unitCost) ? unitCost : row.suggestedUnitCost,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [rows, entries]);

  const totals = useMemo(() => {
    let increase = 0;
    let decrease = 0;
    for (const line of changedLines) {
      const value = line.difference * line.unitCost;
      if (value >= 0) increase += value;
      else decrease += Math.abs(value);
    }
    return { increase, decrease, net: increase - decrease };
  }, [changedLines]);

  const handleSubmit = async () => {
    setError(null);

    if (!warehouseId) {
      setError(t('errors.warehouseRequired'));
      return;
    }
    if (changedLines.length === 0) {
      setError(t('errors.noChanges'));
      return;
    }

    await onSubmit({
      warehouseId,
      settlementDate,
      reason,
      notes: notes.trim() || null,
      items: changedLines.map((line) => ({
        itemId: line.row.itemId,
        countedQuantity: line.counted,
        unitCost: line.unitCost,
      })),
    });
  };

  const formatQty = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* Document header                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.detailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="warehouse">{t('fields.warehouse')}</Label>
            <Select
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                // Counts belong to a warehouse — switching invalidates them.
                setEntries({});
              }}
              disabled={Boolean(settlement)}
            >
              <SelectTrigger id="warehouse">
                <SelectValue placeholder={t('form.selectWarehouse')} />
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

          <div className="space-y-2">
            <Label htmlFor="settlementDate">{t('fields.date')}</Label>
            <Input
              id="settlementDate"
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">{t('fields.reason')}</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as SettlementReason)}
            >
              <SelectTrigger id="reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`reasons.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="notes">{t('fields.notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Count sheet                                                        */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>{t('form.countSheetTitle')}</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute start-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('form.searchItems')}
              className="ps-8"
              disabled={!warehouseId}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!warehouseId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('form.selectWarehouseFirst')}
            </p>
          ) : isLoadingSheet ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('form.noItems')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.item')}</TableHead>
                    <TableHead className="text-end">{t('fields.systemQty')}</TableHead>
                    <TableHead className="text-end">{t('fields.countedQty')}</TableHead>
                    <TableHead className="text-end">{t('fields.difference')}</TableHead>
                    <TableHead className="text-end">{t('fields.unitCost')}</TableHead>
                    <TableHead className="text-end">{t('fields.valueImpact')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const entry = entries[row.itemId];
                    const countedRaw = entry?.counted ?? '';
                    const counted = Number(countedRaw);
                    const hasCount =
                      countedRaw.trim() !== '' && Number.isFinite(counted);
                    const difference = hasCount ? counted - row.systemQuantity : 0;
                    const isChanged = hasCount && Math.abs(difference) >= EPS;
                    const unitCost = Number(
                      entry?.unitCost ?? row.suggestedUnitCost
                    );
                    const valueImpact = isChanged ? difference * unitCost : 0;

                    return (
                      <TableRow
                        key={row.itemId}
                        className={isChanged ? 'bg-muted/40' : undefined}
                      >
                        <TableCell>
                          <div className="font-medium">{row.itemName}</div>
                          {row.sku && (
                            <div className="text-xs text-muted-foreground">
                              {row.sku}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-end tabular-nums text-muted-foreground">
                          {formatQty(row.systemQuantity)}
                        </TableCell>

                        <TableCell className="text-end">
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            inputMode="decimal"
                            value={countedRaw}
                            onChange={(e) =>
                              setEntry(
                                row.itemId,
                                { counted: e.target.value },
                                row.suggestedUnitCost
                              )
                            }
                            placeholder={formatQty(row.systemQuantity)}
                            className="ms-auto w-28 text-end tabular-nums"
                          />
                        </TableCell>

                        <TableCell
                          className={`text-end tabular-nums font-medium ${
                            !isChanged
                              ? 'text-muted-foreground'
                              : difference > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isChanged
                            ? `${difference > 0 ? '+' : ''}${formatQty(difference)}`
                            : '—'}
                        </TableCell>

                        <TableCell className="text-end">
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            inputMode="decimal"
                            value={entry?.unitCost ?? String(row.suggestedUnitCost)}
                            onChange={(e) =>
                              setEntry(
                                row.itemId,
                                { unitCost: e.target.value },
                                row.suggestedUnitCost
                              )
                            }
                            className="ms-auto w-28 text-end tabular-nums"
                            disabled={!isChanged}
                          />
                        </TableCell>

                        <TableCell className="text-end tabular-nums">
                          {isChanged ? formatMoney(valueImpact) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Summary + submit                                                   */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <div>
              {t('form.changedLines', { count: changedLines.length })}
            </div>
            <div className="text-muted-foreground">
              {t('form.increaseValue')}: {formatMoney(totals.increase)} ·{' '}
              {t('form.decreaseValue')}: {formatMoney(totals.decrease)} ·{' '}
              <span className="font-medium text-foreground">
                {t('form.netValue')}: {formatMoney(totals.net)}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || changedLines.length === 0}
          >
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('form.saveDraft')}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
