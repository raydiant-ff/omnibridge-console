"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type {
  SubscriptionDashboardData,
  DashboardSubscription,
} from "@/lib/queries/subscriptions-dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon,
  XCircle,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#9333ea",
  "#f59e0b",
  "#64748b",
];

const STATUS_COLOR: Record<string, string> = {
  active: "var(--chart-1)",
  past_due: "var(--chart-4)",
  trialing: "var(--chart-3)",
  canceled: "#64748b",
  incomplete: "var(--chart-5)",
  incomplete_expired: "#94a3b8",
  paused: "#f59e0b",
  unpaid: "#ef4444",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  past_due: "destructive",
  trialing: "secondary",
  canceled: "outline",
  incomplete: "secondary",
  incomplete_expired: "outline",
  paused: "secondary",
  unpaid: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCollectionMethod(method: string): string {
  return method === "send_invoice" ? "Invoice" : "Auto-charge";
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const name = String(props.name ?? "");
  const percent = Number(props.percent ?? 0);
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-xs font-semibold"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

const ALL = "__all__";

export function SubscriptionsDashboard() {
  const [data, setData] = useState<SubscriptionDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscriptions-dashboard")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load subscription data.");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  return <DashboardContent data={data} />;
}

function DashboardContent({ data }: { data: SubscriptionDashboardData }) {
  const { kpis, statusBreakdown, collectionBreakdown, subscriptions, totalSubscriptionCount } = data;
  const [statusFilter, setStatusFilter] = useState(ALL);

  const filteredSubs = useMemo(
    () =>
      statusFilter === ALL
        ? subscriptions
        : subscriptions.filter((s) => s.status === statusFilter),
    [subscriptions, statusFilter],
  );

  const sortedSubs = useMemo(
    () => [...filteredSubs].sort((a, b) => b.mrr - a.mrr),
    [filteredSubs],
  );

  const statuses = useMemo(
    () => Array.from(new Set(subscriptions.map((s) => s.status))).sort(),
    [subscriptions],
  );

  const pieData = useMemo(
    () =>
      statusBreakdown
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: formatStatusLabel(s.status),
          value: s.count,
          color: STATUS_COLOR[s.status] ?? CHART_COLORS[0],
        })),
    [statusBreakdown],
  );

  const barData = useMemo(
    () =>
      collectionBreakdown.map((c) => ({
        name: formatCollectionMethod(c.method),
        subscriptions: c.count,
        mrr: c.mrr / 100,
      })),
    [collectionBreakdown],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Active MRR"
          value={formatCompactCurrency(kpis.activeMrr)}
          subtitle={`${kpis.activeCount} active subscription${kpis.activeCount !== 1 ? "s" : ""}`}
          icon={<DollarSign className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Past Due"
          value={String(kpis.pastDueCount)}
          subtitle={`${formatCurrency(kpis.pastDueRevenue)} at risk`}
          icon={<AlertTriangle className="size-4 text-red-500" />}
          variant={kpis.pastDueCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="Churning"
          value={String(kpis.churningCount)}
          subtitle={`${formatCurrency(kpis.churningRevenue)} MRR impact`}
          icon={<TrendingDown className="size-4 text-amber-500" />}
          variant={kpis.churningCount > 0 ? "destructive" : "default"}
        />
        <KpiCard
          title="Trialing"
          value={String(kpis.trialingCount)}
          subtitle={
            kpis.trialingCount > 0
              ? `~${kpis.avgTrialDaysRemaining}d avg remaining`
              : "No active trials"
          }
          icon={<Zap className="size-4 text-muted-foreground" />}
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>
              Subscription count by current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${Number(value) || 0}`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No subscriptions found.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Collection Method Split
            </CardTitle>
            <CardDescription>
              Auto-charge vs Invoice — count and MRR
            </CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" barCategoryGap={12}>
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const v = Number(value) || 0;
                      if (name === "mrr")
                        return [`$${v.toLocaleString()}`, "MRR"];
                      return [v, "Subscriptions"];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="mrr"
                    name="MRR ($)"
                    fill="var(--chart-1)"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="subscriptions"
                    name="Count"
                    fill="var(--chart-3)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Subscriptions List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {statusFilter !== ALL
                ? `${filteredSubs.length} of ${totalSubscriptionCount} Subscriptions — ${formatStatusLabel(statusFilter)}`
                : `Top ${subscriptions.length} of ${totalSubscriptionCount} by MRR`}
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedSubs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No subscriptions match the current filter.
            </div>
          ) : (
            <div className="divide-y">
              {sortedSubs.map((sub) => (
                <SubscriptionRow key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Subcomponents ──

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  variant?: "default" | "warning" | "destructive";
}) {
  const borderClass =
    variant === "warning"
      ? "border-amber-500/30"
      : variant === "destructive"
        ? "border-destructive/30"
        : "";

  return (
    <Card className={borderClass}>
      <CardContent className="flex items-start gap-4 pt-5">
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function subStatusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="size-5 text-emerald-500" />;
    case "past_due":
    case "unpaid":
      return <AlertTriangleIcon className="size-5 text-red-400" />;
    case "canceled":
      return <XCircle className="size-5 text-muted-foreground" />;
    default:
      return <Clock className="size-5 text-muted-foreground" />;
  }
}

function subTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function SubscriptionRow({ sub }: { sub: DashboardSubscription }) {
  const productSummary =
    sub.items.length <= 2
      ? sub.items.map((i) => i.productName).join(", ")
      : `${sub.items[0].productName} +${sub.items.length - 1} more`;

  return (
    <div className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 group">
      {/* Status icon */}
      <div className="shrink-0">
        {subStatusIcon(sub.status)}
      </div>

      {/* Primary info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[200px]">
            {sub.customerName}
          </span>
          <span className="text-xs font-mono font-medium text-foreground tabular-nums">
            {formatCurrency(sub.mrr)}
          </span>
          <Badge variant={STATUS_BADGE_VARIANT[sub.status] ?? "outline"} className="text-[10px]">
            {formatStatusLabel(sub.status)}
          </Badge>
          {sub.cancelAtPeriodEnd && (
            <Badge variant="destructive" className="text-[10px]">
              Canceling
            </Badge>
          )}
          {sub.hasSchedule && (
            <Badge variant="secondary" className="text-[10px]">
              Scheduled
            </Badge>
          )}
          {sub.hasDiscount && (
            <Badge variant="secondary" className="text-[10px]">
              Discount
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <span>{formatCollectionMethod(sub.collectionMethod)}</span>
          <span>&middot;</span>
          <span title={sub.items.map((i) => i.productName).join(", ")} className="truncate max-w-[300px]">
            {productSummary}
          </span>
          <span>&middot;</span>
          <span>ends {formatDate(sub.currentPeriodEnd)}</span>
        </div>
      </div>

      {/* Right metadata */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {subTimeAgo(sub.created)}
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
