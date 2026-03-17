import { cn } from "@/lib/utils";

/**
 * ReviewPanel — Summary/review surface for quote/subscription/confirmation steps.
 *
 * Supports grouped summary rows with emphasis on totals and terms.
 */

interface ReviewPanelProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ReviewPanel({ title, children, footer, className }: ReviewPanelProps) {
  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="px-6 py-3 border-b">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>
      <div className="px-6 py-4 space-y-1">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t bg-muted/30">{footer}</div>
      )}
    </div>
  );
}

/**
 * ReviewRow — Key/value line inside a ReviewPanel.
 */
export function ReviewRow({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={cn("text-sm", emphasis ? "font-medium text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}
