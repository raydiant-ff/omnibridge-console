import { StatStrip } from "@/components/omni";
import { cn } from "@/lib/utils";
import type { RenewalsSummary } from "@/lib/omni/adapters/renewals";

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
    {
      label: "MRR",
      value: fmtCompact(summary.totalMrr),
      meta: "Renewal pipeline recurring revenue",
    },
    {
      label: "ARR",
      value: fmtCompact(summary.totalMrr * 12),
      meta: "Annualized renewal value",
    },
    {
      label: "Contracts",
      value: String(summary.total),
      meta: `${summary.cancellingCount} canceling`,
    },
    {
      label: "At risk",
      value: atRiskMrr > 0 ? fmtCompact(atRiskMrr) : "—",
      meta: overdueCount > 0 ? `${overdueCount} overdue contracts` : "No overdue contracts",
      variant: atRiskMrr > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "Overdue",
      value: String(overdueCount),
      meta: overdueMrr > 0 ? `${fmtCompact(overdueMrr)} MRR` : "Current month clean",
      variant: overdueCount > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "Due today",
      value: String(dueTodayCount),
      meta: "Contracts due immediately",
      variant: dueTodayCount > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "Due soon",
      value: String(dueSoonCount),
      meta: "Next 7 days",
    },
    {
      label: "On track",
      value: String(onTrackCount),
      meta: "Beyond the urgent window",
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
