"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RenewalCandidate } from "@/lib/queries/cs-renewals";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): number {
  const end = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `${Math.abs(d)}d over`;
  if (d === 0) return "Today";
  return `${d}d`;
}

function urgencyClass(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "text-destructive";
  if (d <= 1) return "text-orange-600 dark:text-orange-400";
  if (d <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Bucket types & logic (unchanged, exported for KPI strip)
// ---------------------------------------------------------------------------

export interface Bucket {
  overdue: RenewalCandidate[];
  dueToday: RenewalCandidate[];
  dueSoon: RenewalCandidate[];
  onTrack: RenewalCandidate[];
}

export function bucketCandidates(
  candidates: RenewalCandidate[],
  overdue: RenewalCandidate[],
): Bucket {
  const overdueAll: RenewalCandidate[] = [];
  const dueToday: RenewalCandidate[] = [];
  const dueSoon: RenewalCandidate[] = [];
  const onTrack: RenewalCandidate[] = [];

  const seen = new Set<string>();
  const all: RenewalCandidate[] = [];
  for (const c of [...overdue, ...candidates]) {
    if (seen.has(c.candidateId)) continue;
    seen.add(c.candidateId);
    all.push(c);
  }
  for (const c of all) {
    const days = daysUntil(c.dueDate);
    if (days < 0) overdueAll.push(c);
    else if (days === 0) dueToday.push(c);
    else if (days <= 7) dueSoon.push(c);
    else onTrack.push(c);
  }

  const byMrr = (a: RenewalCandidate, b: RenewalCandidate) => b.mrr - a.mrr;
  return {
    overdue: overdueAll.sort(byMrr),
    dueToday: dueToday.sort(byMrr),
    dueSoon: dueSoon.sort(byMrr),
    onTrack: onTrack.sort(byMrr),
  };
}

// ---------------------------------------------------------------------------
// Status — single compact label
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, { text: string; className: string; severity: number }> = {
  cancelling: { text: "Cancelling", className: "text-destructive", severity: 3 },
  scheduled_end: { text: "Sched. end", className: "text-amber-600 dark:text-amber-400", severity: 2 },
  period_ending: { text: "Period end", className: "text-muted-foreground", severity: 1 },
};

function statusCell(c: RenewalCandidate): { text: string; className: string; severity: number } {
  if (c.subscriptionStatus === "past_due") {
    return { text: "Past due", className: "text-destructive font-medium", severity: 4 };
  }
  return STATUS_LABEL[c.renewalStatus] ?? { text: "—", className: "text-muted-foreground", severity: 0 };
}

// ---------------------------------------------------------------------------
// Customer grouping
// ---------------------------------------------------------------------------

interface CustomerGroup {
  customerId: string;
  customerName: string;
  csmName: string | null;
  contractCount: number;
  totalMrr: number;
  earliestDueDate: string;
  worstStatus: { text: string; className: string };
  candidates: RenewalCandidate[];
}

function groupByCustomer(candidates: RenewalCandidate[]): CustomerGroup[] {
  const map = new Map<string, RenewalCandidate[]>();
  for (const c of candidates) {
    const key = c.customerId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  const groups: CustomerGroup[] = [];
  for (const [customerId, children] of map) {
    const totalMrr = children.reduce((s, c) => s + c.mrr, 0);
    const earliestDueDate = children.reduce(
      (min, c) => (c.dueDate < min ? c.dueDate : min),
      children[0].dueDate,
    );

    // Worst status: highest severity wins
    let worst = statusCell(children[0]);
    for (let i = 1; i < children.length; i++) {
      const s = statusCell(children[i]);
      if (s.severity > worst.severity) worst = s;
    }

    groups.push({
      customerId,
      customerName: children[0].customerName,
      csmName: children[0].csmName,
      contractCount: children.length,
      totalMrr,
      earliestDueDate,
      worstStatus: worst,
      candidates: children.sort((a, b) => b.mrr - a.mrr),
    });
  }

  return groups.sort((a, b) => b.totalMrr - a.totalMrr);
}

// ---------------------------------------------------------------------------
// Bucket section config
// ---------------------------------------------------------------------------

interface BucketConfig {
  key: string;
  title: string;
  accentClass: string;
  dotClass: string;
  candidates: RenewalCandidate[];
}

function getBucketConfigs(buckets: Bucket): BucketConfig[] {
  return [
    {
      key: "overdue",
      title: "Overdue",
      accentClass: "bg-destructive/5 dark:bg-destructive/10",
      dotClass: "bg-destructive",
      candidates: buckets.overdue,
    },
    {
      key: "dueToday",
      title: "Due Today",
      accentClass: "bg-orange-500/5 dark:bg-orange-500/10",
      dotClass: "bg-orange-500",
      candidates: buckets.dueToday,
    },
    {
      key: "dueSoon",
      title: "Due Soon",
      accentClass: "bg-amber-500/5 dark:bg-amber-500/10",
      dotClass: "bg-amber-500",
      candidates: buckets.dueSoon,
    },
    {
      key: "onTrack",
      title: "On Track",
      accentClass: "",
      dotClass: "bg-emerald-500",
      candidates: buckets.onTrack,
    },
  ].filter((b) => b.candidates.length > 0);
}

// ---------------------------------------------------------------------------
// Queue table — customer-grouped
// ---------------------------------------------------------------------------

interface RenewalsQueueProps {
  buckets: Bucket;
  selectedId: string | null;
  onSelect: (c: RenewalCandidate) => void;
  emptyLabel: string;
}

export function RenewalsQueue({
  buckets,
  selectedId,
  onSelect,
  emptyLabel,
}: RenewalsQueueProps) {
  const configs = getBucketConfigs(buckets);
  const totalCount = configs.reduce((s, b) => s + b.candidates.length, 0);

  // Expand state: set of customerIds that are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand the group containing the selected candidate
  useEffect(() => {
    if (!selectedId) return;
    for (const config of configs) {
      for (const c of config.candidates) {
        if (c.candidateId === selectedId) {
          setExpanded((prev) => {
            if (prev.has(c.customerId)) return prev;
            return new Set(prev).add(c.customerId);
          });
          return;
        }
      }
    }
  }, [selectedId, configs]);

  function toggleExpand(customerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {totalCount === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30px] pl-3 pr-0" />
              <TableHead className="w-[240px]">Customer</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[110px]">CSM</TableHead>
              <TableHead className="w-[70px]">Billing</TableHead>
              <TableHead className="w-[80px] text-right">MRR</TableHead>
              <TableHead className="w-[140px] text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((bucket) => (
              <BucketGroup
                key={bucket.key}
                config={bucket}
                expanded={expanded}
                selectedId={selectedId}
                onToggle={toggleExpand}
                onSelect={onSelect}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bucket group: section header + customer groups
// ---------------------------------------------------------------------------

function BucketGroup({
  config,
  expanded,
  selectedId,
  onToggle,
  onSelect,
}: {
  config: BucketConfig;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (customerId: string) => void;
  onSelect: (c: RenewalCandidate) => void;
}) {
  const groups = groupByCustomer(config.candidates);
  const mrrTotal = config.candidates.reduce((s, c) => s + c.mrr, 0);

  return (
    <>
      {/* Section header */}
      <TableRow className="hover:bg-transparent border-b-0">
        <TableCell colSpan={7} className={cn("py-1.5 px-3", config.accentClass)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", config.dotClass)} />
              <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
                {config.title}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {config.candidates.length} contracts · {groups.length} customers
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {fmtCompact(mrrTotal)} MRR
            </span>
          </div>
        </TableCell>
      </TableRow>

      {/* Customer groups */}
      {groups.map((group) => {
        const isExpanded = expanded.has(group.customerId);
        const isSingle = group.contractCount === 1;
        // For single-contract customers, the parent row IS the contract row
        const singleCandidate = isSingle ? group.candidates[0] : null;
        const hasSelectedChild = group.candidates.some(
          (c) => c.candidateId === selectedId,
        );

        return (
          <CustomerGroupRows
            key={group.customerId}
            group={group}
            isExpanded={isExpanded || hasSelectedChild}
            isSingle={isSingle}
            singleCandidate={singleCandidate}
            selectedId={selectedId}
            onToggle={() => onToggle(group.customerId)}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Customer group: parent row + optional child rows
// ---------------------------------------------------------------------------

function CustomerGroupRows({
  group,
  isExpanded,
  isSingle,
  singleCandidate,
  selectedId,
  onToggle,
  onSelect,
}: {
  group: CustomerGroup;
  isExpanded: boolean;
  isSingle: boolean;
  singleCandidate: RenewalCandidate | null;
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (c: RenewalCandidate) => void;
}) {
  const hasSelectedChild = group.candidates.some(
    (c) => c.candidateId === selectedId,
  );

  // Single-contract customer: clicking the row selects the contract directly
  function handleParentClick() {
    if (isSingle && singleCandidate) {
      onSelect(singleCandidate);
    } else {
      onToggle();
    }
  }

  const parentSelected = isSingle && singleCandidate?.candidateId === selectedId;

  return (
    <>
      {/* Parent row — customer summary */}
      <TableRow
        data-state={parentSelected ? "selected" : undefined}
        onClick={handleParentClick}
        className={cn(
          "cursor-pointer transition-colors",
          parentSelected
            ? "bg-primary/[0.06] dark:bg-primary/[0.12] border-l-2 border-l-primary"
            : hasSelectedChild && !isSingle
              ? "bg-muted/30 border-l-2 border-l-primary/40"
              : "border-l-2 border-l-transparent hover:bg-muted/50",
        )}
      >
        {/* Expand chevron */}
        <TableCell className="py-2 pl-3 pr-0 w-[30px]">
          {!isSingle && (
            <ChevronRight
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          )}
        </TableCell>

        {/* Customer name + contract count */}
        <TableCell className="py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {group.customerName}
            </span>
            {!isSingle && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.contractCount}
              </span>
            )}
            {isSingle && singleCandidate?.contract?.contractNumber && (
              <span className="text-xs text-muted-foreground font-mono">
                {singleCandidate.contract.contractNumber}
              </span>
            )}
          </div>
        </TableCell>

        {/* Status — worst across children */}
        <TableCell className="py-2">
          <span className={cn("text-xs", group.worstStatus.className)}>
            {group.worstStatus.text}
          </span>
        </TableCell>

        {/* CSM */}
        <TableCell className="py-2">
          <span className="text-sm text-foreground truncate block max-w-[100px]">
            {group.csmName ?? "—"}
          </span>
        </TableCell>

        {/* Billing — show for single, dash for multi */}
        <TableCell className="py-2">
          {isSingle && singleCandidate ? (
            <span className="text-xs text-muted-foreground">
              {singleCandidate.collectionMethod === "send_invoice" ? "Invoice" : "Auto"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* MRR — total */}
        <TableCell className="py-2 text-right">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {fmtCompact(group.totalMrr)}
          </span>
        </TableCell>

        {/* Due — earliest */}
        <TableCell className="py-2 text-right text-xs">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-muted-foreground">{fmtDate(group.earliestDueDate)}</span>
            <span className={cn("min-w-[42px] text-right font-medium tabular-nums", urgencyClass(group.earliestDueDate))}>
              {daysLabel(group.earliestDueDate)}
            </span>
          </div>
        </TableCell>
      </TableRow>

      {/* Child rows — visible when expanded (multi-contract only) */}
      {!isSingle && isExpanded && group.candidates.map((c) => {
        const selected = c.candidateId === selectedId;
        const status = statusCell(c);

        return (
          <TableRow
            key={c.candidateId}
            data-state={selected ? "selected" : undefined}
            onClick={() => onSelect(c)}
            className={cn(
              "cursor-pointer transition-colors",
              selected
                ? "bg-primary/[0.06] dark:bg-primary/[0.12] border-l-2 border-l-primary"
                : "border-l-2 border-l-transparent hover:bg-muted/30",
            )}
          >
            {/* Indent spacer */}
            <TableCell className="py-1.5 pl-3 pr-0" />

            {/* Contract # */}
            <TableCell className="py-1.5 pl-8">
              <span className="text-xs text-muted-foreground font-mono">
                {c.contract?.contractNumber ?? c.id.slice(0, 20)}
              </span>
            </TableCell>

            {/* Status */}
            <TableCell className="py-1.5">
              <span className={cn("text-xs", status.className)}>
                {status.text}
              </span>
            </TableCell>

            {/* CSM — omit in child (same as parent) */}
            <TableCell className="py-1.5" />

            {/* Billing */}
            <TableCell className="py-1.5">
              <span className="text-xs text-muted-foreground">
                {c.collectionMethod === "send_invoice" ? "Invoice" : "Auto"}
              </span>
            </TableCell>

            {/* MRR */}
            <TableCell className="py-1.5 text-right">
              <span className="text-xs font-medium tabular-nums text-foreground">
                {fmtCompact(c.mrr)}
              </span>
            </TableCell>

            {/* Due */}
            <TableCell className="py-1.5 text-right text-xs">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-muted-foreground">{fmtDate(c.dueDate)}</span>
                <span className={cn("min-w-[42px] text-right font-medium tabular-nums", urgencyClass(c.dueDate))}>
                  {daysLabel(c.dueDate)}
                </span>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
