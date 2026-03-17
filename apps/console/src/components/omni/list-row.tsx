import { cn } from "@/lib/utils";

/**
 * ListRow — Composable row for operational list surfaces.
 *
 * Slot layout: [icon] [content (flex-1)] [value] [meta] [actions]
 * Supports click navigation, hover affordance, and selected state.
 */

interface ListRowProps {
  /** Leading icon or avatar slot */
  icon?: React.ReactNode;
  /** Primary content area (name, badges, metadata) — fills available space */
  children: React.ReactNode;
  /** Commercial value slot (MRR, amount, ARR) — right of content */
  value?: React.ReactNode;
  /** Trailing metadata (time, owner) — right of value */
  meta?: React.ReactNode;
  /** Action controls (buttons, menus) — far right */
  actions?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Whether this row is visually selected */
  selected?: boolean;
  /** Compact density variant */
  compact?: boolean;
  className?: string;
}

export function ListRow({
  icon,
  children,
  value,
  meta,
  actions,
  onClick,
  selected,
  compact,
  className,
}: ListRowProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={cn(
        "flex items-center gap-4 transition-colors group",
        compact ? "px-4 py-2.5" : "px-6 py-4",
        onClick && "cursor-pointer",
        selected ? "bg-muted/50" : onClick ? "hover:bg-muted/40" : undefined,
        className,
      )}
    >
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">{children}</div>
      {value && <div className="shrink-0">{value}</div>}
      {meta && <div className="flex items-center gap-4 shrink-0">{meta}</div>}
      {actions && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * ListRowTitle — Primary identity line within a ListRow.
 */
export function ListRowTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {children}
    </div>
  );
}

/**
 * ListRowDetail — Secondary metadata line within a ListRow.
 */
export function ListRowDetail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
