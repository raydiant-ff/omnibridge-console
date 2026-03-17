import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// ============================================================================
// CommandList — divide-y container for CommandRow children
// Used inside CommandSection for priority-based renewal/contract lists.
// ============================================================================

export interface ColumnDef {
  label: string;
  width?: string; // tailwind width class, e.g. "w-[80px]"
  align?: "left" | "center" | "right";
}

interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: ColumnDef[];
}

export function CommandList({
  columns,
  className,
  children,
  ...props
}: CommandListProps) {
  const alignClass = (align?: string) =>
    align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";

  return (
    <div className={cn(className)} {...props}>
      {columns && columns.length > 0 && (
        <div className="flex items-center gap-4 pb-2 mb-1 border-b border-border">
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2.5 shrink-0">
            {columns.map((col) => (
              <div
                key={col.label}
                className={cn(
                  "text-xs font-medium text-muted-foreground",
                  col.width ?? "w-[72px]",
                  alignClass(col.align),
                )}
              >
                {col.label}
              </div>
            ))}
            {/* spacer for status + chevron */}
            <div className="w-3" />
          </div>
        </div>
      )}
      <div className="space-y-1.5 pt-1">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// CommandRow — data row with priority-based visual hierarchy
// ============================================================================

export interface ColumnValue {
  value: string;
  width?: string; // must match corresponding ColumnDef width
  align?: "left" | "center" | "right";
  variant?: "default" | "danger" | "warning" | "success" | "primary";
  bold?: boolean; // override to force bold (e.g. MRR/ARR columns)
}

interface CommandRowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  meta?: string;
  metaVariant?: "danger" | "warning" | "muted";
  value?: string;
  valueLabel?: string;
  columns?: ColumnValue[];
  status?: React.ReactNode;
  priority?: "critical" | "high" | "medium" | "low";
}

export function CommandRow({
  title,
  subtitle,
  meta,
  metaVariant = "danger",
  value,
  valueLabel,
  columns,
  status,
  priority = "medium",
  className,
  ...props
}: CommandRowProps) {
  const metaColor = {
    danger: "text-destructive font-medium",
    warning: "text-warning font-medium",
    muted: "text-muted-foreground",
  }[metaVariant];

  const colVariantColor = {
    default: "",
    danger: "text-destructive",
    warning: "text-warning",
    success: "text-success",
    primary: "text-primary",
  };

  // Legacy single-value classes (used when columns is not provided)
  const valueClass = {
    critical: "text-[15px] font-extrabold text-foreground tabular-nums tracking-tight",
    high: "text-[15px] font-bold text-foreground tabular-nums tracking-tight",
    medium: "text-[14px] font-semibold text-foreground tabular-nums",
    low: "text-[14px] font-semibold text-foreground tabular-nums",
  }[priority];

  const alignClass = (align?: string) =>
    align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 min-h-[44px] py-2.5 px-3",
        "rounded-xl transition-colors",
        "cursor-pointer bg-muted/50 hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      tabIndex={0}
      {...props}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="truncate text-sm font-medium text-foreground">
          {title}
        </span>
        {(subtitle || meta) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {subtitle && (
              <span>{subtitle}</span>
            )}
            {subtitle && meta && <span className="text-border">&middot;</span>}
            {meta && <span className={metaColor}>{meta}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {columns ? (
          columns.map((col, i) => (
            <div
              key={i}
              className={cn(
                "text-[13px] text-foreground tabular-nums",
                col.width ?? "w-[72px]",
                alignClass(col.align),
                col.bold ? "font-semibold" : "font-normal",
                col.variant && col.variant !== "default"
                  ? colVariantColor[col.variant]
                  : "",
              )}
            >
              {col.value}
            </div>
          ))
        ) : value ? (
          <div className="text-right min-w-[52px]">
            <div className={valueClass}>{value}</div>
            {valueLabel && (
              <div className="text-[10px] font-medium text-muted-foreground">
                {valueLabel}
              </div>
            )}
          </div>
        ) : null}
        {status}
        <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </div>
  );
}
