/**
 * Value derivation for the bulk-edit grid.
 *
 * A cell shows the user's uncommitted text when there is one, otherwise the
 * server value formatted as editable text. Keeping this in one place means the
 * table, the dirty check and the save payload builder can never disagree about
 * what "unchanged" means.
 */

import type { ItemGridRow, SaveItemGridRowInput } from '@erp/shared';
import { GRID_COLUMNS, type GridColumn, type RowDraft } from './types';

/** Server value rendered as the text the input would hold */
export function serverValue(row: ItemGridRow, column: GridColumn): string {
  switch (column) {
    case 'name':
      return row.name ?? '';
    case 'nameAlias':
      return row.nameAlias ?? '';
    case 'barcode':
      return row.barcode ?? '';
    case 'expiryDate':
      return row.expiryDate ?? '';
    case 'retailPrice':
      return row.retailPrice === null ? '' : String(row.retailPrice);
    case 'costPrice':
      return row.costPrice === null ? '' : String(row.costPrice);
    // Opening columns read empty rather than 0 when there is no opening layer,
    // so "never entered" is visually distinct from "deliberately zero".
    case 'openingQuantity':
      return row.hasOpeningEntry ? String(row.openingQuantity) : '';
    case 'openingUnitCost':
      return row.hasOpeningEntry && row.openingUnitCost > 0
        ? String(row.openingUnitCost)
        : '';
    default:
      return '';
  }
}

export function cellValue(
  row: ItemGridRow,
  draft: RowDraft | undefined,
  column: GridColumn
): string {
  const drafted = draft?.[column];
  return drafted !== undefined ? drafted : serverValue(row, column);
}

/** Columns whose text differs from the server value */
export function dirtyColumns(row: ItemGridRow, draft: RowDraft | undefined): GridColumn[] {
  if (!draft) return [];
  return GRID_COLUMNS.filter((c) => {
    const drafted = draft[c];
    return drafted !== undefined && drafted !== serverValue(row, c);
  });
}

export function isRowDirty(row: ItemGridRow, draft: RowDraft | undefined): boolean {
  return dirtyColumns(row, draft).length > 0;
}

const toNumber = (v: string): number => {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
};

export interface BuildPayloadResult {
  input: SaveItemGridRowInput | null;
  /** Client-side rejection, e.g. opening qty below the already-sold floor */
  error?: string;
}

/**
 * Turn the dirty cells of a row into a save payload.
 *
 * Only changed sections are included, so a barcode fix never re-posts an
 * opening-stock journal entry. The opening section is the exception: it always
 * carries both quantity and cost, because the service replaces the layer.
 */
export function buildPayload(
  row: ItemGridRow,
  draft: RowDraft | undefined,
  context: { warehouseId?: string; asOfDate: string }
): BuildPayloadResult {
  const dirty = dirtyColumns(row, draft);
  if (dirty.length === 0) return { input: null };

  const input: SaveItemGridRowInput = {};

  const itemFields: NonNullable<SaveItemGridRowInput['item']> = {};
  if (dirty.includes('name')) itemFields.name = cellValue(row, draft, 'name').trim();
  if (dirty.includes('nameAlias'))
    itemFields.nameAlias = cellValue(row, draft, 'nameAlias').trim() || null;
  if (dirty.includes('barcode'))
    itemFields.barcode = cellValue(row, draft, 'barcode').trim() || null;
  if (dirty.includes('expiryDate'))
    itemFields.expiryDate = cellValue(row, draft, 'expiryDate') || null;
  if (Object.keys(itemFields).length > 0) {
    if (itemFields.name !== undefined && itemFields.name === '') {
      return { input: null, error: 'EMPTY_NAME' };
    }
    input.item = itemFields;
  }

  if (dirty.includes('retailPrice')) {
    input.retailPrice = toNumber(cellValue(row, draft, 'retailPrice'));
  }
  if (dirty.includes('costPrice')) {
    input.costPrice = toNumber(cellValue(row, draft, 'costPrice'));
  }

  if (dirty.includes('openingQuantity') || dirty.includes('openingUnitCost')) {
    if (!context.warehouseId) {
      return { input: null, error: 'NO_WAREHOUSE' };
    }
    const quantity = toNumber(cellValue(row, draft, 'openingQuantity'));
    const unitCost = toNumber(cellValue(row, draft, 'openingUnitCost'));

    // The API enforces this too, but catching it here saves a round-trip and
    // tells the user the exact floor instead of a generic failure.
    if (quantity < row.openingSoldQuantity) {
      return { input: null, error: 'BELOW_SOLD' };
    }

    input.opening = {
      warehouseId: context.warehouseId,
      quantity,
      unitCost,
      asOfDate: context.asOfDate,
    };
  }

  return { input };
}
