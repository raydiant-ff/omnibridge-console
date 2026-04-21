"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, ExternalLink, ArrowUpDown, Flag, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/workspace";
import { FilterBar, FilterField, StatStrip } from "@/components/omni";
import type {
  OmniAccountSummary,
  OmniAccountSummaryReport,
  AccountSignalCategory,
  WorkspaceTrustSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL = "__all__";

function fmtCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

const CATEGORY_LABEL: Record<AccountSignalCategory, string> = {
  missing_linkage: "Missing SF / Stripe Link",
  correlation_issue: "SF / Stripe Correlation",
  renewal_risk: "Renewal Risk",
  invoice_risk: "Invoice Risk",
  stale_data: "Stale Data",
  no_active_subscription: "No Active Subs",
  data_quality: "Data Quality",
};

const CATEGORY_VARIANT: Record<AccountSignalCategory, "default" | "secondary" | "destructive" | "outline"> = {
  missing_linkage: "destructive",
  correlation_issue: "outline",
  renewal_risk: "destructive",
  invoice_risk: "destructive",
  stale_data: "secondary",
  no_active_subscription: "outline",
  data_quality: "outline",
};

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

// ---------------------------------------------------------------------------
// Detail pane
// ---------------------------------------------------------------------------

function AccountDetail({
  acct,
  onClose,
}: {
  acct: OmniAccountSummary;
  onClose: () => void;
}) {
  const rs = acct.renewalSummary;
  const dq = acct.dqSummary;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{acct.displayName}</h3>
          {acct.domain && (
            <span className="text-xs text-muted-foreground">{acct.domain}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Customer detail link */}
      <Link
        href={`/customers/${encodeURIComponent(acct.omniAccountId)}`}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        View Customer Detail <ExternalLink className="size-3" />
      </Link>

      {/* Signal categories */}
      {acct.signalCategories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {acct.signalCategories.map((cat) => (
            <Badge key={cat} variant={CATEGORY_VARIANT[cat]} className="text-[10px]">
              {CATEGORY_LABEL[cat]}
            </Badge>
          ))}
        </div>
      )}

      {/* Account basics */}
      <div className="flex flex-col gap-2 text-sm">
        <DetailField label="CSM" value={acct.csmName ?? "—"} />
        <DetailField label="Account Owner" value={acct.accountOwnerName ?? "—"} />
        <DetailField label="Status" value={acct.accountStatus ?? "—"} />
        <DetailField label="Active Subs" value={String(acct.activeSubscriptionCount)} />
        <DetailField label="MRR" value={fmtCompact(acct.activeMrrCents)} />
        <DetailField label="ARR" value={fmtCompact(acct.activeArrCents)} />
        <DetailField
          label="SF / Stripe Links"
          value={
            <div className="flex gap-1">
              {acct.hasSalesforce && <Badge variant="secondary" className="text-[10px]">SF</Badge>}
              {acct.hasStripe && <Badge variant="secondary" className="text-[10px]">Stripe</Badge>}
              {!acct.hasSalesforce && !acct.hasStripe && <span className="text-muted-foreground">None</span>}
            </div>
          }
        />
      </div>

      {/* Renewal exposure */}
      {rs.candidateCount > 0 && (
        <div className="rounded-lg border bg-muted/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Renewal Exposure</span>
            <Link
              href={`/cs/renewals?account=${encodeURIComponent(acct.omniAccountId)}`}
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
            >
              View in Renewals <ExternalLink className="size-2.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-muted-foreground">Candidates</span>
            <span className="text-foreground tabular-nums">{rs.candidateCount}</span>
            <span className="text-muted-foreground">MRR at renewal</span>
            <span className="text-foreground tabular-nums">{fmtCompact(rs.renewalMrrCents)}</span>
            {rs.nearestRenewalDate && (
              <>
                <span className="text-muted-foreground">Next renewal</span>
                <span className={cn("tabular-nums", rs.daysToNearestRenewal !== null && rs.daysToNearestRenewal < 0 ? "text-destructive" : "text-foreground")}>
                  {rs.nearestRenewalDate}
                  {rs.daysToNearestRenewal !== null && (
                    <span className="ml-1 text-muted-foreground">
                      ({rs.daysToNearestRenewal < 0 ? `${Math.abs(rs.daysToNearestRenewal)}d over` : `${rs.daysToNearestRenewal}d`})
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1 mt-0.5">
            {rs.hasOverdue && <Badge variant="destructive" className="text-[9px]">Overdue</Badge>}
            {rs.hasDueSoon && <Badge variant="outline" className="text-[9px]">Due Soon</Badge>}
            {rs.hasCancelling && <Badge variant="destructive" className="text-[9px]">Cancelling</Badge>}
          </div>
        </div>
      )}

      {/* DQ burden */}
      {dq.issueCount > 0 && (
        <div className="rounded-lg border bg-muted/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Data Quality</span>
            <Link
              href={`/cs/data-quality?account=${encodeURIComponent(acct.omniAccountId)}`}
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
            >
              View Issues <ExternalLink className="size-2.5" />
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>{dq.issueCount} issue{dq.issueCount !== 1 ? "s" : ""}</span>
            {dq.worstSeverity && (
              <Badge variant={SEVERITY_VARIANT[dq.worstSeverity] ?? "outline"} className="text-[9px]">
                {dq.worstSeverity}
              </Badge>
            )}
          </div>
          {dq.issueTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dq.issueTypes.map((t) => (
                <Badge key={t} variant="secondary" className="text-[9px]">
                  {t.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice health */}
      {(acct.pastDueInvoiceCount > 0 || acct.openInvoiceCount > 0) && (
        <div className="flex flex-col gap-1 text-sm">
          {acct.pastDueInvoiceCount > 0 && (
            <DetailField label="Past Due Invoices" value={String(acct.pastDueInvoiceCount)} className="text-destructive" />
          )}
          {acct.openInvoiceCount > 0 && (
            <DetailField label="Open Invoices" value={String(acct.openInvoiceCount)} />
          )}
        </div>
      )}

      {/* Review state */}
      {acct.reviewState.isFlagged && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Flag className="size-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Flagged for Review</span>
          </div>
          <div className="text-[10px] text-amber-700">
            {acct.reviewState.lastFlagReason && (
              <span className="capitalize">{acct.reviewState.lastFlagReason.replace(/_/g, " ")}</span>
            )}
            {acct.reviewState.lastFlaggedBy && (
              <span> · by {acct.reviewState.lastFlaggedBy}</span>
            )}
            {acct.reviewState.lastFlaggedAt && (
              <span> · {new Date(acct.reviewState.lastFlaggedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}

      {/* Freshness */}
      <div className="text-[10px] text-muted-foreground">
        {acct.freshness.label}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-xs text-foreground flex-1", className)}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main queue
// ---------------------------------------------------------------------------

type FocusMode =
  | "__all__"
  | "overdue_renewals"
  | "due_soon_renewals"
  | "cancelling"
  | "has_dq_issues"
  | "high_severity_dq"
  | "no_active_subs"
  | "stale_data"
  | "flagged_for_review";

const FOCUS_LABEL: Record<FocusMode, string> = {
  __all__: "All",
  overdue_renewals: "Overdue Renewals",
  due_soon_renewals: "Due Soon Renewals",
  cancelling: "Cancelling",
  has_dq_issues: "Has DQ Issues",
  high_severity_dq: "High/Critical DQ",
  no_active_subs: "No Active Subs",
  stale_data: "Stale Data",
  flagged_for_review: "Flagged for Review",
};

type SortMode =
  | "mrr_desc"
  | "nearest_renewal"
  | "dq_burden"
  | "signal_count"
  | "alpha";

const SORT_LABEL: Record<SortMode, string> = {
  mrr_desc: "MRR (High to Low)",
  nearest_renewal: "Nearest Renewal",
  dq_burden: "DQ Burden",
  signal_count: "Most Signals",
  alpha: "Alphabetical",
};

const DQ_SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function sortAccounts(items: OmniAccountSummary[], mode: SortMode): OmniAccountSummary[] {
  const sorted = [...items];
  switch (mode) {
    case "mrr_desc":
      sorted.sort((a, b) => b.activeMrrCents - a.activeMrrCents);
      break;
    case "nearest_renewal":
      sorted.sort((a, b) => {
        const da = a.renewalSummary.daysToNearestRenewal;
        const db = b.renewalSummary.daysToNearestRenewal;
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
      break;
    case "dq_burden":
      sorted.sort((a, b) => {
        const sa = DQ_SEVERITY_RANK[a.dqSummary.worstSeverity ?? ""] ?? 0;
        const sb = DQ_SEVERITY_RANK[b.dqSummary.worstSeverity ?? ""] ?? 0;
        if (sb !== sa) return sb - sa;
        return b.dqSummary.issueCount - a.dqSummary.issueCount;
      });
      break;
    case "signal_count":
      sorted.sort((a, b) => b.signalCategories.length - a.signalCategories.length);
      break;
    case "alpha":
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
      break;
  }
  return sorted;
}

export function CsQueue({
  data,
  trust,
  initialFocus,
  initialSignal,
}: {
  data: OmniAccountSummaryReport;
  trust: WorkspaceTrustSummary;
  initialFocus?: string | null;
  initialSignal?: string | null;
}) {
  const [csmFilter, setCsmFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(
    initialSignal && Object.keys(CATEGORY_LABEL).includes(initialSignal) ? initialSignal : ALL,
  );
  const [focusMode, setFocusMode] = useState<FocusMode>(
    initialFocus && Object.keys(FOCUS_LABEL).includes(initialFocus) ? (initialFocus as FocusMode) : "__all__",
  );
  const [sortMode, setSortMode] = useState<SortMode>("mrr_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const csmList = useMemo(() => {
    const csms = new Set(data.accounts.map((r) => r.csmName).filter((n): n is string => n != null));
    return [...csms].sort();
  }, [data.accounts]);

  const categories = useMemo(() => {
    const cats = new Set(data.accounts.flatMap((r) => r.signalCategories));
    return [...cats].sort();
  }, [data.accounts]);

  const filtered = useMemo(() => {
    let items = data.accounts;

    if (csmFilter !== ALL) {
      items = csmFilter === "__unassigned__"
        ? items.filter((r) => !r.csmName)
        : items.filter((r) => r.csmName === csmFilter);
    }
    if (categoryFilter !== ALL) {
      items = items.filter((r) => r.signalCategories.includes(categoryFilter as AccountSignalCategory));
    }
    if (focusMode !== "__all__") {
      switch (focusMode) {
        case "overdue_renewals":
          items = items.filter((r) => r.renewalSummary.hasOverdue);
          break;
        case "due_soon_renewals":
          items = items.filter((r) => r.renewalSummary.hasDueSoon);
          break;
        case "cancelling":
          items = items.filter((r) => r.renewalSummary.hasCancelling);
          break;
        case "has_dq_issues":
          items = items.filter((r) => r.dqSummary.issueCount > 0);
          break;
        case "high_severity_dq":
          items = items.filter((r) => r.dqSummary.worstSeverity === "high" || r.dqSummary.worstSeverity === "critical");
          break;
        case "no_active_subs":
          items = items.filter((r) => r.activeSubscriptionCount === 0);
          break;
        case "stale_data":
          items = items.filter((r) => r.freshness.state === "stale" || r.freshness.state === "degraded");
          break;
        case "flagged_for_review":
          items = items.filter((r) => r.reviewState.isFlagged);
          break;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((r) =>
        r.displayName.toLowerCase().includes(q) ||
        (r.domain ?? "").toLowerCase().includes(q),
      );
    }
    return sortAccounts(items, sortMode);
  }, [data.accounts, csmFilter, categoryFilter, focusMode, searchQuery, sortMode]);

  const selectedAcct = selectedId
    ? data.accounts.find((r) => r.omniAccountId === selectedId) ?? null
    : null;

  const stats = [
    { label: "Accounts", value: String(data.totalAccounts) },
    {
      label: "Need Attention",
      value: String(data.accountsWithSignals),
      variant: data.accountsWithSignals > 0 ? ("danger" as const) : undefined,
    },
    { label: "Total MRR", value: fmtCompact(data.totalMrrCents) },
    { label: "Showing", value: String(filtered.length) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CS Queue"
        description="Stripe and Salesforce operational queue for renewals, billing, data quality, and review follow-up."
        actions={
          <FilterBar>
            <FilterField label="CSM">
              <Select value={csmFilter} onValueChange={setCsmFilter}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="All CSMs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All CSMs</SelectItem>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {csmList.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Signal">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABEL[cat] ?? cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Focus">
              <Select value={focusMode} onValueChange={(v) => setFocusMode(v as FocusMode)}>
                <SelectTrigger className="w-[170px] h-8 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FOCUS_LABEL) as FocusMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {FOCUS_LABEL[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Sort">
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="w-[170px] h-8 text-sm">
                  <ArrowUpDown className="size-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {SORT_LABEL[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>
        }
      />

      {/* Trust indicator */}
      {trust.showWarning && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/60 px-4 py-3">
          <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-foreground">{trust.summaryLabel}</span>
          <Link href="/admin/sync" className="text-xs text-primary hover:underline ml-auto shrink-0">
            Sync status
          </Link>
        </div>
      )}

      <StatStrip stats={stats} className="rounded-xl" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or domain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-5">Account</TableHead>
                  <TableHead className="w-[110px] px-5">CSM</TableHead>
                  <TableHead className="w-[70px] px-5 text-right">Subs</TableHead>
                  <TableHead className="w-[90px] px-5 text-right">MRR</TableHead>
                  <TableHead className="px-5">Signals</TableHead>
                  <TableHead className="w-10 px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <p className="text-sm font-medium text-foreground">No accounts match</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try adjusting your filters, focus mode, or search query.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((acct) => (
                    <TableRow
                      key={acct.omniAccountId}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/25",
                        selectedId === acct.omniAccountId && "bg-primary/[0.05] shadow-[inset_3px_0_0_0_var(--color-primary)]",
                      )}
                      onClick={() =>
                        setSelectedId(selectedId === acct.omniAccountId ? null : acct.omniAccountId)
                      }
                    >
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium truncate max-w-[240px] inline-flex items-center gap-1.5">
                            {acct.displayName}
                            {acct.reviewState.isFlagged && (
                              <span title={`Flagged for review${acct.reviewState.lastFlaggedBy ? ` by ${acct.reviewState.lastFlaggedBy}` : ""}`}>
                                <Flag className="size-3 text-amber-500 shrink-0" />
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            {acct.hasSalesforce && <Badge variant="secondary" className="text-[9px] px-1 py-0">SF</Badge>}
                            {acct.hasStripe && <Badge variant="secondary" className="text-[9px] px-1 py-0">Stripe</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className="text-xs text-foreground truncate block max-w-[90px]">
                          {acct.csmName ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right">
                        <span className="text-sm tabular-nums">{acct.activeSubscriptionCount}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right">
                        <span className="text-sm font-medium tabular-nums">
                          {acct.activeMrrCents > 0 ? fmtCompact(acct.activeMrrCents) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {acct.signalCategories.slice(0, 3).map((cat) => (
                            <Badge key={cat} variant={CATEGORY_VARIANT[cat]} className="text-[9px] px-1.5 py-0">
                              {CATEGORY_LABEL[cat]}
                            </Badge>
                          ))}
                          {acct.signalCategories.length > 3 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              +{acct.signalCategories.length - 3}
                            </Badge>
                          )}
                          {acct.signalCategories.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-border/80 px-5 py-3.5 text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {data.totalAccounts} accounts</span>
            {filtered.length < data.totalAccounts && (
              <span className="text-primary/70">Filtered</span>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-6">
            {selectedAcct ? (
              <AccountDetail acct={selectedAcct} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-8 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
                <Search className="size-5 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No account selected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click a row to view account details, signals, and actions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
