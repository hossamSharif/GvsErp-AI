'use client';

/**
 * Virtualized DataTable Component
 *
 * High-performance table for large datasets (10k+ rows) using TanStack Virtual.
 * Features:
 * - Row virtualization for smooth scrolling
 * - Fixed headers
 * - Column resizing
 * - Sorting
 * - Row selection
 */

import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnResizeMode,
  RowSelectionState,
  Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Settings2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { getSelectionColumn } from './data-table';

// =============================================================================
// TYPES
// =============================================================================

interface VirtualizedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enable row selection */
  selectable?: boolean;
  /** Enable column resizing */
  resizable?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Show search input */
  showSearch?: boolean;
  /** Show column visibility toggle */
  showColumnToggle?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** No data message */
  emptyMessage?: string;
  /** Callback when row selection changes */
  onSelectionChange?: (selectedRows: TData[]) => void;
  /** Row height for virtualization */
  rowHeight?: number;
  /** Container height */
  height?: number;
  /** External sorting state */
  sorting?: { id: string; desc: boolean }[];
  /** External sorting handler */
  onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void;
  /** Callback for search/filter */
  onSearch?: (value: string) => void;
  /** Table container className */
  className?: string;
  /** Estimate row count for better scroll behavior */
  estimatedRowCount?: number;
}

// =============================================================================
// VIRTUALIZED DATA TABLE COMPONENT
// =============================================================================

export function VirtualizedDataTable<TData, TValue>({
  columns,
  data,
  selectable = false,
  resizable = true,
  searchPlaceholder = 'Search...',
  showSearch = true,
  showColumnToggle = true,
  isLoading = false,
  emptyMessage = 'No results found.',
  onSelectionChange,
  rowHeight = 48,
  height = 600,
  sorting: externalSorting,
  onSortingChange,
  onSearch,
  className,
  estimatedRowCount,
}: VirtualizedDataTableProps<TData, TValue>) {
  // Refs
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // State
  const [sorting, setSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [searchValue, setSearchValue] = React.useState('');
  const [columnResizeMode] = React.useState<ColumnResizeMode>('onChange');

  // Add selection column if selectable
  const tableColumns = React.useMemo(() => {
    if (selectable) {
      return [getSelectionColumn<TData>(), ...columns];
    }
    return columns;
  }, [columns, selectable]);

  // Initialize table
  const table = useReactTable({
    data,
    columns: tableColumns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      if (onSortingChange) {
        onSortingChange(newSorting.map((s) => ({ id: s.id, desc: s.desc })));
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting: externalSorting || sorting,
      columnVisibility,
      rowSelection,
    },
    manualSorting: !!onSortingChange,
  });

  // Get rows for virtualization
  const { rows } = table.getRowModel();

  // Setup virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    getScrollElement: () => tableContainerRef.current,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Handle selection change callback
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  // Handle search
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      if (onSearch) {
        onSearch(value);
      }
    },
    [onSearch]
  );

  // Get sort icon for column
  const getSortIcon = (column: { getIsSorted: () => false | 'asc' | 'desc' }) => {
    const sorted = column.getIsSorted();
    if (sorted === 'asc') return <ArrowUp className="ml-2 h-4 w-4" />;
    if (sorted === 'desc') return <ArrowDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
  };

  // Padding for virtual scroll
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              aria-label={searchPlaceholder || 'Search'}
            />
          </div>
        )}

        {/* Row count */}
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {estimatedRowCount || data.length} rows
        </div>

        {/* Column Visibility Toggle */}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== 'undefined' && column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table Container */}
      <div className="rounded-md border overflow-hidden">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ height, maxHeight: height }}
        >
          <Table style={{ width: table.getCenterTotalSize() }}>
            {/* Fixed Header */}
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        style={{
                          width: header.getSize(),
                          position: 'relative',
                        }}
                        className="whitespace-nowrap"
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn(
                              'flex items-center',
                              header.column.getCanSort() &&
                                'cursor-pointer select-none hover:text-foreground'
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            {...(header.column.getCanSort() ? {
                              role: 'button',
                              tabIndex: 0,
                              'aria-sort': header.column.getIsSorted() === 'asc'
                                ? 'ascending'
                                : header.column.getIsSorted() === 'desc'
                                  ? 'descending'
                                  : 'none',
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  header.column.getToggleSortingHandler()?.(e);
                                }
                              },
                            } : {})}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && getSortIcon(header.column)}
                          </div>
                        )}
                        {/* Resize handle */}
                        {resizable && header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                              'hover:bg-primary/50',
                              header.column.getIsResizing() && 'bg-primary'
                            )}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            {/* Virtualized Body */}
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="ml-2">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Top padding row */}
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}

                  {/* Virtual rows */}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index] as Row<TData>;
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        data-state={row.getIsSelected() && 'selected'}
                        className="hover:bg-muted/50"
                        style={{ height: `${rowHeight}px` }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}

                  {/* Bottom padding row */}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Selection info */}
      {selectable && (
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {rows.length} row(s) selected.
        </div>
      )}
    </div>
  );
}
