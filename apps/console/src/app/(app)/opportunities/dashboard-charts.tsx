"use client";

import { useMemo, useState } from "react";
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
import type { OpportunityRow } from "@/lib/queries/opportunities";
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

const STAGE_COLOR: Record<string, string> = {
  "Discovery & Qualification": "var(--chart-3)",
  "Customer Evaluation": "var(--chart-5)",
  "Pricing & Negotiation": "var(--chart-4)",
  "Contract Sent": "var(--chart-2)",
  "Closed Won": "var(--chart-1)",
  "Closed Lost": "#64748b",
};

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

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const cx = (props.cx as number) ?? 0;
  const cy = (props.cy as number) ?? 0;
  const midAngle = (props.midAngle as number) ?? 0;
  const outerRadius = (props.outerRadius as number) ?? 0;
  const name = (props.name as string) ?? "";
  const percent = (props.percent as number) ?? 0;

  const radius = outerRadius + 32;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: 12,
        fill: "#171717",
      }}
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabelLine(props: any) {
  const cx = (props.cx as number) ?? 0;
  const cy = (props.cy as number) ?? 0;
  const midAngle = (props.midAngle as number) ?? 0;
  const outerRadius = (props.outerRadius as number) ?? 0;
  const stroke = (props.stroke as string) ?? "#999";

  const innerPt = {
    x: cx + (outerRadius + 4) * Math.cos(-midAngle * RADIAN),
    y: cy + (outerRadius + 4) * Math.sin(-midAngle * RADIAN),
  };
  const outerPt = {
    x: cx + (outerRadius + 26) * Math.cos(-midAngle * RADIAN),
    y: cy + (outerRadius + 26) * Math.sin(-midAngle * RADIAN),
  };
  return (
    <line
      x1={innerPt.x}
      y1={innerPt.y}
      x2={outerPt.x}
      y2={outerPt.y}
      stroke={stroke}
      strokeWidth={1.5}
    />
  );
}

const ALL = "__all__";

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

  const openOpps = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName !== "Closed Won" && o.stageName !== "Closed Lost",
      ),
    [opportunities],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StagesPieChart opps={ytdOpps} year={currentYear} />
        <div className="flex flex-col gap-6">
          <RevenueCard opps={closedWonYtd} year={currentYear} />
          <TopCustomers opps={closedWonYtd} year={currentYear} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClosedWonByOperator opps={closedWonYtd} year={currentYear} />
        <ExpirationBoard opps={openOpps} />
      </div>
    </div>
  );
}

function StagesPieChart({ opps, year }: { opps: OpportunityRow[]; year: number }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of opps) {
      counts.set(o.stageName, (counts.get(o.stageName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [opps]);

  const total = opps.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunities by Stage</CardTitle>
        <CardDescription>
          {total} opportunities created in {year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
            No opportunities yet this year.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={520}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={180}
                paddingAngle={1}
                dataKey="value"
                label={renderPieLabel}
                labelLine={renderPieLabelLine}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={STAGE_COLOR[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const v = Number(value) || 0;
                  return [`${v} (${((v / total) * 100).toFixed(1)}%)`, String(name)];
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span style={{ color: "#171717", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600 }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ClosedWonByOperator({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Closed Won by Operator</CardTitle>
        <CardDescription>
          Revenue leaderboard &mdash; {year} YTD
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No closed-won deals yet this year.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, data.length * 50)}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompactCurrency(v)}
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value) || 0), "Revenue"]}
                labelFormatter={(label) => String(label)}
              />
              <Bar
                dataKey="total"
                fill="var(--chart-1)"
                radius={[0, 4, 4, 0]}
                label={{
                  position: "right",
                  formatter: (v) => formatCompactCurrency(Number(v) || 0),
                  fontSize: 12,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ExpirationBoard({ opps }: { opps: OpportunityRow[] }) {
  const [ownerFilter, setOwnerFilter] = useState(ALL);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const o of opps) {
      if (o.ownerName) set.add(o.ownerName);
    }
    return Array.from(set).sort();
  }, [opps]);

  const filtered = useMemo(
    () =>
      ownerFilter === ALL
        ? opps
        : opps.filter((o) => o.ownerName === ownerFilter),
    [opps, ownerFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    for (const o of filtered) {
      const key = monthKey(o.closeDate);
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        items: items.sort((a, b) => a.closeDate.localeCompare(b.closeDate)),
      }));
  }, [filtered]);

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Opportunity Expiration Calendar</CardTitle>
            <CardDescription>
              Open opportunities grouped by close date month
            </CardDescription>
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Operators</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No open opportunities to display.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {grouped.map((col) => (
              <div
                key={col.key}
                className="flex w-[260px] flex-shrink-0 flex-col gap-2"
              >
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary">{col.items.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {col.items.map((opp) => (
                    <div
                      key={opp.id}
                      className={`rounded-md border p-3 text-sm ${
                        isPast(opp.closeDate)
                          ? "border-destructive/40 bg-destructive/5"
                          : "bg-card"
                      }`}
                    >
                      <p
                        className="font-medium leading-tight"
                        title={opp.name}
                      >
                        {opp.name.length > 35
                          ? opp.name.slice(0, 35) + "..."
                          : opp.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {opp.accountName ?? "No account"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {opp.stageName}
                        </Badge>
                        <span className="font-mono text-xs">
                          {opp.amount !== null
                            ? formatCompactCurrency(opp.amount)
                            : "-"}
                        </span>
                      </div>
                      {opp.ownerName && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {opp.ownerName}
                        </p>
                      )}
                      {isPast(opp.closeDate) && (
                        <p className="mt-1 text-[10px] font-medium text-destructive">
                          Overdue &mdash;{" "}
                          {new Date(opp.closeDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopCustomers({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
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
      .slice(0, 20);
  }, [opps]);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Top 20 Customers &mdash; Closed Won</CardTitle>
        <CardDescription>By revenue in {year} YTD</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            No closed-won deals yet.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={row.name}>
                    <TableCell className="text-center text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueCard({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
  const { totalRevenue, dealCount, avgDealSize } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const o of opps) {
      total += o.amount ?? 0;
      count++;
    }
    return {
      totalRevenue: total,
      dealCount: count,
      avgDealSize: count > 0 ? total / count : 0,
    };
  }, [opps]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Revenue YTD</CardTitle>
        <CardDescription>Closed-won revenue in {year}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            from {dealCount} closed{dealCount === 1 ? " deal" : " deals"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Avg Deal Size
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(avgDealSize)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Deals Closed
            </p>
            <p className="mt-1 text-lg font-semibold">{dealCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
