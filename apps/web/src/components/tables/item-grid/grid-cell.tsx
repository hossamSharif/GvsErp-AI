'use client';

/**
 * GridCell
 *
 * A single always-live cell of the bulk-edit grid.
 *
 * Two decisions that the rest of the grid depends on:
 *  - The input is never toggled between a display and an edit mode (unlike
 *    EditableCell in invoice-items-table.tsx). Keeping a real <input> mounted in
 *    every cell is what makes native Tab traversal work across the whole row.
 *  - Numeric cells are `type="text"` with `inputMode="decimal"`, never
 *    `type="number"` — a number input swallows ArrowUp/ArrowDown to step its
 *    value, which would break row-to-row arrow navigation.
 */

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { GridColumn } from './types';

export interface GridCellProps {
  value: string;
  column: GridColumn;
  rowIndex: number;
  disabled?: boolean;
  /** Renders the cell tinted and read-only, e.g. opening columns with no warehouse */
  unavailable?: boolean;
  /** Marks the value as changed but not yet saved */
  dirty?: boolean;
  type?: 'text' | 'decimal' | 'date';
  placeholder?: string;
  title?: string;
  align?: 'start' | 'end';
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const GridCell = forwardRef<HTMLInputElement, GridCellProps>(function GridCell(
  {
    value,
    column,
    rowIndex,
    disabled,
    unavailable,
    dirty,
    type = 'text',
    placeholder,
    title,
    align = 'start',
    onChange,
    onKeyDown,
  },
  ref
) {
  return (
    <input
      ref={ref}
      data-grid-cell=""
      data-row-index={rowIndex}
      data-col={column}
      type={type === 'date' ? 'date' : 'text'}
      inputMode={type === 'decimal' ? 'decimal' : undefined}
      value={value}
      disabled={disabled || unavailable}
      placeholder={placeholder}
      title={title}
      // Select the whole value on entry so the user can type straight over it,
      // whether they arrived by Tab, by arrow key or by click.
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={cn(
        'h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-sm',
        'focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary',
        'disabled:cursor-not-allowed disabled:text-muted-foreground',
        align === 'end' && 'text-end',
        type === 'decimal' && 'font-mono',
        dirty && 'font-medium',
        unavailable && 'bg-muted/40'
      )}
    />
  );
});
