'use client';

/**
 * ItemGridTable
 *
 * The spreadsheet surface of the items bulk-edit page.
 *
 * Built on the raw Table primitives rather than DataTable: DataTable exposes no
 * per-row className and no cell-update channel, and this grid needs direct DOM
 * control over focus.
 *
 * Row colour is the primary feedback channel — blue while dirty, dimmed while
 * saving, a green edge once saved, an amber edge when something failed — so the
 * user can scan a page of edits and see exactly which rows landed.
 */

import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ItemGridRow } from '@erp/shared';
import { GridCell } from './grid-cell';
import { cellValue, dirtyColumns } from './row-values';
import {
  GRID_COLUMNS,
  WAREHOUSE_COLUMNS,
  type GridColumn,
  type RowDraft,
  type RowStatus,
} from './types';
import { Check, Loader2, AlertTriangle, Save } from 'lucide-react';

export interface ItemGridTableProps {
  rows: ItemGridRow[];
  drafts: Record<string, RowDraft>;
  statuses: Record<string, RowStatus>;
  warehouseSelected: boolean;
  isLoading: boolean;
  onCellChange: (itemId: string, column: GridColumn, value: string) => void;
  onCellKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    column: GridColumn
  ) => void;
  onSaveRow: (rowIndex: number) => void;
}

const COLUMN_WIDTH: Record<GridColumn, string> = {
  name: 'w-[220px] min-w-[180px]',
  nameAlias: 'w-[180px] min-w-[140px]',
  barcode: 'w-[150px] min-w-[120px]',
  expiryDate: 'w-[150px] min-w-[140px]',
  retailPrice: 'w-[110px] min-w-[90px]',
  costPrice: 'w-[110px] min-w-[90px]',
  openingQuantity: 'w-[120px] min-w-[100px]',
  openingUnitCost: 'w-[120px] min-w-[100px]',
};

const NUMERIC_COLUMNS: GridColumn[] = [
  'retailPrice',
  'costPrice',
  'openingQuantity',
  'openingUnitCost',
];

export function ItemGridTable({
  rows,
  drafts,
  statuses,
  warehouseSelected,
  isLoading,
  onCellChange,
  onCellKeyDown,
  onSaveRow,
}: ItemGridTableProps) {
  const t = useTranslations('itemsGrid');

  return (
    <div className="relative overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-30 bg-muted">
          <TableRow>
            {GRID_COLUMNS.map((column) => (
              <TableHead
                key={column}
                className={cn(
                  COLUMN_WIDTH[column],
                  NUMERIC_COLUMNS.includes(column) && 'text-end',
                  // The name column stays pinned so context survives a scroll
                  // across nine columns.
                  column === 'name' && 'sticky start-0 z-10 bg-muted'
                )}
              >
                {t(`columns.${column}`)}
              </TableHead>
            ))}
            <TableHead className="w-[70px] text-center">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={GRID_COLUMNS.length + 1} className="h-24 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={GRID_COLUMNS.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                {t('empty')}
              </TableCell>
            </TableRow>
          )}

          {rows.map((row, rowIndex) => {
            const draft = drafts[row.itemId];
            const status = statuses[row.itemId];
            const dirty = dirtyColumns(row, draft);
            const isDirty = dirty.length > 0;
            const isSaving = status?.kind === 'saving';

            return (
              <TableRow
                key={row.itemId}
                className={cn(
                  'bg-background transition-colors',
                  isDirty && !isSaving && 'bg-blue-50/70 dark:bg-blue-950/30',
                  isSaving && 'bg-muted/50 opacity-70',
                  status?.kind === 'success' &&
                    'border-s-4 border-s-green-500 bg-green-50/50 dark:bg-green-950/30',
                  status?.kind === 'error' &&
                    'border-s-4 border-s-amber-500 bg-amber-50/70 dark:bg-amber-950/40'
                )}
              >
                {GRID_COLUMNS.map((column) => {
                  const unavailable =
                    WAREHOUSE_COLUMNS.includes(column) && !warehouseSelected;

                  return (
                    <TableCell
                      key={column}
                      className={cn(
                        'p-1',
                        column === 'name' && 'sticky start-0 z-10 bg-inherit'
                      )}
                    >
                      <GridCell
                        value={cellValue(row, draft, column)}
                        column={column}
                        rowIndex={rowIndex}
                        disabled={isSaving}
                        unavailable={unavailable}
                        dirty={dirty.includes(column)}
                        type={
                          column === 'expiryDate'
                            ? 'date'
                            : NUMERIC_COLUMNS.includes(column)
                              ? 'decimal'
                              : 'text'
                        }
                        align={NUMERIC_COLUMNS.includes(column) ? 'end' : 'start'}
                        title={
                          unavailable
                            ? t('selectWarehouseFirst')
                            : column === 'openingQuantity' && row.openingSoldQuantity > 0
                              ? t('soldFloorHint', { qty: row.openingSoldQuantity })
                              : undefined
                        }
                        onChange={(value) => onCellChange(row.itemId, column, value)}
                        onKeyDown={(event) => onCellKeyDown(event, rowIndex, column)}
                      />
                    </TableCell>
                  );
                })}

                <TableCell className="p-1 text-center">
                  <RowAction
                    status={status}
                    isDirty={isDirty}
                    onSave={() => onSaveRow(rowIndex)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The action column doubles as the row's status light and the place where the
 * detailed per-section outcome lives — one row save touches item info, two
 * price tiers and opening stock, and the user needs to know which of them
 * failed, not just that "something" did.
 */
function RowAction({
  status,
  isDirty,
  onSave,
}: {
  status?: RowStatus;
  isDirty: boolean;
  onSave: () => void;
}) {
  const t = useTranslations('itemsGrid');

  if (status?.kind === 'saving') {
    return <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (status?.kind === 'error' || (status?.kind === 'success' && status.sections)) {
    const isError = status.kind === 'error';
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={isError ? t('status.failed') : t('status.saved')}
          >
            {isError ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 text-sm">
          <p className="mb-2 font-medium">
            {isError ? t('status.failed') : t('status.saved')}
          </p>
          {status.localError ? (
            <p className="text-amber-700 dark:text-amber-300">{status.localError}</p>
          ) : (
            <ul className="space-y-1.5">
              {(status.sections ?? [])
                .filter((s) => s.status !== 'skipped')
                .map((s) => (
                  <li key={s.section} className="flex gap-2">
                    {s.status === 'ok' ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>
                      <span className="font-medium">{t(`sections.${s.section}`)}</span>
                      {s.message ? ` — ${s.message}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', !isDirty && 'text-muted-foreground/40')}
      disabled={!isDirty}
      onClick={onSave}
      aria-label={t('saveRow')}
      title={t('saveRow')}
    >
      <Save className="h-4 w-4" />
    </Button>
  );
}
