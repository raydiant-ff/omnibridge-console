"use client";

import { useState, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type {
  ScrubRow,
  ScrubSummary,
} from "@/lib/omni/adapters/scrub";
import { getSnapshotLabel, freshnessVariant } from "@/lib/scrub-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { formatDollars } from "@/lib/format";
import { ScrubDetailSheet } from "./scrub-detail-sheet";

// ── Grid — Customer | Canceled | Snapshot | Replaced | Net | Outcome | Action ──

const GRID =
  "grid grid-cols-[1.6fr_90px_100px_90px_90px_90px_60px]";

// ── Outcome styling ──

const OUTCOME_VARIANT: Record<
  ScrubRow["classification"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  churned: "destructive",
  contracted: "outline",
  offset: "secondary",
  expanded: "default",
};

const OUTCOME_LABEL: Record<ScrubRow["classification"], string> = {
  churned: "Churned",
  contracted: "Contracted",
  offset: "Offset",
  expanded: "Expanded",
};

// ── Row ──

function AccountRow({
  row,
  onReview,
}: {
  row: ScrubRow;
  onReview: () => void;
}) {
  const net = row.netArrDollars;

  return (
    <TableBody>
      <TableRow
        className={cn(GRID, "bg-background hover:bg-muted/10 cursor-pointer")}
        onClick={onReview}
      >
        {/* Customer */}
        <TableCell className="px-3 py-2.5">
          <span className="text-sm font-medium leading-tight truncate block">
            {row.customerName}
          </span>
        </TableCell>

        {/* Canceled */}
        <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-sm text-destructive">
          {formatDollars(row.canceledArrDollars)}
        </TableCell>

        {/* Snapshot */}
        <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-sm text-muted-foreground">
          {row.snapshotArrDollars > 0
            ? formatDollars(row.snapshotArrDollars)
            : "-"}
        </TableCell>

        {/* Replaced */}
        <TableCell className="px-3 py-2.5 text-right font-mono tabular-nums text-sm text-emerald-500">
          {row.newArrDollars > 0 ? formatDollars(row.newArrDollars) : "-"}
        </TableCell>

        {/* Net */}
        <TableCell className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-sm">
          <span
            className={
              net > 0
                ? "text-emerald-500"
                : net < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {net > 0 ? "+" : ""}
            {formatDollars(net)}
          </span>
        </TableCell>

        {/* Outcome */}
        <TableCell className="px-3 py-2.5">
          <Badge
            variant={OUTCOME_VARIANT[row.classification]}
            className="text-[11px]"
          >
            {OUTCOME_LABEL[row.classification]}
          </Badge>
        </TableCell>

        {/* Action */}
        <TableCell className="px-2 py-2.5">
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onReview();
            }}
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    </TableBody>
  );
}

// ── Summary strip ──

function SummaryStrip({ summary }: { summary: ScrubSummary }) {
  return (
    <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-3">
      <Metric
        label="Accounts"
        value={String(summary.totalAccounts)}
      />
      <Divider />
      <Metric
        label="Canceled"
        value={formatDollars(summary.totalCanceledArr)}
        className="text-destructive"
      />
      <Divider />
      <Metric
        label="Replaced"
        value={formatDollars(summary.totalNewArr)}
        className="text-emerald-500"
      />
      <Divider />
      <Metric
        label="Net impact"
        value={`${summary.totalNetArr > 0 ? "+" : ""}${formatDollars(summary.totalNetArr)}`}
        className={summary.totalNetArr < 0 ? "text-destructive" : "text-emerald-500"}
      />
      <Divider />
      <Metric label="Churned" value={String(summary.churned)} className="text-destructive" />
      <Metric label="Contracted" value={String(summary.contracted)} />
      <Metric label="Offset" value={String(summary.offset)} />
      <Metric label="Expanded" value={String(summary.expanded)} />
    </div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-border" />;
}

// ── Main ──

const ALL = "all";

export function ScrubTable({
  rows,
  summary,
  month,
}: {
  rows: ScrubRow[];
  summary: ScrubSummary;
  month: string;
}) {
  const [classFilter, setClassFilter] = useState(ALL);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );

  const snapshotLabel = getSnapshotLabel(month);

  const filteredRows = useMemo(
    () =>
      classFilter === ALL
        ? rows
        : rows.filter((r) => r.classification === classFilter),
    [rows, classFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Freshness banner */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge
          variant={freshnessVariant(summary.freshness.state)}
          className="text-[10px]"
        >
          {summary.freshness.state}
        </Badge>
        <span>{summary.freshness.label}</span>
        {summary.freshness.state !== "fresh" && (
          <span className="text-muted-foreground/70">
            — verify important cases in Stripe/Salesforce
          </span>
        )}
      </div>

      {/* Compact summary strip */}
      <SummaryStrip summary={summary} />

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[140px] h-7 text-xs">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All outcomes</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
            <SelectItem value="contracted">Contracted</SelectItem>
            <SelectItem value="offset">Offset</SelectItem>
            <SelectItem value="expanded">Expanded</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} account
          {filteredRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={cn(GRID, "bg-muted/30")}>
                <TableHead className="px-3 py-2 text-xs font-semibold text-foreground">
                  Customer
                </TableHead>
                <TableHead className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                  Canceled
                </TableHead>
                <TableHead className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                  {snapshotLabel}
                </TableHead>
                <TableHead className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                  Replaced
                </TableHead>
                <TableHead className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                  Net
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold text-foreground">
                  Outcome
                </TableHead>
                <TableHead className="px-2 py-2" />
              </TableRow>
            </TableHeader>
            {filteredRows.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No accounts match the current filter.
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              filteredRows.map((row) => (
                <AccountRow
                  key={row.stripeCustomerId}
                  row={row}
                  onReview={() =>
                    setSelectedCustomerId(row.stripeCustomerId)
                  }
                />
              ))
            )}
          </Table>
        </div>
      </div>

      {/* Detail sheet */}
      <ScrubDetailSheet
        open={!!selectedCustomerId}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerId(null);
        }}
        customerId={selectedCustomerId}
        month={month}
      />
    </div>
  );
}
