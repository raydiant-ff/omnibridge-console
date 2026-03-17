import { cn } from "@/lib/utils";

// ============================================================================
// StatItem — metric display with label, value, optional trend
// ============================================================================

interface StatItemProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down";
  variant?: "default" | "danger" | "success" | "primary";
  size?: "sm" | "lg";
}

export function StatItem({
  label,
  value,
  trend,
  trendDirection,
  variant = "default",
  size = "sm",
}: StatItemProps) {
  const valueColor = {
    default: "text-foreground",
    danger: "text-destructive",
    success: "text-success",
    primary: "text-primary",
  }[variant];

  const sizeClass = {
    sm: "text-2xl font-semibold tracking-tight",
    lg: "text-[32px] font-semibold tracking-[-0.025em] leading-none",
  }[size];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={cn(sizeClass, valueColor)}>{value}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium",
              trendDirection === "up" ? "text-success" : "text-destructive",
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// StatRow — inline label/value pair for stat cards
// ============================================================================

interface StatRowProps {
  label: string;
  value: string | number;
  variant?: "default" | "danger" | "success" | "primary";
}

export function StatRow({ label, value, variant = "default" }: StatRowProps) {
  const valueColor = {
    default: "text-foreground font-semibold",
    danger: "text-destructive font-bold",
    success: "text-success font-bold",
    primary: "text-primary font-bold",
  }[variant];

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("text-[13px] tabular-nums", valueColor)}>
        {value}
      </span>
    </div>
  );
}
