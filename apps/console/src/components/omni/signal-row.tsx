import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  critical: "border-l-red-600 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10",
  info: "border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10",
  positive: "border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10",
} as const;

const SEVERITY_DOT = {
  critical: "bg-red-600",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  positive: "bg-emerald-500",
} as const;

/**
 * SignalRow — an actionable signal indicator.
 * Left border colored by severity. Dense, scannable.
 */
export function SignalRow({
  severity,
  label,
  detail,
  className,
}: {
  severity: "critical" | "warning" | "info" | "positive";
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-l-[3px] px-3.5 py-2.5",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full shrink-0", SEVERITY_DOT[severity])} />
        <span className="text-[13px] font-semibold text-foreground leading-tight">{label}</span>
      </div>
      {detail && (
        <p className="text-[12px] text-muted-foreground mt-0.5 pl-3.5">{detail}</p>
      )}
    </div>
  );
}
