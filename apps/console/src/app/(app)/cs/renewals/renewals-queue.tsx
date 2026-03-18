import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ListShell, ListRow, ListRowTitle, ListRowDetail } from "@/components/omni";
import type { RenewalCandidate } from "@/lib/queries/cs-renewals";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function daysUntil(iso: string): number {
  const end = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
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
// Bucket section header
// ---------------------------------------------------------------------------

const BUCKET_STYLES: Record<string, string> = {
  overdue: "bg-destructive",
  dueToday: "bg-orange-500",
  dueSoon: "bg-amber-500",
  onTrack: "bg-emerald-500",
};

function BucketHeader({
  title,
  count,
  mrrTotal,
  bucketKey,
}: {
  title: string;
  count: number;
  mrrTotal: number;
  bucketKey: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-2.5 bg-muted/30 border-y">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", BUCKET_STYLES[bucketKey])} />
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <span className="text-xs font-medium tabular-nums text-foreground">
        {fmtCompact(mrrTotal)} MRR
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue panel
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
  const totalCount =
    buckets.overdue.length +
    buckets.dueToday.length +
    buckets.dueSoon.length +
    buckets.onTrack.length;

  return (
    <ListShell
      title="Queue"
      count={totalCount}
      isEmpty={totalCount === 0}
      empty={
        <div className="py-16 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      }
      className={cn(
        "overflow-hidden",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}
    >
      <BucketGroup
        title="Overdue"
        bucketKey="overdue"
        candidates={buckets.overdue}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <BucketGroup
        title="Due today"
        bucketKey="dueToday"
        candidates={buckets.dueToday}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <BucketGroup
        title="Due soon"
        bucketKey="dueSoon"
        candidates={buckets.dueSoon}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      <BucketGroup
        title="On track"
        bucketKey="onTrack"
        candidates={buckets.onTrack}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </ListShell>
  );
}

// ---------------------------------------------------------------------------
// Bucket group (header + rows)
// ---------------------------------------------------------------------------

function BucketGroup({
  title,
  bucketKey,
  candidates,
  selectedId,
  onSelect,
}: {
  title: string;
  bucketKey: string;
  candidates: RenewalCandidate[];
  selectedId: string | null;
  onSelect: (c: RenewalCandidate) => void;
}) {
  if (candidates.length === 0) return null;

  const mrrTotal = candidates.reduce((s, c) => s + c.mrr, 0);

  return (
    <div>
      <BucketHeader
        title={title}
        count={candidates.length}
        mrrTotal={mrrTotal}
        bucketKey={bucketKey}
      />
      {candidates.map((c) => (
        <CandidateRow
          key={c.candidateId}
          c={c}
          selected={selectedId === c.candidateId}
          onSelect={() => onSelect(c)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate row — built on ListRow
// ---------------------------------------------------------------------------

function CandidateRow({
  c,
  selected,
  onSelect,
}: {
  c: RenewalCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const days = daysUntil(c.dueDate);

  return (
    <ListRow
      onClick={onSelect}
      selected={selected}
      compact
      value={
        <span className="text-sm font-medium tabular-nums text-foreground">
          {fmtCompact(c.mrr * 12)}
        </span>
      }
      meta={
        <span
          className={cn(
            "text-xs font-medium whitespace-nowrap tabular-nums",
            days < 0
              ? "text-destructive"
              : days <= 7
                ? "text-amber-500"
                : "text-muted-foreground",
          )}
        >
          {daysLabel(c.dueDate)}
        </span>
      }
    >
      <ListRowTitle>
        <span className="text-sm font-medium truncate text-foreground">
          {c.customerName}
        </span>
        {c.renewalStatus === "cancelling" && (
          <Badge variant="destructive" className="text-[10px]">Cancelling</Badge>
        )}
        {c.subscriptionStatus === "past_due" && (
          <Badge variant="destructive" className="text-[10px]">Past due</Badge>
        )}
      </ListRowTitle>
      <ListRowDetail>
        {c.csmName && <span>{c.csmName}</span>}
        {c.csmName && c.contract?.contractNumber && <span>·</span>}
        {c.contract?.contractNumber && (
          <span className="font-mono">{c.contract.contractNumber}</span>
        )}
        <span>·</span>
        <span>{c.collectionMethod === "send_invoice" ? "Invoice" : "Auto"}</span>
      </ListRowDetail>
    </ListRow>
  );
}
