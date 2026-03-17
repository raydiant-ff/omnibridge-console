"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CustomerDirectoryRow } from "@/lib/projections";

// ---------------------------------------------------------------------------
// Formatting helpers (column-local)
// ---------------------------------------------------------------------------

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMrr(cents: number): string {
  if (cents === 0) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

function fmtArr(approx: number | null): string {
  if (!approx) return "—";
  if (approx >= 1_000_000) return `$${(approx / 1_000_000).toFixed(1)}M`;
  if (approx >= 1_000) return `$${(approx / 1_000).toFixed(1)}K`;
  return `$${approx.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Sortable header helper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableHeader({ column, label, align = "left" }: { column: any; label: string; align?: "left" | "right" }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 gap-1 font-medium text-sm ${align === "right" ? "ml-auto flex flex-row-reverse -mr-3" : "-ml-3"}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export const customerDirectoryColumns: ColumnDef<CustomerDirectoryRow>[] = [
  // --- Customer ---
  {
    id: "customer",
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Customer" />,
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-sm truncate">{r.name}</span>
          <div className="flex items-center gap-1">
            {r.hasSalesforce ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">SF</Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-muted-foreground">SF</Badge>
            )}
            {r.hasStripe ? (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">Stripe</Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-muted-foreground">Stripe</Badge>
            )}
            {r.accountStatus && (
              <span className="text-xs text-muted-foreground">{r.accountStatus}</span>
            )}
          </div>
        </div>
      );
    },
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
  },

  // --- AE ---
  {
    id: "ae",
    accessorKey: "aeName",
    header: ({ column }) => <SortableHeader column={column} label="AE" />,
    cell: ({ row }) => {
      const v = row.original.aeName;
      return (
        <span className={`text-sm ${v ? "text-foreground" : "text-muted-foreground"}`}>
          {v ?? "—"}
        </span>
      );
    },
  },

  // --- CSM ---
  {
    id: "csm",
    accessorKey: "csmName",
    header: ({ column }) => <SortableHeader column={column} label="CSM" />,
    cell: ({ row }) => {
      const v = row.original.csmName;
      return (
        <span className={`text-sm ${v ? "text-foreground" : "text-muted-foreground"}`}>
          {v ?? "—"}
        </span>
      );
    },
  },

  // --- First Closed Won ---
  {
    id: "firstClosedWon",
    accessorKey: "firstClosedWon",
    header: ({ column }) => <SortableHeader column={column} label="First Closed Won" />,
    cell: ({ row }) => {
      const v = row.original.firstClosedWon;
      return (
        <span className={`text-sm tabular-nums ${v ? "text-foreground" : "text-muted-foreground"}`}>
          {fmtDate(v)}
        </span>
      );
    },
    sortingFn: (a, b) => {
      const av = a.original.firstClosedWon?.getTime() ?? 0;
      const bv = b.original.firstClosedWon?.getTime() ?? 0;
      return av - bv;
    },
  },

  // --- MRR ---
  {
    id: "mrr",
    accessorKey: "mrrCents",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} label="MRR" align="right" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-sm font-medium">
        {fmtMrr(row.original.mrrCents)}
      </div>
    ),
    sortingFn: (a, b) => a.original.mrrCents - b.original.mrrCents,
  },

  // --- ARR ---
  {
    id: "arr",
    accessorKey: "arrApprox",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} label="ARR" align="right" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-sm font-medium">
        {fmtArr(row.original.arrApprox)}
      </div>
    ),
    sortingFn: (a, b) => (a.original.arrApprox ?? 0) - (b.original.arrApprox ?? 0),
  },

  // --- Next Renewal ---
  {
    id: "nextRenewal",
    accessorKey: "nearestContractEnd",
    header: ({ column }) => <SortableHeader column={column} label="Next Renewal" />,
    cell: ({ row }) => {
      const days = row.original.daysToNearestRenewal;
      const date = row.original.nearestContractEnd;
      const isOverdue = days !== null && days < 0;
      const isCritical = days !== null && days >= 0 && days <= 30;
      const isDueSoon = days !== null && days > 30 && days <= 90;

      return (
        <div className="flex items-center gap-1.5">
          {(isOverdue || isCritical) && (
            <AlertTriangle
              className={`size-3.5 shrink-0 ${isOverdue ? "text-destructive" : "text-orange-500"}`}
            />
          )}
          <span
            className={`text-sm tabular-nums ${
              isOverdue
                ? "text-destructive font-medium"
                : isCritical
                  ? "text-orange-500 font-medium"
                  : isDueSoon
                    ? "text-yellow-600"
                    : date
                      ? "text-foreground"
                      : "text-muted-foreground"
            }`}
          >
            {fmtDate(date)}
          </span>
        </div>
      );
    },
    sortingFn: (a, b) => {
      const av = a.original.nearestContractEnd?.getTime() ?? Infinity;
      const bv = b.original.nearestContractEnd?.getTime() ?? Infinity;
      return av - bv;
    },
  },
];
