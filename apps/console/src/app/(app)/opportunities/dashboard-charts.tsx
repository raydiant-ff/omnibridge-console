"use client";

import { useMemo, useState } from "react";
import {
  DollarSign,
  CheckCircle,
  Target,
  AlertTriangle,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@omnibridge/ui";
import { Button } from "@/components/ui/button";
import type { OpportunityRow } from "@/lib/queries/opportunities";

/* ─── Helpers ─── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

const STAGE_COLORS: Record<string, string> = {
  "Discovery & Qualification": "oklch(0.65 0.15 155)",
  "Customer Evaluation": "oklch(0.55 0.18 250)",
  "Pricing & Negotiation": "oklch(0.7 0.15 60)",
  "Contract Sent": "oklch(0.65 0.18 280)",
  "Closed Won": "oklch(0.55 0.15 155)",
  "Closed Lost": "oklch(0.55 0.01 250)",
};

const STAGE_ORDER = [
  "Discovery & Qualification",
  "Customer Evaluation",
  "Pricing & Negotiation",
  "Contract Sent",
  "Closed Won",
  "Closed Lost",
];

const BAR_PALETTE = [
  "oklch(0.55 0.18 250)",  // blue
  "oklch(0.65 0.15 155)",  // green
  "oklch(0.7 0.15 60)",    // amber
  "oklch(0.65 0.18 280)",  // purple
  "oklch(0.7 0.18 350)",   // pink
  "oklch(0.55 0.15 200)",  // teal
  "oklch(0.6 0.12 30)",    // orange
  "oklch(0.5 0.15 300)",   // violet
  "oklch(0.65 0.1 120)",   // lime
  "oklch(0.55 0.12 180)",  // cyan
];

function stageColor(stage: string): string {
  return STAGE_COLORS[stage] ?? "oklch(0.55 0.01 250)";
}

function stageBadgeClasses(stage: string): string {
  switch (stage) {
    case "Closed Won":
      return "bg-success/10 text-success";
    case "Closed Lost":
      return "bg-destructive/10 text-destructive";
    case "Contract Sent":
      return "bg-purple-500/10 text-purple-600";
    case "Pricing & Negotiation":
      return "bg-amber-500/10 text-amber-600";
    case "Customer Evaluation":
      return "bg-blue-500/10 text-blue-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ─── Main ─── */

interface DashboardChartsProps {
  opportunities: OpportunityRow[];
}

export function DashboardCharts({ opportunities }: DashboardChartsProps) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;

  const ytdOpps = useMemo(
    () => opportunities.filter((o) => o.createdDate >= yearStart),
    [opportunities, yearStart],
  );

  const closedWonYtd = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName === "Closed Won" && o.closeDate >= yearStart,
      ),
    [opportunities, yearStart],
  );

  const closedLostYtd = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName === "Closed Lost" && o.closeDate >= yearStart,
      ),
    [opportunities, yearStart],
  );

  const openOpps = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName !== "Closed Won" && o.stageName !== "Closed Lost",
      ),
    [opportunities],
  );

  const totalRevenue = useMemo(
    () => closedWonYtd.reduce((s, o) => s + (o.amount ?? 0), 0),
    [closedWonYtd],
  );

  const openPipeline = useMemo(
    () => openOpps.reduce((s, o) => s + (o.amount ?? 0), 0),
    [openOpps],
  );

  const winRate = useMemo(() => {
    const total = closedWonYtd.length + closedLostYtd.length;
    if (total === 0) return 0;
    return (closedWonYtd.length / total) * 100;
  }, [closedWonYtd, closedLostYtd]);

  const overdueCount = useMemo(
    () => openOpps.filter((o) => new Date(o.closeDate) < new Date()).length,
    [openOpps],
  );

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          iconBg="bg-success/10"
          iconColor="text-success"
          label="Closed Won Revenue"
          value={formatCompactCurrency(totalRevenue)}
          subtitle={`${closedWonYtd.length} deals in ${currentYear}`}
        />
        <MetricCard
          icon={Target}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          label="Open Pipeline"
          value={formatCompactCurrency(openPipeline)}
          subtitle={`${openOpps.length} open opportunities`}
        />
        <MetricCard
          icon={CheckCircle}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          label="Win Rate"
          value={`${winRate.toFixed(0)}%`}
          subtitle={`${closedWonYtd.length}W / ${closedLostYtd.length}L this year`}
        />
        <MetricCard
          icon={AlertTriangle}
          iconBg={overdueCount > 0 ? "bg-destructive/10" : "bg-success/10"}
          iconColor={overdueCount > 0 ? "text-destructive" : "text-success"}
          label="Overdue"
          value={String(overdueCount)}
          subtitle={overdueCount > 0 ? "Past close date" : "All on track"}
        />
      </div>

      {/* Pipeline by Stage (chart) + Top Customers (list) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-card rounded-2xl p-6 border border-border card-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Pipeline by Stage</h3>
              <p className="text-sm text-muted-foreground">Revenue distribution across stages &mdash; {currentYear} YTD</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {STAGE_ORDER.filter(s => s !== "Closed Lost").map((stage) => (
                <div key={stage} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageColor(stage) }} />
                  <span className="text-muted-foreground">{stage.replace("Discovery & Qualification", "Discovery").replace("Customer Evaluation", "Evaluation").replace("Pricing & Negotiation", "Negotiation")}</span>
                </div>
              ))}
            </div>
          </div>
          <PipelineByStageChart opps={ytdOpps} />
        </div>

        <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">Top Customers</h3>
            <span className="px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-full">
              {currentYear} YTD
            </span>
          </div>
          <TopCustomersList opps={closedWonYtd} />
        </div>
      </div>

      {/* Closed Won by Operator + Expiration Calendar — side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground">Closed Won by Operator</h3>
            <p className="text-sm text-muted-foreground">Revenue leaderboard &mdash; {currentYear} YTD</p>
          </div>
          <ClosedWonByOperatorChart opps={closedWonYtd} />
        </div>
        <ExpirationCalendar opps={openOpps} />
      </div>
    </div>
  );
}

/* ─── Metric Card ─── */

function MetricCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border card-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground mb-1">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ─── Pipeline by Stage Chart ─── */

function PipelineByStageChart({ opps }: { opps: OpportunityRow[] }) {
  const data = useMemo(() => {
    const byStage = new Map<string, { count: number; revenue: number }>();
    for (const o of opps) {
      if (o.stageName === "Closed Lost") continue;
      const prev = byStage.get(o.stageName) ?? { count: 0, revenue: 0 };
      byStage.set(o.stageName, {
        count: prev.count + 1,
        revenue: prev.revenue + (o.amount ?? 0),
      });
    }
    return STAGE_ORDER.filter(s => s !== "Closed Lost")
      .map((stage) => ({
        stage: stage.replace("Discovery & Qualification", "Discovery").replace("Customer Evaluation", "Evaluation").replace("Pricing & Negotiation", "Negotiation"),
        revenue: byStage.get(stage)?.revenue ?? 0,
        count: byStage.get(stage)?.count ?? 0,
        fill: stageColor(stage),
      }))
      .filter((d) => d.count > 0);
  }, [opps]);

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No opportunities yet.
      </div>
    );
  }

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" vertical={false} />
          <XAxis
            dataKey="stage"
            tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
            axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCompactCurrency(v)}
            tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
            axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid oklch(0.92 0.005 250)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value, name) => {
              if (name === "revenue") return [formatCurrency(Number(value)), "Revenue"];
              return [String(value), String(name)];
            }}
          />
          <Bar
            dataKey="revenue"
            radius={[6, 6, 0, 0]}
            label={{
              position: "top",
              formatter: (v: number) => formatCompactCurrency(v),
              fontSize: 11,
              fill: "oklch(0.55 0.01 250)",
            }}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Closed Won by Operator (colored bars, taller) ─── */

function ClosedWonByOperatorChart({ opps }: { opps: OpportunityRow[] }) {
  const data = useMemo(() => {
    const byOwner = new Map<string, { total: number; count: number }>();
    for (const o of opps) {
      const owner = o.ownerName ?? "Unknown";
      const prev = byOwner.get(owner) ?? { total: 0, count: 0 };
      byOwner.set(owner, {
        total: prev.total + (o.amount ?? 0),
        count: prev.count + 1,
      });
    }
    return Array.from(byOwner.entries())
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [opps]);

  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
        No closed-won deals yet this year.
      </div>
    );
  }

  const chartHeight = Math.max(300, data.length * 48);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCompactCurrency(v)}
            tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
            axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
            axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
            width={120}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid oklch(0.92 0.005 250)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value) => [formatCurrency(Number(value) || 0), "Revenue"]}
            labelFormatter={(label) => String(label)}
          />
          <Bar
            dataKey="total"
            radius={[0, 6, 6, 0]}
            label={{
              position: "right",
              formatter: (v: number) => formatCompactCurrency(v),
              fontSize: 12,
              fill: "oklch(0.55 0.01 250)",
            }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Top Customers List (v0 rich list style) ─── */

function TopCustomersList({ opps }: { opps: OpportunityRow[] }) {
  const data = useMemo(() => {
    const byAccount = new Map<string, { name: string; total: number; count: number }>();
    for (const o of opps) {
      const key = o.accountId ?? o.accountName ?? o.name;
      const name = o.accountName ?? "Unknown";
      const prev = byAccount.get(key) ?? { name, total: 0, count: 0 };
      byAccount.set(key, {
        name,
        total: prev.total + (o.amount ?? 0),
        count: prev.count + 1,
      });
    }
    return Array.from(byAccount.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [opps]);

  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
        No closed-won deals yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
      {data.map((row, i) => (
        <div
          key={row.name}
          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.count} deal{row.count !== 1 ? "s" : ""}</p>
          </div>
          <p className="text-sm font-mono font-semibold text-foreground shrink-0">
            {formatCompactCurrency(row.total)}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Expiration Calendar (month-switchable, top 20 opps) ─── */

function ExpirationCalendar({ opps }: { opps: OpportunityRow[] }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  // Collect all months that have open opps
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const o of opps) {
      const d = new Date(o.closeDate);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(set).sort();
  }, [opps]);

  // Navigate months
  const currentIdx = availableMonths.indexOf(selectedMonth);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < availableMonths.length - 1;

  function goMonth(dir: -1 | 1) {
    const nextIdx = currentIdx + dir;
    if (nextIdx >= 0 && nextIdx < availableMonths.length) {
      setSelectedMonth(availableMonths[nextIdx]);
    }
  }

  // Filter opps for selected month, sorted by close date, top 20
  const monthOpps = useMemo(() => {
    return opps
      .filter((o) => {
        const d = new Date(o.closeDate);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return mk === selectedMonth;
      })
      .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
      .slice(0, 20);
  }, [opps, selectedMonth]);

  const totalCount = opps.filter((o) => {
    const d = new Date(o.closeDate);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return mk === selectedMonth;
  }).length;

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  // Format selected month label
  const [sy, sm] = selectedMonth.split("-");
  const monthDisplay = new Date(Number(sy), Number(sm) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-card rounded-2xl p-6 border border-border card-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Expiration Calendar</h3>
          <p className="text-sm text-muted-foreground">Open opps closing this month</p>
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 rounded-full">
          {totalCount} total
        </span>
      </div>

      {/* Month switcher */}
      <div className="flex items-center justify-between mb-4 rounded-xl bg-muted px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canPrev}
          onClick={() => goMonth(-1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">{monthDisplay}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!canNext}
          onClick={() => goMonth(1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {monthOpps.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No open opps closing in {monthDisplay}.
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {monthOpps.map((opp) => (
            <div
              key={opp.id}
              className={cn(
                "rounded-xl border p-3 text-sm transition-colors",
                isPast(opp.closeDate)
                  ? "border-destructive/40 bg-destructive/5"
                  : "bg-muted/30 border-border hover:bg-muted/50",
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium text-foreground line-clamp-1 flex-1 mr-2" title={opp.name}>
                  {opp.name}
                </p>
                <span className="font-mono text-xs text-foreground shrink-0">
                  {opp.amount !== null ? formatCompactCurrency(opp.amount) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{opp.accountName ?? "No account"}</span>
                {opp.ownerName && (
                  <>
                    <span className="text-border">|</span>
                    <span className="truncate">{opp.ownerName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded-full",
                  stageBadgeClasses(opp.stageName),
                )}>
                  {opp.stageName}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span className={cn(isPast(opp.closeDate) && "text-destructive font-medium")}>
                    {new Date(opp.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {isPast(opp.closeDate) && " (overdue)"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {totalCount > 20 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Showing 20 of {totalCount} opportunities
            </p>
          )}
        </div>
      )}
    </div>
  );
}
