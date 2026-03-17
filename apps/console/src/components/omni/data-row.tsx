import { cn } from "@/lib/utils";

/**
 * DataRow — a labeled key-value row for detail sections.
 * Tight, no icons, just label and value.
 */
export function DataRow({
  label,
  value,
  mono,
  variant,
  className,
}: {
  label: string;
  value: string | React.ReactNode;
  mono?: boolean;
  variant?: "default" | "danger" | "positive" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2 border-b border-border/50 last:border-b-0", className)}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[13px] font-medium text-right",
          mono && "font-mono tabular-nums",
          variant === "danger" ? "text-red-600" : variant === "positive" ? "text-emerald-600" : variant === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
