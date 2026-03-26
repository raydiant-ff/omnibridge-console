"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpDown,
  AlertTriangle,
  Flag,
  CheckCircle2,
  X,
  ChevronRight,
  Activity,
  DollarSign,
  AlertOctagon,
  GitBranch,
  Building2,
  CreditCard,
  FileText,
  Receipt,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableShell } from "@/components/workspace/table-shell";
import type {
  CsDashboardData,
  PriorityAccountRow,
  OpportunityContainer,
  QuotesContainer,
  SubscriptionsContainer,
  InvoicesContainer,
  ContractContainer,
  PaymentsContainer,
  AccountSnapshot,
} from "./types";
import { fetchAccountSnapshot } from "./actions";
import type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";
import type { OmniAccountSummary } from "@/lib/omni/contracts";

function fmt(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${d.toFixed(0)}`;
}

type SignalFilter =
  | null
  | "need_attention"
  | "billing_risk"
  | "lifecycle_breaks"
  | "at_risk";

type ObjectFilter =
  | null
  | "sub_past_due"
  | "sub_canceling"
  | "inv_past_due"
  | "inv_uncollectible"
  | "inv_open"
  | "contract_no_sub"
  | "contract_ending"
  | "pay_failed"
  | "quote_no_contract"
  | "quote_no_sub"
  | "opp_no_contract";

function titleCase(input: string) {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TopCommandBand({
  banner,
  trust,
  active,
  onSelect,
}: {
  banner: CsDashboardData["banner"];
  trust: WorkspaceTrustSummary;
  active: SignalFilter;
  onSelect: (f: SignalFilter) => void;
}) {
  const toggle = (f: SignalFilter) => onSelect(active === f ? null : f);
  const staleCount = trust.freshness.sources.filter(
    (s) => s.freshness.state === "stale" || s.freshness.state === "degraded",
  ).length;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <CommandMetric
            label="Accounts"
            value={banner.accounts.toLocaleString()}
            icon={<Activity className="size-4" />}
            meta={[
              `Active Salesforce accounts · ${banner.activeSalesforceAccounts.toLocaleString()}`,
              `Active Stripe customers · ${banner.activeStripeCustomers.toLocaleString()}`,
              `Mismatch · ${banner.accountMismatchCount.toLocaleString()} / ${banner.accountMismatchPct.toFixed(1)}%`,
            ]}
          />
          <CommandMetric
            label="Total MRR"
            value={fmt(banner.totalMrrCents)}
            icon={<DollarSign className="size-4" />}
            meta={["Stripe licensed MRR", "Active + past due subscriptions"]}
          />
          <CommandMetric
            label="Total ARR"
            value={fmt(banner.totalArrCents)}
            icon={<DollarSign className="size-4" />}
            meta={["Annualized from Stripe MRR", "Active + past due subscriptions"]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <CommandMetric
            label="Need Attention"
            value={banner.needAttention.toLocaleString()}
            tone="danger"
            active={active === "need_attention"}
            icon={<AlertTriangle className="size-4" />}
            onClick={() => toggle("need_attention")}
            meta={
              banner.topConcerns.length > 0
                ? banner.topConcerns.slice(0, 3).map((concern) => `${concern.label} · ${concern.count}`)
                : ["No major risk clusters"]
            }
          />
          <CommandMetric
            label="At Risk ARR"
            value={fmt(banner.atRiskArrCents)}
            tone="danger"
            active={active === "at_risk"}
            icon={<AlertOctagon className="size-4" />}
            onClick={() => toggle("at_risk")}
            meta={[banner.atRiskLabel]}
          />
          <CommandMetric
            label="Billing Risk"
            value={banner.billingRisk.toLocaleString()}
            tone="danger"
            active={active === "billing_risk"}
            icon={<AlertTriangle className="size-4" />}
            onClick={() => toggle("billing_risk")}
            meta={["Past due invoices, delinquent customers", "and collection failures"]}
          />
          <CommandMetric
            label="Lifecycle Breaks"
            value={banner.lifecycleBreaks.toLocaleString()}
            tone="danger"
            active={active === "lifecycle_breaks"}
            icon={<GitBranch className="size-4" />}
            onClick={() => toggle("lifecycle_breaks")}
            meta={["Subscription ↔ contract mismatches", "and inactive downstream links"]}
          />
        </div>
      </div>

      <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Data Freshness
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{trust.summaryLabel}</p>
          </div>
          <Link href="/admin/sync" className="text-xs font-medium text-primary hover:underline">
            Sync Status
          </Link>
        </div>
        <div className="mt-5 space-y-2.5">
          {trust.freshness.sources.slice(0, 4).map((source) => {
            const isMissing = trust.missingSources.some((m) => m.source === source.source);
            const stateLabel = isMissing ? "Missing" : titleCase(source.freshness.state);
            return (
              <div key={source.source} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-foreground">{titleCase(source.source)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {source.freshness.dataAsOf
                      ? new Date(source.freshness.dataAsOf).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Never synced"}
                  </p>
                </div>
                <Badge
                  variant={
                    isMissing
                      ? "destructive"
                      : source.freshness.state === "fresh"
                        ? "secondary"
                        : "outline"
                  }
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                >
                  {stateLabel}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
          <span className="text-[11px] text-muted-foreground">
            {staleCount > 0 ? `${staleCount} degraded source${staleCount === 1 ? "" : "s"}` : "Mirrors active"}
          </span>
          {trust.missingSources.length > 0 && (
            <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 text-[10px]">
              {trust.missingSources.length} missing
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}

function CommandMetric({
  label,
  value,
  tone,
  active,
  icon,
  meta,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "danger";
  active?: boolean;
  icon: React.ReactNode;
  meta?: string[];
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        "flex h-full min-h-[164px] flex-col rounded-2xl border border-border/80 bg-card p-5 text-left shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] transition-all",
        clickable && "hover:-translate-y-0.5 hover:border-border hover:shadow-[0_10px_20px_-14px_rgba(0,0,0,0.2)]",
        active && "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10",
        !clickable && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/65">
          {label}
        </p>
        <span className="text-foreground/45">{icon}</span>
      </div>
      <p
        className={cn(
          "mt-6 text-[2rem] font-semibold tracking-[-0.04em] leading-none tabular-nums xl:text-[2.15rem]",
          tone === "danger" ? "text-red-600" : "text-foreground",
        )}
      >
        {value}
      </p>
      {meta && meta.length > 0 && (
        <div className="mt-auto space-y-1.5 pt-5">
          {meta.map((line) => (
            <p key={line} className="text-[12px] font-medium leading-5 text-foreground/55">
              {line}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

function FilterChip({
  signal,
  obj,
  onClear,
}: {
  signal: SignalFilter;
  obj: ObjectFilter;
  onClear: () => void;
}) {
  if (!signal && !obj) return null;
  const labels: Record<string, string> = {
    need_attention: "Need Attention",
    billing_risk: "Billing Risk",
    lifecycle_breaks: "Lifecycle Breaks",
    at_risk: "At Risk ARR",
    sub_past_due: "Past Due Subs",
    sub_canceling: "Canceling Subs",
    inv_past_due: "Past Due Invoices",
    inv_uncollectible: "Uncollectible",
    inv_open: "Open Invoices",
    contract_no_sub: "No Stripe Sub",
    contract_ending: "Ending This Month",
    pay_failed: "Failed Payments",
    quote_no_contract: "Quote → No Contract",
    quote_no_sub: "Quote → No Sub",
    opp_no_contract: "Opp → No Contract",
  };
  return (
    <Badge variant="secondary" className="gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold">
      {labels[(signal ?? obj)!] ?? (signal ?? obj)}
      <button onClick={onClear}>
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function PriorityAccountsTable({
  rows,
  selectedId,
  onSelect,
  activeFilter,
  onClearFilter,
}: {
  rows: PriorityAccountRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activeFilter: React.ReactNode;
  onClearFilter: () => void;
}) {
  const [breakFilter, setBreakFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<
    "account" | "csm" | "mrr" | "break" | "risk" | "severity"
  >("severity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const breakOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.breakLocation))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [rows]);

  const visibleRows = useMemo(() => {
    const severityRank: Record<PriorityAccountRow["severity"], number> = {
      critical: 0,
      high: 1,
      medium: 2,
    };

    const filteredRows = breakFilter === "all"
      ? rows
      : rows.filter((row) => row.breakLocation === breakFilter);

    return [...filteredRows].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "account":
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case "csm":
          comparison = (a.csmName ?? "").localeCompare(b.csmName ?? "");
          break;
        case "mrr":
          comparison = a.activeMrrCents - b.activeMrrCents;
          break;
        case "break":
          comparison = a.breakLocation.localeCompare(b.breakLocation);
          break;
        case "risk":
          comparison = a.riskReason.localeCompare(b.riskReason);
          break;
        case "severity":
          comparison = severityRank[a.severity] - severityRank[b.severity];
          break;
      }

      if (comparison === 0) {
        comparison = b.activeMrrCents - a.activeMrrCents;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [breakFilter, rows, sortDirection, sortField]);

  function onSort(nextField: typeof sortField) {
    if (sortField === nextField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(nextField);
    setSortDirection(nextField === "mrr" ? "desc" : "asc");
  }

  function SortHeader({
    label,
    field,
    align = "left",
  }: {
    label: string;
    field: typeof sortField;
    align?: "left" | "right" | "center";
  }) {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
        )}
      >
        <span>{label}</span>
        <ArrowUpDown
          className={cn(
            "size-3.5",
            active ? "text-foreground" : "text-muted-foreground/70",
          )}
        />
      </button>
    );
  }

  if (visibleRows.length === 0) {
    return (
      <TableShell
        title="Priority Accounts"
        description="Accounts ranked by urgency across lifecycle, billing, and commercial breakpoints."
      >
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <CheckCircle2 className="size-5 text-emerald-500/70" />
          <p className="text-sm font-medium text-foreground">No accounts match the active filters</p>
          <div className="flex items-center gap-2">
            {breakFilter !== "all" && (
              <Button variant="outline" size="sm" onClick={() => setBreakFilter("all")}>
                Clear break filter
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClearFilter}>
              Clear signal filter
            </Button>
          </div>
        </div>
      </TableShell>
    );
  }

  return (
    <TableShell
      title="Priority Accounts"
      description="The main work surface. Scan severity, ownership, MRR, and where the lifecycle is breaking."
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {activeFilter}
            <Select value={breakFilter} onValueChange={setBreakFilter}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="All break categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All break categories</SelectItem>
                {breakOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {visibleRows.length} visible of {rows.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link href="/cs/queue">
              Full queue <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/35 hover:bg-muted/35">
            <TableHead className="w-[320px] px-5">
              <SortHeader label="Account" field="account" />
            </TableHead>
            <TableHead className="px-5">
              <SortHeader label="CSM" field="csm" />
            </TableHead>
            <TableHead className="w-[100px] px-5">
              <SortHeader label="MRR" field="mrr" align="right" />
            </TableHead>
            <TableHead className="w-[220px] px-5">
              <SortHeader label="Break" field="break" />
            </TableHead>
            <TableHead className="w-[180px] px-5">
              <SortHeader label="Risk" field="risk" />
            </TableHead>
            <TableHead className="w-[70px] px-5">
              <SortHeader label="Sev" field="severity" align="center" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow
              key={row.omniAccountId}
              className={cn(
                "cursor-pointer border-b border-border/60 transition-all",
                selectedId === row.omniAccountId
                  ? "bg-primary/[0.05] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                  : "hover:bg-muted/25",
              )}
              onClick={() => onSelect(selectedId === row.omniAccountId ? null : row.omniAccountId)}
            >
              <TableCell className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {row.displayName}
                    </p>
                    {row.isFlagged && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Flagged for review
                      </p>
                    )}
                  </div>
                  {row.isFlagged && <Flag className="size-3.5 shrink-0 text-amber-500" />}
                </div>
              </TableCell>
              <TableCell className="px-5 py-4 text-[12px] text-muted-foreground">
                {row.csmName ?? "—"}
              </TableCell>
              <TableCell className="px-5 py-4 text-right text-[13px] font-semibold tabular-nums">
                {row.activeMrrCents > 0 ? fmt(row.activeMrrCents) : "—"}
              </TableCell>
              <TableCell className="px-5 py-4">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                  {row.breakLocation}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4 text-[12px] text-muted-foreground">
                {row.riskReason}
              </TableCell>
              <TableCell className="px-5 py-4 text-center">
                <SeverityDot severity={row.severity} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function SeverityDot({ severity }: { severity: PriorityAccountRow["severity"] }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full",
        severity === "critical"
          ? "bg-red-500"
          : severity === "high"
            ? "bg-amber-500"
            : "bg-slate-300",
      )}
    />
  );
}

function OperationalSection({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/65">
            {title}
          </p>
          <p className="mt-1.5 text-[15px] font-medium leading-6 text-foreground/62">{description}</p>
        </div>
        {href && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link href={href}>
              View <ChevronRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <div className="flex-1 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SummarySubtext({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-1 min-h-[32px] text-[12px] font-medium leading-4.5 text-foreground/55",
        !children && "invisible",
      )}
    >
      {children ?? "\u00A0"}
    </p>
  );
}

function ModuleMetricTable({
  rows,
}: {
  rows: Array<{
    label: string;
    value: string | number;
    sub?: string;
    tone?: "danger" | "warn";
    active?: boolean;
    onClick?: () => void;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/[0.12]">
      {rows.map((row, index) => {
        const clickable = !!row.onClick;
        return (
          <button
            key={`${row.label}-${index}`}
            type="button"
            onClick={row.onClick}
            disabled={!clickable}
            className={cn(
              "grid min-h-[62px] w-full grid-cols-1 gap-1.5 px-3.5 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4",
              index > 0 && "border-t border-border/60",
              clickable && "hover:bg-muted/35",
              row.active && "bg-primary/[0.05]",
              !clickable && "cursor-default",
            )}
          >
            <div className="min-w-0 pr-2">
              <p className="text-[11px] font-medium leading-snug text-foreground sm:truncate">
                {row.label}
              </p>
              {row.sub && <p className="mt-1 text-[11px] text-muted-foreground">{row.sub}</p>}
            </div>
            <p
              className={cn(
                "text-[15px] font-semibold tabular-nums sm:text-right",
                row.tone === "danger"
                  ? "text-red-600"
                  : row.tone === "warn"
                    ? "text-amber-600"
                    : "text-foreground",
              )}
            >
              {row.value}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ObjectModuleBody({
  summary,
  metrics,
  chart,
}: {
  summary: React.ReactNode;
  metrics: React.ReactNode;
  chart?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div
        className="grid gap-5"
      >
        <div className="min-w-0">{summary}</div>
        {chart && <div className="rounded-xl border border-border/70 bg-muted/10 p-4">{chart}</div>}
      </div>
      <div className="min-w-0">{metrics}</div>
    </div>
  );
}

function OpportunitiesModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: OpportunityContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = [
    { key: "tracked", label: "Tracked", value: data.trackedTotal, fill: "var(--color-chart-3)" },
    { key: "noContract", label: "Accepted → No Contract", value: data.noContractFromQuote, fill: "var(--color-chart-1)" },
  ];
  return (
    <OperationalSection
      title="Opportunities"
      description="Commercial workflow coverage from the Salesforce side."
      href="/opportunities"
    >
      <ObjectModuleBody
        summary={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total SFDC Opportunities
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">{data.trackedTotal.toLocaleString()}</p>
            <SummarySubtext />
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Accepted quotes with no contract",
                value: data.noContractFromQuote,
                tone: "danger",
                active: activeFilter === "opp_no_contract",
                onClick: () => onFilter("opp_no_contract"),
              },
              {
                label: "Stage coverage",
                value: "Live SF",
                sub: "Stage distributions still require live Salesforce reads.",
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function QuotesModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: QuotesContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = data.byStatus.map((item, index) => ({
    label: titleCase(item.status),
    value: item.count,
    fill: [
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
    ][index % 5],
  }));
  return (
    <OperationalSection
      title="Quotes"
      description="Current quote inventory, accepted volume, and downstream breakage."
      href="/quotes"
    >
      <ObjectModuleBody
        summary={
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Total SFDC Quotes
              </p>
              <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">{data.total.toLocaleString()}</p>
              <SummarySubtext>
                Accepted YTD: {data.acceptedYtd.toLocaleString()} · {fmt(data.acceptedYtdAmountCents)}
              </SummarySubtext>
            </div>
            {data.source === "salesforce_unavailable" && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Salesforce quote metrics are temporarily unavailable.
              </p>
            )}
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Accepted → no subscription",
                value: data.acceptedNoSub,
                tone: "danger",
                active: activeFilter === "quote_no_sub",
                onClick: () => onFilter("quote_no_sub"),
              },
              {
                label: "Accepted → no contract",
                value: data.acceptedNoContract,
                tone: "danger",
                active: activeFilter === "quote_no_contract",
                onClick: () => onFilter("quote_no_contract"),
              },
              {
                label: "Expired / open follow-up",
                value: data.expiredOpen,
                tone: "warn",
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function SubscriptionsModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: SubscriptionsContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = [
    { label: "Active", value: data.active, fill: "var(--color-chart-2)" },
    { label: "Trialing", value: data.trialing, fill: "var(--color-chart-4)" },
    { label: "Past Due", value: data.pastDue, fill: "var(--color-chart-1)" },
    { label: "Canceled", value: data.canceled, fill: "var(--color-chart-3)" },
  ];
  return (
    <OperationalSection
      title="Subscriptions"
      description="Stripe subscription coverage, active revenue, and lifecycle pressure."
      href="/subscriptions"
    >
      <ObjectModuleBody
        summary={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total Stripe Subscriptions
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">{data.total.toLocaleString()}</p>
            <SummarySubtext>
              {data.active.toLocaleString()} active · {fmt(data.activeMrrCents)} MRR
            </SummarySubtext>
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Past due",
                value: data.pastDue,
                tone: "danger",
                active: activeFilter === "sub_past_due",
                onClick: () => onFilter("sub_past_due"),
              },
              {
                label: "Canceling",
                value: data.cancelingCount,
                tone: "warn",
                active: activeFilter === "sub_canceling",
                onClick: () => onFilter("sub_canceling"),
              },
              {
                label: "Canceled",
                value: data.canceled,
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function InvoicesModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: InvoicesContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = [
    { label: "Paid", value: data.paid, fill: "var(--color-chart-2)" },
    { label: "Open", value: data.open, fill: "var(--color-chart-4)" },
    { label: "Past Due", value: data.pastDue, fill: "var(--color-chart-1)" },
    { label: "Uncollectible", value: data.uncollectible, fill: "var(--color-chart-3)" },
  ];
  return (
    <OperationalSection
      title="Invoices"
      description="Mirror coverage, open exposure, and overdue/uncollectible pressure."
    >
      <ObjectModuleBody
        summary={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total Stripe Invoices
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">
              {data.mirrorEmpty ? "0" : data.stripeTotal.toLocaleString()}
            </p>
            <SummarySubtext>
              {data.mirrorEmpty ? "Mirror currently empty" : `${fmt(data.paidAmountCents)} paid volume`}
            </SummarySubtext>
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Open invoices",
                value: data.open,
                sub: fmt(data.openAmountCents),
                tone: "warn",
                active: activeFilter === "inv_open",
                onClick: () => onFilter("inv_open"),
              },
              {
                label: "Past due invoices",
                value: data.pastDue,
                sub: fmt(data.pastDueAmountCents),
                tone: "danger",
                active: activeFilter === "inv_past_due",
                onClick: () => onFilter("inv_past_due"),
              },
              {
                label: "Uncollectible",
                value: data.uncollectible,
                tone: "danger",
                active: activeFilter === "inv_uncollectible",
                onClick: () => onFilter("inv_uncollectible"),
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function ContractsModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: ContractContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = [
    { label: "Activated", value: data.activated, fill: "var(--color-chart-2)" },
    { label: "No Stripe Sub", value: data.noStripeSub, fill: "var(--color-chart-1)" },
    { label: "Ending This Month", value: data.endingThisMonth, fill: "var(--color-chart-4)" },
  ];
  return (
    <OperationalSection
      title="Contracts"
      description="Activated contract inventory and subscription linkage quality."
      href="/contracts"
    >
      <ObjectModuleBody
        summary={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total SFDC Contracts
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">
              {data.total.toLocaleString()}
            </p>
            <SummarySubtext />
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Active contracts",
                value: data.activated,
              },
              {
                label: "Contracts with no subscription",
                value: data.noStripeSub,
                tone: "danger",
                active: activeFilter === "contract_no_sub",
                onClick: () => onFilter("contract_no_sub"),
              },
              {
                label: "Ending this month",
                value: data.endingThisMonth,
                sub: data.endingThisMonthMrr > 0 ? fmt(data.endingThisMonthMrr) : undefined,
                tone: "warn",
                active: activeFilter === "contract_ending",
                onClick: () => onFilter("contract_ending"),
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function PaymentsModule({
  data,
  activeFilter,
  onFilter,
}: {
  data: PaymentsContainer;
  activeFilter: ObjectFilter;
  onFilter: (f: ObjectFilter) => void;
}) {
  const chartData = [
    { label: "Succeeded", value: data.succeeded, fill: "var(--color-chart-2)" },
    { label: "Failed", value: data.failed, fill: "var(--color-chart-1)" },
    { label: "Action", value: data.needingAction, fill: "var(--color-chart-4)" },
  ];
  return (
    <OperationalSection
      title="Payments"
      description="Collection throughput, failures, and payment work needing intervention."
    >
      <ObjectModuleBody
        summary={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Total Collection YTD
            </p>
            <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em]">{fmt(data.totalYtdAmountCents)}</p>
            <SummarySubtext>{data.totalYtd.toLocaleString()} payments mirrored</SummarySubtext>
          </div>
        }
        metrics={
          <ModuleMetricTable
            rows={[
              {
                label: "Succeeded",
                value: data.succeeded,
                sub: fmt(data.succeededAmountCents),
              },
              {
                label: "Failed",
                value: data.failed,
                sub: fmt(data.failedAmountCents),
                tone: "danger",
                active: activeFilter === "pay_failed",
                onClick: () => onFilter("pay_failed"),
              },
              {
                label: "Needing action",
                value: data.needingAction,
                tone: "warn",
              },
            ]}
          />
        }
        chart={<MiniHorizontalBarChart data={chartData} />}
      />
    </OperationalSection>
  );
}

function MiniHorizontalBarChart({
  data,
}: {
  data: { label: string; value: number; fill: string }[];
}) {
  const chartData = data
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[168px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/[0.08] text-[11px] text-muted-foreground">
        No distribution available yet
      </div>
    );
  }

  return (
    <ChartContainer
      config={Object.fromEntries(
        chartData.map((item) => [
          item.label,
          { label: item.label, color: item.fill },
        ]),
      )}
      className="h-[168px] w-full"
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 2, right: 8, left: 4, bottom: 2 }}
        barCategoryGap={14}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          hide
        />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          width={100}
          fontSize={11}
          tickFormatter={(value) => {
            const label = String(value);
            return label.length > 16 ? `${label.slice(0, 16)}…` : label;
          }}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="value" radius={8} barSize={18}>
          {chartData.map((entry) => (
            <Cell key={entry.label} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function CustomerDrawerPanel({
  account,
  onClose,
}: {
  account: OmniAccountSummary;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    setSnapshot(null);
    startLoad(async () => {
      const s = await fetchAccountSnapshot(account.omniAccountId);
      setSnapshot(s);
    });
  }, [account.omniAccountId]);

  const lc = snapshot?.lifecycle;
  const lifecycleStages: { label: string; ok: boolean }[] = lc
    ? [
        { label: "Opportunity", ok: lc.hasOpportunity },
        { label: "Quote", ok: lc.hasQuote },
        { label: "Subscription", ok: lc.hasActiveSubscription },
        { label: "Invoice", ok: lc.hasCurrentInvoice },
        { label: "Contract", ok: lc.hasActiveContract },
        { label: "Payment", ok: lc.hasHealthyPayment },
      ]
    : [
        { label: "Opportunity", ok: !!account.sfAccountId },
        { label: "Quote", ok: true },
        { label: "Subscription", ok: account.activeSubscriptionCount > 0 },
        { label: "Invoice", ok: account.pastDueInvoiceCount === 0 },
        { label: "Contract", ok: account.hasSalesforce },
        { label: "Payment", ok: account.pastDueInvoiceCount === 0 },
      ];

  const initials = account.displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/80 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="size-14 rounded-2xl border border-border/80 shadow-sm">
              <AvatarFallback className="rounded-2xl bg-muted text-base font-semibold text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Customer 360
              </p>
              <h3 className="mt-1 truncate text-[1.8rem] font-semibold tracking-[-0.04em] text-foreground">
                {account.displayName}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {account.csmName ?? "No CSM assigned"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-border/80 p-2 hover:bg-muted/60">
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <DrawerMetric label="MRR" value={fmt(account.activeMrrCents)} />
          <DrawerMetric label="ARR" value={fmt(account.activeArrCents)} />
          <DrawerMetric
            label="Health"
            value={account.pastDueInvoiceCount > 0 ? "Attention" : "Stable"}
            tone={account.pastDueInvoiceCount > 0 ? "danger" : "default"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {lifecycleStages.map((stage) => (
            <Badge
              key={stage.label}
              variant={stage.ok ? "secondary" : "destructive"}
              className="rounded-full px-3 py-1 text-[10px] font-semibold"
            >
              {stage.label}
            </Badge>
          ))}
        </div>

        {lc && lc.breaks.length > 0 && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-600">
              Active breaks
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lc.breaks.map((b, i) => (
                <Badge key={i} variant="destructive" className="rounded-full px-2.5 py-1 text-[10px]">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <SnapshotCard
            title="Subscriptions"
            description="Live subscription records"
            count={snapshot?.subscriptions.length ?? 0}
            icon={<CreditCard className="size-4" />}
          >
            {loading && !snapshot ? (
              <SnapEmpty>Loading subscriptions…</SnapEmpty>
            ) : snapshot && snapshot.subscriptions.length > 0 ? (
              snapshot.subscriptions.map((s) => (
                <SnapshotRow
                  key={s.id}
                  label={s.id.slice(4, 18)}
                  value={s.status}
                  valueTone={s.status === "past_due" ? "danger" : "default"}
                />
              ))
            ) : (
              <SnapEmpty>No subscriptions</SnapEmpty>
            )}
          </SnapshotCard>

          <SnapshotCard
            title="Invoices"
            description="Mirrored billing documents"
            count={snapshot?.invoices.length ?? 0}
            icon={<Receipt className="size-4" />}
          >
            {loading && !snapshot ? (
              <SnapEmpty>Loading invoices…</SnapEmpty>
            ) : snapshot && snapshot.invoices.length > 0 ? (
              snapshot.invoices.map((inv) => (
                <SnapshotRow
                  key={inv.id}
                  label={inv.number ?? inv.id.slice(3, 15)}
                  value={fmt(inv.amountDue)}
                />
              ))
            ) : (
              <SnapEmpty>No invoices mirrored</SnapEmpty>
            )}
          </SnapshotCard>

          <SnapshotCard
            title="Contracts"
            description="Salesforce contract context"
            count={snapshot?.contracts.length ?? 0}
            icon={<FileText className="size-4" />}
          >
            {loading && !snapshot ? (
              <SnapEmpty>Loading contracts…</SnapEmpty>
            ) : snapshot && snapshot.contracts.length > 0 ? (
              snapshot.contracts.map((c) => (
                <SnapshotRow
                  key={c.id}
                  label={c.contractNumber ?? c.id.slice(0, 12)}
                  value={c.status}
                  valueTone={c.status === "Activated" ? "default" : "muted"}
                />
              ))
            ) : (
              <SnapEmpty>No SF contracts</SnapEmpty>
            )}
          </SnapshotCard>

          <SnapshotCard
            title="Quotes"
            description="Commercial quote inventory"
            count={snapshot?.quotes.length ?? 0}
            icon={<Building2 className="size-4" />}
          >
            {loading && !snapshot ? (
              <SnapEmpty>Loading quotes…</SnapEmpty>
            ) : snapshot && snapshot.quotes.length > 0 ? (
              snapshot.quotes.map((q) => (
                <SnapshotRow
                  key={q.id}
                  label={q.name}
                  value={q.status}
                  valueTone={q.status.toLowerCase() === "accepted" ? "default" : "muted"}
                />
              ))
            ) : (
              <SnapEmpty>No Salesforce quotes</SnapEmpty>
            )}
          </SnapshotCard>

          <SnapshotCard
            title="Payments"
            description="Collection and payment health"
            count={snapshot?.payments.length ?? 0}
            icon={<Wallet className="size-4" />}
            className="md:col-span-2"
          >
            {loading && !snapshot ? (
              <SnapEmpty>Loading payments…</SnapEmpty>
            ) : snapshot && snapshot.payments.length > 0 ? (
              <>
                {snapshot.payments.map((p) => (
                  <SnapshotRow
                    key={p.id}
                    label={p.cardLast4 ? `····${p.cardLast4}` : p.id.slice(3, 15)}
                    value={fmt(p.amount)}
                    valueTone={p.status === "succeeded" ? "default" : "danger"}
                  />
                ))}
                {snapshot.isDelinquent && (
                  <Badge variant="destructive" className="rounded-full px-2.5 py-1 text-[10px]">
                    Customer is delinquent
                  </Badge>
                )}
                {!snapshot.hasDefaultPm && (
                  <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[10px] text-amber-700">
                    No default payment method
                  </Badge>
                )}
              </>
            ) : (
              <SnapEmpty>{snapshot?.isDelinquent ? "No payments — delinquent" : "No recent payments"}</SnapEmpty>
            )}
          </SnapshotCard>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Actions</CardTitle>
              <CardDescription>Jump directly into the relevant workspace for this account.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-4 text-[11px]" asChild>
                <Link href={`/customers/${encodeURIComponent(account.omniAccountId)}`}>Full detail</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-4 text-[11px]" asChild>
                <Link href={`/cs/renewals?account=${encodeURIComponent(account.omniAccountId)}`}>Renewals</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-4 text-[11px]" asChild>
                <Link href={`/cs/data-quality?account=${encodeURIComponent(account.omniAccountId)}`}>DQ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function Drawer({ account, onClose }: { account: OmniAccountSummary; onClose: () => void }) {
  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-none p-0 sm:max-w-2xl xl:max-w-3xl"
        showCloseButton={false}
      >
        <CustomerDrawerPanel account={account} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

function SnapshotCard({
  title,
  description,
  count,
  icon,
  children,
  className,
}: {
  title: string;
  description: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border/80 bg-muted/40 p-2 text-muted-foreground">
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <CardDescription className="mt-1 text-[11px]">{description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[10px]">
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function SnapshotRow({
  label,
  value,
  valueTone = "default",
}: {
  label: string;
  value: string;
  valueTone?: "default" | "danger" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/[0.18] px-3 py-2">
      <span className="truncate font-mono text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          valueTone === "danger"
            ? "text-red-600"
            : valueTone === "muted"
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function DrawerMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tracking-[-0.04em] tabular-nums", tone === "danger" ? "text-red-600" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function SnapEmpty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border/80 bg-muted/[0.14] px-3 py-3 text-[11px] text-muted-foreground">{children}</p>;
}

export function CsDashboard({ data }: { data: CsDashboardData }) {
  const { trust, banner, priorityRows } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>(null);

  const allAccounts = useMemo(() => {
    const map = new Map<string, OmniAccountSummary>();
    for (const lane of [
      data.lanes.renewalRisk,
      data.lanes.dataQuality,
      data.lanes.missingLinkage,
      data.lanes.invoiceRisk,
    ]) {
      for (const account of lane) map.set(account.omniAccountId, account);
    }
    return map;
  }, [data.lanes]);

  const filteredRows = useMemo(() => {
    let rows = priorityRows;
    if (signalFilter) {
      switch (signalFilter) {
        case "need_attention":
          rows = rows.filter(
            (r) =>
              r.breakLocation.includes("Invoice") ||
              r.breakLocation.includes("Payment") ||
              r.breakLocation.includes("Contract") ||
              r.breakLocation.includes("Data Quality"),
          );
          break;
        case "billing_risk":
          rows = rows.filter(
            (r) => r.breakLocation.includes("Invoice") || r.breakLocation.includes("Payment"),
          );
          break;
        case "lifecycle_breaks":
          rows = rows.filter(
            (r) => r.breakLocation.includes("↔") || r.breakLocation.includes("Contract"),
          );
          break;
        case "at_risk":
          rows = rows.filter(
            (r) =>
              r.breakLocation.includes("Invoice") ||
              r.breakLocation.includes("Payment") ||
              r.breakLocation.includes("↔") ||
              r.breakLocation.includes("Contract"),
          );
          break;
      }
    }
    if (objectFilter) {
      switch (objectFilter) {
        case "sub_past_due":
          rows = rows.filter(
            (r) =>
              r.riskReason.toLowerCase().includes("past due") ||
              r.riskReason.toLowerCase().includes("overdue"),
          );
          break;
        case "sub_canceling":
          rows = rows.filter((r) => r.riskReason.toLowerCase().includes("cancel"));
          break;
        case "inv_past_due":
        case "inv_open":
        case "inv_uncollectible":
          rows = rows.filter((r) => r.breakLocation.includes("Invoice"));
          break;
        case "contract_no_sub":
          rows = rows.filter(
            (r) => r.breakLocation.includes("Contract") || r.breakLocation.includes("↔"),
          );
          break;
        case "contract_ending":
          rows = rows.filter((r) => r.breakLocation.includes("Renewal"));
          break;
        case "pay_failed":
          rows = rows.filter((r) => r.breakLocation.includes("Payment"));
          break;
        default:
          break;
      }
    }
    return rows;
  }, [priorityRows, signalFilter, objectFilter]);

  const selectedAccount = selectedId ? allAccounts.get(selectedId) ?? null : null;

  function onSignal(filter: SignalFilter) {
    setSignalFilter(filter);
    setObjectFilter(null);
  }

  function onObject(filter: ObjectFilter) {
    setObjectFilter(objectFilter === filter ? null : filter);
    setSignalFilter(null);
  }

  function clearFilters() {
    setSignalFilter(null);
    setObjectFilter(null);
  }

  return (
    <div className="flex h-full gap-0">
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground">Customer Success</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Revenue lifecycle from opportunity through billing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" asChild>
              <Link href="/cs/queue">Queue</Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" asChild>
              <Link href="/cs/renewals">Renewals</Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" asChild>
              <Link href="/cs/data-quality">DQ</Link>
            </Button>
          </div>
        </div>

        <TopCommandBand
          banner={banner}
          trust={trust}
          active={signalFilter}
          onSelect={onSignal}
        />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <OpportunitiesModule data={data.opportunities} activeFilter={objectFilter} onFilter={onObject} />
          <QuotesModule data={data.quotes} activeFilter={objectFilter} onFilter={onObject} />
          <SubscriptionsModule data={data.subscriptions} activeFilter={objectFilter} onFilter={onObject} />
          <InvoicesModule data={data.invoices} activeFilter={objectFilter} onFilter={onObject} />
          <ContractsModule data={data.contracts} activeFilter={objectFilter} onFilter={onObject} />
          <PaymentsModule data={data.payments} activeFilter={objectFilter} onFilter={onObject} />
        </div>

        <PriorityAccountsTable
          rows={filteredRows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          activeFilter={<FilterChip signal={signalFilter} obj={objectFilter} onClear={clearFilters} />}
          onClearFilter={clearFilters}
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/cs/reports" className="hover:text-foreground px-1">Reports</Link>
          <span className="text-border">·</span>
          <Link href="/subscriptions" className="hover:text-foreground px-1">Subscriptions</Link>
          <span className="text-border">·</span>
          <Link href="/customers" className="hover:text-foreground px-1">Customers</Link>
          <span className="text-border">·</span>
          <Link href="/admin/sync" className="hover:text-foreground px-1">Sync</Link>
        </div>
      </div>

      {selectedAccount && <Drawer account={selectedAccount} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
