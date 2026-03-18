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

// ---------------------------------------------------------------------------
// Bucket types & logic
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
// Status label — single compact text, not a badge
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  cancelling: { text: "Cancelling", className: "text-destructive" },
  scheduled_end: { text: "Sched. end", className: "text-amber-600 dark:text-amber-400" },
  period_ending: { text: "Period end", className: "text-muted-foreground" },
};

function statusCell(c: RenewalCandidate): { text: string; className: string } {
  if (c.subscriptionStatus === "past_due") {
    return { text: "Past due", className: "text-destructive font-medium" };
  }
  return STATUS_LABEL[c.renewalStatus] ?? { text: "—", className: "text-muted-foreground" };
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
// Due cell — date + urgency in one cell
// ---------------------------------------------------------------------------

function dueCell(iso: string) {
  const days = daysUntil(iso);
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-muted-foreground">{fmtDate(iso)}</span>
      <span
        className={cn(
          "min-w-[42px] text-right font-medium tabular-nums",
          days < 0
            ? "text-destructive"
            : days <= 1
              ? "text-orange-600 dark:text-orange-400"
              : days <= 7
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
        )}
      >
        {daysLabel(iso)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue table
// ---------------------------------------------------------------------------

interface RenewalsQueueProps {
  buckets: Bucket;
  selectedId: string | null;
  onSelect: (c: RenewalCandidate) => void;
  emptyLabel: string;
  isPending?: boolean;
}

export function RenewalsQueue({
  buckets,
  selectedId,
  onSelect,
  emptyLabel,
  isPending,
}: RenewalsQueueProps) {
  const configs = getBucketConfigs(buckets);
  const totalCount = configs.reduce((s, b) => s + b.candidates.length, 0);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}
    >
      {totalCount === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px]">Customer</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[120px]">CSM</TableHead>
              <TableHead className="w-[90px]">Billing</TableHead>
              <TableHead className="w-[90px] text-right">MRR</TableHead>
              <TableHead className="w-[150px] text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((bucket) => (
              <BucketGroup
                key={bucket.key}
                config={bucket}
                selectedId={selectedId}
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
// Bucket group: section header row + data rows
// ---------------------------------------------------------------------------

function BucketGroup({
  config,
  selectedId,
  onSelect,
}: {
  config: BucketConfig;
  selectedId: string | null;
  onSelect: (c: RenewalCandidate) => void;
}) {
  const mrrTotal = config.candidates.reduce((s, c) => s + c.mrr, 0);

  return (
    <>
      {/* Section header */}
      <TableRow className="hover:bg-transparent border-b-0">
        <TableCell
          colSpan={6}
          className={cn("py-1.5 px-3", config.accentClass)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", config.dotClass)} />
              <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
                {config.title}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {config.candidates.length}
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {fmtCompact(mrrTotal)} MRR
            </span>
          </div>
        </TableCell>
      </TableRow>

      {/* Data rows */}
      {config.candidates.map((c) => {
        const selected = selectedId === c.candidateId;
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
                : "border-l-2 border-l-transparent hover:bg-muted/50",
            )}
          >
            {/* Customer */}
            <TableCell className="py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground truncate max-w-[260px]">
                  {c.customerName}
                </span>
                {c.contract?.contractNumber && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {c.contract.contractNumber}
                  </span>
                )}
              </div>
            </TableCell>

            {/* Status */}
            <TableCell className="py-2.5">
              <span className={cn("text-xs", status.className)}>
                {status.text}
              </span>
            </TableCell>

            {/* CSM */}
            <TableCell className="py-2.5">
              <span className="text-sm text-foreground truncate block max-w-[110px]">
                {c.csmName ?? "—"}
              </span>
            </TableCell>

            {/* Billing */}
            <TableCell className="py-2.5">
              <span className="text-xs text-muted-foreground">
                {c.collectionMethod === "send_invoice" ? "Invoice" : "Auto"}
              </span>
            </TableCell>

            {/* MRR */}
            <TableCell className="py-2.5 text-right">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {fmtCompact(c.mrr)}
              </span>
            </TableCell>

            {/* Due */}
            <TableCell className="py-2.5 text-right text-xs">
              {dueCell(c.dueDate)}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
