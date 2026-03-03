'use client';

/**
 * DataTable Component
 *
 * Excel-like table with TanStack Table featuring:
 * - Fixed headers
 * - Column resizing
 * - Sorting
 * - Row selection
 * - Pagination
 * - Search/Filter
 */

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnResizeMode,
  RowSelectionState,
} from '@tanstack/react-table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enable row selection */
  selectable?: boolean;
  /** Enable column resizing */
  resizable?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Column to use for global search */
  searchColumn?: string;
  /** Show search input */
  showSearch?: boolean;
  /** Show column visibility toggle */
  showColumnToggle?: boolean;
  /** Show pagination */
  showPagination?: boolean;
  /** Default page size */
  pageSize?: number;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Loading state */
  isLoading?: boolean;
  /** No data message */
  emptyMessage?: string;
  /** Callback when row selection changes */
  onSelectionChange?: (selectedRows: TData[]) => void;
  /** External pagination state */
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** External pagination handler */
  onPaginationChange?: (page: number, limit: number) => void;
  /** Total page count (shorthand for server-side pagination) */
  pageCount?: number;
  /** Current page index, 0-based (shorthand for server-side pagination) */
  pageIndex?: number;
  /** Page change handler (shorthand for server-side pagination) */
  onPageChange?: (page: number, limit: number) => void;
  /** External search change handler */
  onSearchChange?: (value: string) => void;
  /** External sorting state */
  sorting?: { id: string; desc: boolean }[];
  /** External sorting handler */
  onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void;
  /** Table container className */
  className?: string;
}

// =============================================================================
// SELECTION COLUMN
// =============================================================================

export function getSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  };
}

// =============================================================================
// DATA TABLE COMPONENT
// =============================================================================

export function DataTable<TData, TValue>({
  columns,
  data,
  selectable = false,
  resizable = true,
  searchPlaceholder = 'Search...',
  searchColumn,
  showSearch = true,
  showColumnToggle = true,
  showPagination = true,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50, 100],
  isLoading = false,
  emptyMessage = 'No results found.',
  onSelectionChange,
  pagination: paginationProp,
  onPaginationChange,
  pageCount,
  pageIndex,
  onPageChange,
  onSearchChange,
  sorting: externalSorting,
  onSortingChange,
  className,
}: DataTableProps<TData, TValue>) {
  // Merge shorthand pagination props into pagination object
  const pagination = paginationProp ?? (pageCount !== undefined ? {
    page: (pageIndex ?? 0) + 1,
    limit: pageSize,
    total: pageCount * pageSize,
    totalPages: pageCount,
  } : undefined);
  const handlePaginationChange = onPaginationChange ?? onPageChange;
  // State
  const [sorting, setSorting] = React.useState<SortingState>(externalSorting || []);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
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
    getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      if (onSortingChange) {
        onSortingChange(newSorting.map((s) => ({ id: s.id, desc: s.desc })));
      }
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting: externalSorting || sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    manualPagination: !!pagination,
    manualSorting: !!onSortingChange,
  });

  // Handle selection change callback
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table
        .getSelectedRowModel()
        .rows.map((row) => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, table]);

  // Get sort icon for column
  const getSortIcon = (column: { getIsSorted: () => false | 'asc' | 'desc' }) => {
    const sorted = column.getIsSorted();
    if (sorted === 'asc') return <ArrowUp className="ml-2 h-4 w-4" aria-hidden="true" />;
    if (sorted === 'desc') return <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />;
    return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" aria-hidden="true" />;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchColumn
                ? (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''
                : globalFilter
              }
              onChange={(event) => {
                if (onSearchChange) {
                  onSearchChange(event.target.value);
                } else if (searchColumn) {
                  table.getColumn(searchColumn)?.setFilterValue(event.target.value);
                } else {
                  setGlobalFilter(event.target.value);
                }
              }}
              className="pl-9"
            />
          </div>
        )}

        {/* Column Visibility Toggle */}
        {showColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
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

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto max-h-[600px]">
          <Table style={{ width: table.getCenterTotalSize() }}>
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
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="hover:bg-muted/50"
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
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          {/* Selection info */}
          <div className="flex-1 text-sm text-muted-foreground">
            {selectable && (
              <>
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </>
            )}
          </div>

          <div className="flex items-center gap-6 lg:gap-8">
            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <label id="rows-per-page-label" className="text-sm font-medium">Rows per page</label>
              <Select
                value={String(pagination?.limit || table.getState().pagination.pageSize)}
                onValueChange={(value) => {
                  if (handlePaginationChange && pagination) {
                    handlePaginationChange(1, Number(value));
                  } else {
                    table.setPageSize(Number(value));
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[70px]" aria-labelledby="rows-per-page-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page info */}
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {pagination ? pagination.page : table.getState().pagination.pageIndex + 1} of{' '}
              {pagination ? pagination.totalPages : table.getPageCount()}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (handlePaginationChange && pagination) {
                    handlePaginationChange(1, pagination.limit);
                  } else {
                    table.setPageIndex(0);
                  }
                }}
                disabled={pagination ? pagination.page <= 1 : !table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (handlePaginationChange && pagination) {
                    handlePaginationChange(pagination.page - 1, pagination.limit);
                  } else {
                    table.previousPage();
                  }
                }}
                disabled={pagination ? pagination.page <= 1 : !table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (handlePaginationChange && pagination) {
                    handlePaginationChange(pagination.page + 1, pagination.limit);
                  } else {
                    table.nextPage();
                  }
                }}
                disabled={
                  pagination
                    ? pagination.page >= pagination.totalPages
                    : !table.getCanNextPage()
                }
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (handlePaginationChange && pagination) {
                    handlePaginationChange(pagination.totalPages, pagination.limit);
                  } else {
                    table.setPageIndex(table.getPageCount() - 1);
                  }
                }}
                disabled={
                  pagination
                    ? pagination.page >= pagination.totalPages
                    : !table.getCanNextPage()
                }
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
