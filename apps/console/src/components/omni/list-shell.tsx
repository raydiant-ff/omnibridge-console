import { cn } from "@/lib/utils";

/**
 * ListShell — Card container for operational list surfaces.
 *
 * Provides: rounded card border, header with title/count/actions,
 * divided row content, empty state, and footer count.
 */

interface ListShellProps {
  /** Section title */
  title: string;
  /** Result count shown beside the title */
  count?: number;
  /** Total count shown when filtered (e.g. "12 of 50") */
  total?: number;
  /** Right-aligned header controls (filters, actions) */
  actions?: React.ReactNode;
  /** Empty state rendered when children is empty */
  empty?: React.ReactNode;
  /** Whether the list has zero items */
  isEmpty?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ListShell({
  title,
  count,
  total,
  actions,
  empty,
  isEmpty,
  children,
  className,
}: ListShellProps) {
  const countLabel =
    count != null
      ? total != null && total !== count
        ? `${count} of ${total}`
        : `${count}`
      : null;

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {countLabel && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {countLabel} {count === 1 ? "result" : "results"}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Content */}
      {isEmpty ? (
        empty ?? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )
      ) : (
        <div className="divide-y">{children}</div>
      )}
    </div>
  );
}
