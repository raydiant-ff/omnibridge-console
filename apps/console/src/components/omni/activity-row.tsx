import { cn } from "@/lib/utils";

const SOURCE_STYLES = {
  salesforce: "bg-blue-600",
  stripe: "bg-purple-600",
  system: "bg-foreground",
} as const;

/**
 * ActivityRow — a single event in the unified timeline.
 * Dot color indicates source system. Dense, chronological.
 */
export function ActivityRow({
  source,
  summary,
  timestamp,
  className,
}: {
  source: "salesforce" | "stripe" | "system";
  summary: string;
  timestamp: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      <div className="flex flex-col items-center pt-1.5">
        <span className={cn("size-2 rounded-full shrink-0", SOURCE_STYLES[source])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-foreground leading-tight">{summary}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{timestamp}</p>
      </div>
    </div>
  );
}
