import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ---------------------------------------------------------------------------
// DataList — generic vertical list container
// ---------------------------------------------------------------------------

interface DataListProps {
  children: React.ReactNode;
  divided?: boolean;
  className?: string;
}

export function DataList({ children, divided = true, className }: DataListProps) {
  return (
    <ul className={cn("flex flex-col", divided && "divide-y divide-border", className)}>
      {children}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// DataListItem — single item in a DataList
// ---------------------------------------------------------------------------

interface DataListItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function DataListItem({ children, onClick, className }: DataListItemProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        onClick && "cursor-pointer hover:bg-muted/40 transition-colors",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </li>
  );
}

// ---------------------------------------------------------------------------
// RecordToolbar — action toolbar above a record or list view
// ---------------------------------------------------------------------------

interface RecordToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function RecordToolbar({ children, className }: RecordToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordMetaRow — horizontal strip of label/value metadata for a record
// ---------------------------------------------------------------------------

interface RecordMetaField {
  label: string;
  value: React.ReactNode;
}

interface RecordMetaRowProps {
  fields: RecordMetaField[];
  className?: string;
}

export function RecordMetaRow({ fields, className }: RecordMetaRowProps) {
  return (
    <div className={cn("flex items-center gap-6 flex-wrap", className)}>
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {f.label}
          </span>
          <span className="text-sm text-foreground">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordGrid — responsive grid for record detail fields
// ---------------------------------------------------------------------------

interface RecordGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function RecordGrid({ children, cols = 2, className }: RecordGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecordField — single label/value field inside a RecordGrid
// ---------------------------------------------------------------------------

interface RecordFieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export function RecordField({ label, value, mono = false, className }: RecordFieldProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailSheet — side sheet for record drill-in detail
// ---------------------------------------------------------------------------

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "right" | "left";
  size?: "sm" | "md" | "lg" | "xl";
}

export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  size = "md",
}: DetailSheetProps) {
  const widths = {
    sm: "w-80",
    md: "w-[480px]",
    lg: "w-[640px]",
    xl: "w-[800px]",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("flex flex-col p-0 overflow-hidden", widths[size])}>
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

// Re-export data-table primitives from this barrel
export {
  DataTableShell,
  DataTableToolbar,
  DataTableFilters,
  DataTableEmptyState,
  DataTablePagination,
  RowActionsMenu,
  RowSelectionBar,
  RowExpansionRegion,
  RecordSheetTrigger,
} from "./data-table";
