import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  variant?: "default" | "danger" | "positive";
  meta?: string;
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
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8",
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-h-[156px] min-w-0 flex-col rounded-2xl border border-border/80 bg-card px-5 py-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {stat.label}
          </p>
          <p
            className={cn(
              "mt-5 text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.04em]",
              stat.variant === "danger" ? "text-red-600" : stat.variant === "positive" ? "text-emerald-600" : "text-foreground",
            )}
          >
            {stat.value}
          </p>
          {stat.meta && (
            <p className="mt-auto pt-4 text-[11px] font-medium leading-relaxed text-muted-foreground">
              {stat.meta}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
