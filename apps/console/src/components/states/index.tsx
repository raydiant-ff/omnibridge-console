import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, LayoutTemplate } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// LoadingBlock — skeleton placeholder for a panel or page region
// ---------------------------------------------------------------------------

interface LoadingBlockProps {
  rows?: number;
  className?: string;
}

export function LoadingBlock({ rows = 3, className }: LoadingBlockProps) {
  return (
    <div className={cn("flex flex-col gap-3 p-5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingRow — single inline skeleton row for list items
// ---------------------------------------------------------------------------

interface LoadingRowProps {
  className?: string;
}

export function LoadingRow({ className }: LoadingRowProps) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-8 rounded-full shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyBlock — no-data state for a panel, list, or table
// ---------------------------------------------------------------------------

interface EmptyBlockProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyBlock({
  title = "No results",
  description,
  action,
  icon,
  className,
}: EmptyBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-6 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBlock — fetch/render failure state
// ---------------------------------------------------------------------------

interface ErrorBlockProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorBlock({
  title = "Something went wrong",
  description = "An error occurred while loading this content.",
  action,
  className,
}: ErrorBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-6 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaceholderBlock — structure placeholder during skeleton build
// Renders a visually obvious "not yet built" region
// ---------------------------------------------------------------------------

interface PlaceholderBlockProps {
  label?: string;
  height?: string;
  className?: string;
}

export function PlaceholderBlock({
  label = "Placeholder",
  height = "h-40",
  className,
}: PlaceholderBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground",
        height,
        className,
      )}
    >
      <LayoutTemplate className="size-5" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
