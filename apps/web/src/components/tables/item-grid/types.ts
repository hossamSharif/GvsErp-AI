/**
 * Shared types for the items bulk-edit grid.
 */

import type { ItemGridSection, ItemGridSectionResult } from '@erp/shared';

/** Editable columns, in Tab order */
export const GRID_COLUMNS = [
  'name',
  'nameAlias',
  'barcode',
  'expiryDate',
  'retailPrice',
  'costPrice',
  'openingQuantity',
  'openingUnitCost',
] as const;

export type GridColumn = (typeof GRID_COLUMNS)[number];

/**
 * Which columns belong to which save section.
 *
 * Used two ways: to decide which sections a row save must include, and — after
 * a partial failure — to keep the user's text in the cells that failed while
 * dropping the drafts that were accepted.
 */
export const COLUMN_SECTION: Record<GridColumn, ItemGridSection> = {
  name: 'item',
  nameAlias: 'item',
  barcode: 'item',
  expiryDate: 'item',
  retailPrice: 'retailPrice',
  costPrice: 'costPrice',
  openingQuantity: 'opening',
  openingUnitCost: 'opening',
};

/** Columns that only make sense once a warehouse is selected */
export const WAREHOUSE_COLUMNS: GridColumn[] = ['openingQuantity', 'openingUnitCost'];

/** Uncommitted cell text for one row, keyed by column */
export type RowDraft = Partial<Record<GridColumn, string>>;

export type RowStatusKind = 'saving' | 'success' | 'error';

export interface RowStatus {
  kind: RowStatusKind;
  /** Per-section outcomes from the last save; drives the detail popover */
  sections?: ItemGridSectionResult[];
  /** Set when the row was rejected client-side, before any request went out */
  localError?: string;
  /** Epoch ms — lets the success tint fade while the marker stays */
  at: number;
}

/** Where the caret should go next, resolved after the next render */
export interface FocusTarget {
  rowIndex: number;
  column: GridColumn;
}
