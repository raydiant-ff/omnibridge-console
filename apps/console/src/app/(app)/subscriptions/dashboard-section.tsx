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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      {/* Row 3: Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All Subscriptions</CardTitle>
              <CardDescription>
                {statusFilter !== ALL
                  ? `${filteredSubs.length} of ${totalSubscriptionCount} — ${formatStatusLabel(statusFilter)}`
                  : `Top ${subscriptions.length} of ${totalSubscriptionCount} by MRR`}
              </CardDescription>
            </div>
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
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No subscriptions match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSubs.map((sub) => (
                    <SubscriptionRow key={sub.id} sub={sub} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({ sub }: { sub: DashboardSubscription }) {
  const productSummary =
    sub.items.length <= 2
      ? sub.items.map((i) => i.productName).join(", ")
      : `${sub.items[0].productName} +${sub.items.length - 1} more`;

  return (
    <TableRow>
      <TableCell className="max-w-[200px] truncate font-medium">
        {sub.customerName}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE_VARIANT[sub.status] ?? "outline"}>
          {formatStatusLabel(sub.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatCurrency(sub.mrr)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(sub.currentPeriodEnd)}
      </TableCell>
      <TableCell className="text-sm">
        {formatCollectionMethod(sub.collectionMethod)}
      </TableCell>
      <TableCell
        className="max-w-[200px] truncate text-sm text-muted-foreground"
        title={sub.items.map((i) => i.productName).join(", ")}
      >
        {productSummary}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
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
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(sub.created)}
      </TableCell>
    </TableRow>
  );
}
