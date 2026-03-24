"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatDollars, formatDate, formatCurrency } from "@/lib/format";
import { freshnessVariant } from "@/lib/scrub-helpers";
import { fetchScrubDetail } from "./actions";
import type {
  ScrubDetailData,
  CanceledSubDetail,
  ActiveSubDetail,
  SubItemDetail,
  CoverageAssessment,
} from "@/lib/omni/adapters/scrub";

// ── Presentation maps ──

const COVERAGE_LABELS: Record<CoverageAssessment, string> = {
  covered_past_cancellation: "Covered past cancellation",
  covered_to_term_end: "Covered to term end",
  potential_uncovered_interval: "Potential uncovered interval",
  no_mirrored_paid_invoice: "No mirrored paid invoice found",
  historical_coverage_incomplete: "Historical coverage incomplete",
};

const COVERAGE_VARIANT: Record<
  CoverageAssessment,
  "default" | "secondary" | "destructive" | "outline"
> = {
  covered_past_cancellation: "default",
  covered_to_term_end: "default",
  potential_uncovered_interval: "destructive",
  no_mirrored_paid_invoice: "outline",
  historical_coverage_incomplete: "secondary",
};

const SF_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  matched: { label: "SF matched", variant: "default" },
  partial: { label: "Partial SF", variant: "secondary" },
  no_contract: { label: "No SF contract", variant: "outline" },
};

// ── Truncated ID ──

function TruncId({ id, className }: { id: string; className?: string }) {
  const short = id.length > 20 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id;
  return (
    <span className={cn("font-mono text-muted-foreground group/id inline-flex items-center gap-1", className)}>
      <span title={id}>{short}</span>
      <button
        className="opacity-0 group-hover/id:opacity-60 hover:!opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(id);
        }}
        title="Copy full ID"
      >
        <Copy className="size-3" />
      </button>
    </span>
  );
}

// ── Main component ──

export function ScrubDetailSheet({
  open,
  onOpenChange,
  customerId,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  month: string;
}) {
  const [data, setData] = useState<ScrubDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customerId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchScrubDetail(customerId, month)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, customerId, month]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        {loading && <SheetSkeleton />}
        {error && (
          <div className="p-6 text-sm text-destructive">{error}</div>
        )}
        {data && !loading && <SheetBody data={data} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted mt-2" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

// ── Sheet body ──

function SheetBody({ data }: { data: ScrubDetailData }) {
  const canceledArr = data.canceledSubscriptions.reduce(
    (s, c) => s + c.arrDollars,
    0,
  );
  const activeArr = data.activeSubscriptions.reduce(
    (s, a) => s + a.arrDollars,
    0,
  );

  // Derive coverage summary
  const coverageGroups = new Map<CoverageAssessment, number>();
  for (const sub of data.canceledSubscriptions) {
    const a = sub.coverage.assessment;
    coverageGroups.set(a, (coverageGroups.get(a) ?? 0) + 1);
  }

  // Derive SF summary
  const sfGroups = new Map<string, number>();
  for (const sub of data.activeSubscriptions) {
    sfGroups.set(sub.sfMatchStatus, (sfGroups.get(sub.sfMatchStatus) ?? 0) + 1);
  }

  // Concise findings
  const findings: string[] = [];
  if (data.canceledSubscriptions.length > 0)
    findings.push(
      `${data.canceledSubscriptions.length} subscription${data.canceledSubscriptions.length !== 1 ? "s" : ""} canceled this month`,
    );
  if (data.activeSubscriptions.length > 0)
    findings.push(
      `${data.activeSubscriptions.length} active subscription${data.activeSubscriptions.length !== 1 ? "s" : ""} remaining`,
    );
  else findings.push("No active subscriptions in mirrored data");
  for (const [assessment, count] of coverageGroups) {
    const total = data.canceledSubscriptions.length;
    if (count === total)
      findings.push(COVERAGE_LABELS[assessment]);
    else
      findings.push(`${count}/${total}: ${COVERAGE_LABELS[assessment]}`);
  }
  for (const [status, count] of sfGroups) {
    const badge = SF_BADGE[status];
    if (badge) findings.push(`${count} active: ${badge.label}`);
  }

  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center gap-2">
          <SheetTitle className="text-base">{data.customerName}</SheetTitle>
          <Badge
            variant={freshnessVariant(data.freshness.state)}
            className="text-[10px]"
          >
            {data.freshness.state}
          </Badge>
        </div>
        <SheetDescription className="text-[11px] text-muted-foreground">
          {data.freshness.label}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-3 px-4 pb-6">
        {/* ── Summary card ── */}
        <div className="rounded-lg border border-border bg-muted/5 p-3">
          <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-xs">
            <SummaryCell label="Canceled" value={formatDollars(canceledArr)} className="text-destructive" />
            <SummaryCell label="Active now" value={formatDollars(activeArr)} className="text-emerald-500" />
            <SummaryCell
              label="Net"
              value={`${activeArr - canceledArr > 0 ? "+" : ""}${formatDollars(Math.round((activeArr - canceledArr) * 100) / 100)}`}
              className={activeArr - canceledArr >= 0 ? "text-emerald-500" : "text-destructive"}
            />
          </div>
          {/* Findings */}
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {findings.map((f, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-muted-foreground/40 mt-px">&#8226;</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Canceled subscriptions ── */}
        <Section
          title="Canceled Subscriptions"
          count={data.canceledSubscriptions.length}
        >
          {data.canceledSubscriptions.length === 0 ? (
            <EmptyNote>No cancellations this month</EmptyNote>
          ) : (
            data.canceledSubscriptions.map((sub) => (
              <CanceledSubRow key={sub.subId} sub={sub} />
            ))
          )}
        </Section>

        {/* ── Coverage ── */}
        <Section title="Coverage Assessment">
          {data.canceledSubscriptions.length === 0 ? (
            <EmptyNote>No canceled subscriptions to assess</EmptyNote>
          ) : coverageGroups.size === 1 ? (
            // All same outcome — show summary instead of repeating
            <CoverageSummary
              assessment={[...coverageGroups.keys()][0]}
              count={data.canceledSubscriptions.length}
              confidence={data.canceledSubscriptions[0].coverage.confidence}
              evidenceSource={data.canceledSubscriptions[0].coverage.evidenceSource}
            />
          ) : (
            data.canceledSubscriptions.map((sub) => (
              <CoverageRow key={sub.subId} sub={sub} />
            ))
          )}
        </Section>

        {/* ── Active subscriptions ── */}
        <Section
          title="Active Subscriptions"
          count={data.activeSubscriptions.length}
        >
          {data.activeSubscriptions.length === 0 ? (
            <EmptyNote>No active subscriptions in mirrored data</EmptyNote>
          ) : (
            data.activeSubscriptions.map((sub) => (
              <ActiveSubRow key={sub.subId} sub={sub} />
            ))
          )}
        </Section>
      </div>
    </>
  );
}

// ── Summary cell ──

function SummaryCell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

// ── Section wrapper ──

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {count !== undefined && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {count}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground py-1">{children}</p>;
}

// ── Canceled sub row (compact, expandable) ──

function CanceledSubRow({ sub }: { sub: CanceledSubDetail }) {
  const [open, setOpen] = useState(false);
  const sfCount = sub.items.filter((i) => i.sfContractLineId).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded border border-border bg-background">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/10 transition-colors">
            {open ? (
              <ChevronDown className="size-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-foreground font-medium truncate max-w-[140px]">
              {sub.items[0]?.productName ?? "Subscription"}
              {sub.items.length > 1 && ` +${sub.items.length - 1}`}
            </span>
            <span className="text-muted-foreground">
              canceled {formatDate(sub.canceledAt)}
            </span>
            {sfCount > 0 && (
              <Badge variant="default" className="text-[9px] px-1.5 py-0">
                {sfCount} SF
              </Badge>
            )}
            <span className="ml-auto font-mono font-semibold text-destructive tabular-nums">
              {formatDollars(sub.arrDollars)}/yr
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            <ItemTable items={sub.items} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Coverage summary (when all subs share the same assessment) ──

function CoverageSummary({
  assessment,
  count,
  confidence,
  evidenceSource,
}: {
  assessment: CoverageAssessment;
  count: number;
  confidence: string;
  evidenceSource: string;
}) {
  return (
    <div className="rounded border border-border bg-background px-2.5 py-2 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={COVERAGE_VARIANT[assessment]} className="text-[10px]">
          {COVERAGE_LABELS[assessment]}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          All {count} canceled subscription{count !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        {confidence === "high"
          ? `Confirmed from ${evidenceSource}`
          : confidence === "medium"
            ? `Inferred from ${evidenceSource} — verify in Stripe`
            : `Limited evidence from ${evidenceSource} — manual review recommended`}
      </p>
    </div>
  );
}

// ── Coverage row (per-sub, shown when outcomes differ) ──

function CoverageRow({ sub }: { sub: CanceledSubDetail }) {
  const c = sub.coverage;
  return (
    <div className="rounded border border-border bg-background px-2.5 py-1.5 flex flex-col gap-0.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-foreground font-medium truncate max-w-[120px]">
          {sub.items[0]?.productName ?? sub.subId.slice(0, 15)}
        </span>
        <Badge variant={COVERAGE_VARIANT[c.assessment]} className="text-[9px]">
          {COVERAGE_LABELS[c.assessment]}
        </Badge>
        {c.confidence !== "high" && (
          <span className="text-muted-foreground/60 text-[10px]">
            {c.confidence === "medium" ? "verify in Stripe" : "manual review needed"}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">{c.notes}</p>
      {c.lastInvoiceNumber && (
        <p className="text-[10px] text-muted-foreground/70">
          Last invoice: {c.lastInvoiceNumber} &middot;{" "}
          {formatCurrency(c.lastInvoiceAmountCents)}
          {c.lastInvoicePeriodStart && c.lastInvoicePeriodEnd && (
            <>
              {" "}
              &middot; {formatDate(c.lastInvoicePeriodStart)} &ndash;{" "}
              {formatDate(c.lastInvoicePeriodEnd)}
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ── Active sub row (compact, expandable) ──

function ActiveSubRow({ sub }: { sub: ActiveSubDetail }) {
  const [open, setOpen] = useState(false);
  const sfBadge = SF_BADGE[sub.sfMatchStatus];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded border border-border bg-background">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/10 transition-colors">
            {open ? (
              <ChevronDown className="size-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-foreground font-medium truncate max-w-[140px]">
              {sub.items[0]?.productName ?? "Subscription"}
              {sub.items.length > 1 && ` +${sub.items.length - 1}`}
            </span>
            <Badge variant="default" className="text-[9px] px-1.5 py-0">
              {sub.status}
            </Badge>
            {sfBadge && (
              <Badge variant={sfBadge.variant} className="text-[9px] px-1.5 py-0">
                {sfBadge.label}
              </Badge>
            )}
            <span className="ml-auto font-mono font-semibold text-emerald-500 tabular-nums">
              {formatDollars(sub.arrDollars)}/yr
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="flex gap-3 text-[10px] text-muted-foreground px-2.5 py-1.5 bg-muted/5">
              <span>Started {formatDate(sub.startDate)}</span>
              <span>Period ends {formatDate(sub.currentPeriodEnd)}</span>
              {sub.sfContractId && (
                <TruncId id={sub.sfContractId} className="text-[10px]" />
              )}
            </div>
            <ItemTable items={sub.items} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Item table (shared, compact) ──

function ItemTable({ items }: { items: SubItemDetail[] }) {
  if (items.length === 0) return null;
  return (
    <div className="text-[11px]">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-2.5 py-1 border-t border-border first:border-t-0"
        >
          <span className="truncate flex-1 text-foreground">
            {item.productName}
          </span>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {item.quantity > 1 ? `${item.quantity}x` : ""}
          </span>
          <span className="tabular-nums font-mono text-muted-foreground shrink-0 w-16 text-right">
            {formatCurrency(item.unitAmountCents)}
          </span>
          <span className="tabular-nums font-mono font-medium shrink-0 w-14 text-right">
            {formatDollars(item.arrDollars)}
          </span>
          {item.sfContractLineId ? (
            <Badge variant="default" className="text-[8px] px-1 py-0 shrink-0">
              SF
            </Badge>
          ) : (
            <span className="w-5 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
