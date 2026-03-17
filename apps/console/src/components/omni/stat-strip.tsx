import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  variant?: "default" | "danger" | "positive";
}

/**
 * StatStrip — compact horizontal metrics bar.
 * Bloomberg density: label + value pairs, no cards, no icons.
 */
export function StatStrip({
  stats,
  className,
}: {
  stats: Stat[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0 divide-x divide-border border border-border bg-card", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex-1 px-5 py-3 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">
            {stat.label}
          </p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums tracking-tight mt-0.5",
              stat.variant === "danger" ? "text-red-600" : stat.variant === "positive" ? "text-emerald-600" : "text-foreground",
            )}
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
