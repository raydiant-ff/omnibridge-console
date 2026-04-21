"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, AlertTriangle } from "lucide-react";
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
import { freshnessVariant } from "@/lib/scrub-helpers";
import type {
  OmniDataQualityReport,
  OmniDataQualityIssue,
  IssueSeverity,
  IssueType,
  WorkspaceTrustSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL = "__all__";

const SEVERITY_VARIANT: Record<IssueSeverity, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  missing_stripe_customer: "Missing Stripe Customer",
  missing_sf_account: "Missing SF Account",
  subscription_missing_sf_contract: "Sub Missing SF Contract",
  sub_item_missing_sf_line: "Item Missing SF Line",
  stale_sync: "Stale Sync",
  suspicious_account_name: "Suspicious Name",
  orphaned_record: "Orphaned Record",
  duplicate_mapping_candidate: "Duplicate Mapping",
};

const SOURCE_LABEL: Record<string, string> = {
  stripe: "Stripe",
  salesforce: "Salesforce",
};

// ---------------------------------------------------------------------------
// Detail pane
// ---------------------------------------------------------------------------

function IssueDetail({
  issue,
  onClose,
}: {
  issue: OmniDataQualityIssue;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[issue.severity]} className="text-[10px]">
              {SEVERITY_LABEL[issue.severity]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {ISSUE_TYPE_LABEL[issue.issueType] ?? issue.issueType}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold mt-1">
            {issue.displayName ?? "Unknown"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <DetailRow label="Summary" value={issue.summary} />
        <DetailRow label="Recommended Action" value={issue.recommendedAction} />
        <DetailRow label="Entity Type" value={issue.entityType} />
        <DetailRow
          label="Entity ID"
          value={
            <span className="font-mono text-xs break-all">
              {issue.entityId}
            </span>
          }
        />
        {issue.omniAccountId && (
          <DetailRow
            label="Linked Account"
            value={
              <span className="font-mono text-xs break-all">
                {issue.omniAccountId}
              </span>
            }
          />
        )}
        <DetailRow label="Source System" value={SOURCE_LABEL[issue.sourceSystem] ?? issue.sourceSystem} />
        <DetailRow
          label="Freshness"
          value={
            <Badge variant={freshnessVariant(issue.freshness.state)} className="text-[10px]">
              {issue.freshness.state}
            </Badge>
          }
        />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-foreground flex-1">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main queue
// ---------------------------------------------------------------------------

export function DataQualityQueue({
  report,
  trust,
  initialAccountFilter = null,
}: {
  report: OmniDataQualityReport;
  trust: WorkspaceTrustSummary;
  initialAccountFilter?: string | null;
}) {
  const [severityFilter, setSeverityFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [accountFilter, setAccountFilter] = useState<string | null>(initialAccountFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Distinct issue types in the data
  const issueTypes = useMemo(() => {
    const types = new Set(report.issues.map((i) => i.issueType));
    return [...types].sort();
  }, [report.issues]);

  // Distinct sources
  const sources = useMemo(() => {
    const s = new Set(report.issues.map((i) => i.sourceSystem));
    return [...s].sort();
  }, [report.issues]);

  // Account filter display name
  const accountDisplayName = useMemo(() => {
    if (!accountFilter) return null;
    const match = report.issues.find((i) => i.omniAccountId === accountFilter);
    return match?.displayName ?? accountFilter;
  }, [accountFilter, report.issues]);

  // Filtered issues
  const filtered = useMemo(() => {
    let items = report.issues;

    if (accountFilter) {
      items = items.filter((i) => i.omniAccountId === accountFilter);
    }
    if (severityFilter !== ALL) {
      items = items.filter((i) => i.severity === severityFilter);
    }
    if (typeFilter !== ALL) {
      items = items.filter((i) => i.issueType === typeFilter);
    }
    if (sourceFilter !== ALL) {
      items = items.filter((i) => i.sourceSystem === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.displayName ?? "").toLowerCase().includes(q) ||
          i.entityId.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q),
      );
    }

    return items;
  }, [report.issues, accountFilter, severityFilter, typeFilter, sourceFilter, searchQuery]);

  const selectedIssue = selectedIssueId
    ? report.issues.find((i) => i.issueId === selectedIssueId) ?? null
    : null;

  // KPI stats
  const stats = [
    { label: "Total", value: String(report.totalCount) },
    {
      label: "Critical",
      value: String(report.criticalCount),
      variant: report.criticalCount > 0 ? ("danger" as const) : undefined,
    },
    {
      label: "High",
      value: String(report.highCount),
      variant: report.highCount > 0 ? ("danger" as const) : undefined,
    },
    { label: "Medium", value: String(report.mediumCount) },
    { label: "Low", value: String(report.lowCount) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={accountFilter ? `Data Quality — ${accountDisplayName}` : "Data Quality"}
        description="Stripe and Salesforce mirror degradation that needs operational cleanup."
        actions={
          <FilterBar>
            <FilterField label="Severity">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Type">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  {issueTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ISSUE_TYPE_LABEL[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Source">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABEL[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>
        }
      />

      <StatStrip stats={stats} className="rounded-xl" />

      {/* Trust indicator */}
      {trust.showWarning && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/60 px-4 py-3">
          <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-foreground">Mirror freshness affects Stripe/Salesforce degradation visibility. {trust.summaryLabel}</span>
          <Link href="/admin/sync" className="text-xs text-primary hover:underline ml-auto shrink-0">
            Sync status
          </Link>
        </div>
      )}

      {/* Account filter banner */}
      {accountFilter && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Filtered to:</span>
          <span className="font-medium text-foreground">{accountDisplayName}</span>
          <button
            type="button"
            onClick={() => setAccountFilter(null)}
            className="ml-auto rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name, ID, or summary..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      {/* Split: table + detail */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]">
        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 px-5">Severity</TableHead>
                  <TableHead className="px-5">Type</TableHead>
                  <TableHead className="px-5">Name</TableHead>
                  <TableHead className="w-24 px-5">Source</TableHead>
                  <TableHead className="w-10 px-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center">
                      <p className="text-sm font-medium text-foreground">No issues match</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {accountFilter
                          ? "This account has no matching issues. Try removing the account filter."
                          : "Try adjusting your severity, type, or source filters."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((issue) => (
                    <TableRow
                      key={issue.issueId}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/25",
                        selectedIssueId === issue.issueId && "bg-primary/[0.05] shadow-[inset_3px_0_0_0_var(--color-primary)]",
                      )}
                      onClick={() =>
                        setSelectedIssueId(
                          selectedIssueId === issue.issueId ? null : issue.issueId,
                        )
                      }
                    >
                      <TableCell className="px-5 py-4">
                        <Badge
                          variant={SEVERITY_VARIANT[issue.severity]}
                          className="text-[10px]"
                        >
                          {SEVERITY_LABEL[issue.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-xs">
                        {ISSUE_TYPE_LABEL[issue.issueType] ?? issue.issueType}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <span className="text-sm font-medium truncate block max-w-[300px]">
                          {issue.displayName ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-xs text-muted-foreground">
                        {SOURCE_LABEL[issue.sourceSystem] ?? issue.sourceSystem}
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
            <span>Showing {filtered.length} of {report.totalCount} issues</span>
            {filtered.length < report.totalCount && (
              <span className="text-primary/70">Filtered</span>
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            {selectedIssue ? (
              <IssueDetail
                issue={selectedIssue}
                onClose={() => setSelectedIssueId(null)}
              />
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-8 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
                <Search className="size-5 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No issue selected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click a row to view issue details, context, and recommended actions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
