import { StatStrip } from "@/components/omni";
import { cn } from "@/lib/utils";
import type { RenewalsSummary } from "@/lib/queries/cs-renewals";

function fmtCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

interface RenewalsKpiStripProps {
  summary: RenewalsSummary;
  overdueCount: number;
  overdueMrr: number;
  dueTodayCount: number;
  dueSoonCount: number;
  onTrackCount: number;
  isPending?: boolean;
}

export function RenewalsKpiStrip({
  summary,
  overdueCount,
  overdueMrr,
  dueTodayCount,
  dueSoonCount,
  onTrackCount,
  isPending,
}: RenewalsKpiStripProps) {
  const atRiskMrr = overdueMrr + summary.cancellingMrr;

  const stats = [
    { label: "MRR", value: fmtCompact(summary.totalMrr) },
    { label: "ARR", value: fmtCompact(summary.totalMrr * 12) },
    { label: "Contracts", value: String(summary.total) },
    {
      label: "At risk",
      value: atRiskMrr > 0 ? fmtCompact(atRiskMrr) : "—",
      variant: atRiskMrr > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "Overdue",
      value: String(overdueCount),
      variant: overdueCount > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "Due today",
      value: String(dueTodayCount),
      variant: dueTodayCount > 0 ? ("danger" as const) : undefined,
    },
    { label: "Due soon", value: String(dueSoonCount) },
    {
      label: "On track",
      value: String(onTrackCount),
      variant: onTrackCount > 0 ? ("positive" as const) : undefined,
    },
  ];

  return (
    <StatStrip
      stats={stats}
      className={cn(
        "rounded-xl",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}
    />
  );
}
