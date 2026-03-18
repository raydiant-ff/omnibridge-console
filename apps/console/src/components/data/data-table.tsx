"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type ExpandedState,
  type Row,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyBlock } from "@/components/states";

// ---------------------------------------------------------------------------
// DataTableShell — full-featured table with toolbar, pagination, row actions
// Use this as the base for any data-heavy operational list view.
// ---------------------------------------------------------------------------

interface DataTableShellProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  toolbar?: React.ReactNode;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Enable row expansion */
  expandable?: boolean;
  /** Render expanded row content */
  renderSubRow?: (row: TData) => React.ReactNode;
  /** Called when a row is clicked */
  onRowClick?: (row: TData) => void;
  /** Empty state override */
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTableShell<TData>({
  columns: userColumns,
  data,
  toolbar,
  selectable = false,
  expandable = false,
  renderSubRow,
  onRowClick,
  emptyState,
  className,
}: DataTableShellProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Prepend selection + expansion columns if needed
  const columns: ColumnDef<TData>[] = [
    ...(selectable
      ? [
          {
            id: "__select",
            header: ({ table }: { table: ReturnType<typeof useReactTable<TData>> }) => (
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                aria-label="Select all"
              />
            ),
            cell: ({ row }: { row: Row<TData> }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(v) => row.toggleSelected(!!v)}
                aria-label="Select row"
                onClick={(e) => e.stopPropagation()}
              />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
          } as ColumnDef<TData>,
        ]
      : []),
    ...(expandable
      ? [
          {
            id: "__expand",
            header: () => null,
            cell: ({ row }: { row: Row<TData> }) =>
              row.getCanExpand() ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    row.toggleExpanded();
                  }}
                  className="flex items-center justify-center size-6 rounded hover:bg-muted transition-colors"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              ) : null,
            enableSorting: false,
            enableHiding: false,
            size: 36,
          } as ColumnDef<TData>,
        ]
      : []),
    ...userColumns,
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, expanded },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: expandable ? () => undefined : undefined,
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar slot */}
      {toolbar && <div className="mb-3">{toolbar}</div>}

      {/* Row selection bar */}
      {selectable && selectedCount > 0 && (
        <RowSelectionBar count={selectedCount} onClear={() => setRowSelection({})} />
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.columnDef.size }}
                      className={cn(
                        header.column.getCanSort() &&
                          "cursor-pointer select-none hover:text-foreground transition-colors",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    {emptyState ?? (
                      <EmptyBlock title="No records" description="No data to display." />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <>
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(onRowClick && "cursor-pointer hover:bg-muted/40 transition-colors")}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>

                    {expandable && row.getIsExpanded() && renderSubRow && (
                      <TableRow key={`${row.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={columns.length} className="p-0">
                          <RowExpansionRegion>{renderSubRow(row.original)}</RowExpansionRegion>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTableToolbar — search + filter controls above a table
// ---------------------------------------------------------------------------

interface DataTableToolbarProps {
  children?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  className?: string;
}

export function DataTableToolbar({
  children,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  className,
}: DataTableToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {onSearchChange !== undefined && (
        <Input
          placeholder={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-64 text-sm"
        />
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTableFilters — filter chip area
// ---------------------------------------------------------------------------

interface DataTableFiltersProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTableFilters({ children, className }: DataTableFiltersProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>{children}</div>
  );
}

// ---------------------------------------------------------------------------
// DataTableEmptyState — no-data overlay for filtered/empty tables
// ---------------------------------------------------------------------------

interface DataTableEmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function DataTableEmptyState({
  title = "No results",
  description = "Try adjusting your filters.",
  action,
}: DataTableEmptyStateProps) {
  return <EmptyBlock title={title} description={description} action={action} />;
}

// ---------------------------------------------------------------------------
// DataTablePagination — page navigation controls
// ---------------------------------------------------------------------------

interface DataTablePaginationProps<TData> {
  table: ReturnType<typeof useReactTable<TData>>;
}

export function DataTablePagination<TData>({ table }: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length > 0
          ? `${table.getFilteredSelectedRowModel().rows.length} of `
          : ""}
        {table.getFilteredRowModel().rows.length} row(s)
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowActionsMenu — three-dot action menu for a table row
// ---------------------------------------------------------------------------

interface RowAction {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  separator?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
}

export function RowActionsMenu({ actions }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover/row:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Row actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action, i) => (
          <>
            {action.separator && i > 0 && <DropdownMenuSeparator key={`sep-${i}`} />}
            <DropdownMenuItem
              key={action.label}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={cn(action.destructive && "text-destructive focus:text-destructive")}
            >
              {action.label}
            </DropdownMenuItem>
          </>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// RowSelectionBar — floating bar shown when rows are selected
// ---------------------------------------------------------------------------

interface RowSelectionBarProps {
  count: number;
  onClear: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function RowSelectionBar({ count, onClear, actions, className }: RowSelectionBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5 mb-2 rounded-lg bg-primary text-primary-foreground text-sm",
        className,
      )}
    >
      <span className="font-medium">
        {count} row{count !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={onClear}
          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowExpansionRegion — content area for an expanded table row
// ---------------------------------------------------------------------------

interface RowExpansionRegionProps {
  children: React.ReactNode;
  className?: string;
}

export function RowExpansionRegion({ children, className }: RowExpansionRegionProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// RecordSheetTrigger — wrapper that opens a detail Sheet on row click
// ---------------------------------------------------------------------------

interface RecordSheetTriggerProps {
  children: React.ReactNode;
  onOpen: () => void;
  className?: string;
}

export function RecordSheetTrigger({ children, onOpen, className }: RecordSheetTriggerProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </div>
  );
}
