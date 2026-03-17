"use client";

import { useState, useMemo, useRef } from "react";
import { Download, ArrowUpDown, BarChart3, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Toolbar, ToolbarIconButton } from "@/components/workspace";
import type { RenewalCandidate } from "@/lib/queries/cs-renewals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField =
  | "customerName"
  | "csmName"
  | "arr"
  | "mrr"
  | "contractNumber"
  | "contractStatus"
  | "startDate"
  | "endDate"
  | "daysUntil"
  | "ownerName"
  | "collectionMethod"
  | "renewalStatus"
  | "subscriptionStatus";

type SortDir = "asc" | "desc";

type FilterType = "text" | "select";

type Filters = Partial<Record<SortField, string>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  return `${d}d`;
}

function collectionLabel(method: string): string {
  return method === "send_invoice" ? "Invoice" : "Auto-charge";
}

function renewalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    cancelling: "Cancelling",
    scheduled_end: "Schedule Ending",
    period_ending: "Period Ending",
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

function sortValue(c: RenewalCandidate, field: SortField): string | number {
  switch (field) {
    case "customerName": return c.customerName.toLowerCase();
    case "csmName": return (c.csmName ?? "").toLowerCase();
    case "arr": return c.mrr * 12;
    case "mrr": return c.mrr;
    case "contractNumber": return c.contract?.contractNumber ?? "";
    case "contractStatus": return c.contract?.status ?? "";
    case "startDate": return c.contract?.startDate ?? "";
    case "endDate": return c.contract?.endDate ?? "";
    case "daysUntil": return daysUntil(c.dueDate);
    case "ownerName": return (c.contract?.ownerName ?? "").toLowerCase();
    case "collectionMethod": return c.collectionMethod;
    case "renewalStatus": return c.renewalStatus;
    case "subscriptionStatus": return c.subscriptionStatus ?? "";
  }
}

function compareCandidates(a: RenewalCandidate, b: RenewalCandidate, field: SortField, dir: SortDir): number {
  const va = sortValue(a, field);
  const vb = sortValue(b, field);
  const cmp = typeof va === "number" && typeof vb === "number"
    ? va - vb
    : String(va).localeCompare(String(vb));
  return dir === "asc" ? cmp : -cmp;
}

// ---------------------------------------------------------------------------
// Filter logic
// ---------------------------------------------------------------------------

function displayValue(c: RenewalCandidate, field: SortField): string {
  switch (field) {
    case "customerName": return c.customerName;
    case "csmName": return c.csmName ?? "";
    case "arr": return String(Math.round((c.mrr * 12) / 100));
    case "mrr": return String(Math.round(c.mrr / 100));
    case "contractNumber": return c.contract?.contractNumber ?? "";
    case "contractStatus": return c.contract?.status ?? "";
    case "startDate": return c.contract?.startDate ?? "";
    case "endDate": return c.contract?.endDate ?? "";
    case "daysUntil": return String(daysUntil(c.dueDate));
    case "ownerName": return c.contract?.ownerName ?? "";
    case "collectionMethod": return collectionLabel(c.collectionMethod);
    case "renewalStatus": return renewalStatusLabel(c.renewalStatus);
    case "subscriptionStatus": return c.subscriptionStatus ?? "";
  }
}

function matchesFilter(c: RenewalCandidate, field: SortField, filterVal: string): boolean {
  const val = displayValue(c, field);
  // For select-type columns, exact match
  const col = COLUMNS.find((col) => col.field === field);
  if (col?.filterType === "select") {
    return val === filterVal;
  }
  // For text columns, case-insensitive includes
  return val.toLowerCase().includes(filterVal.toLowerCase());
}

function applyFilters(candidates: RenewalCandidate[], filters: Filters): RenewalCandidate[] {
  return candidates.filter((c) => {
    for (const [field, filterVal] of Object.entries(filters)) {
      if (!filterVal) continue;
      if (!matchesFilter(c, field as SortField, filterVal)) return false;
    }
    return true;
  });
}

function getDistinctValues(candidates: RenewalCandidate[], field: SortField): string[] {
  const set = new Set<string>();
  for (const c of candidates) {
    const v = displayValue(c, field);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildCsv(rows: RenewalCandidate[]): string {
  const headers = [
    "Customer", "CSM", "ARR", "MRR", "Contract #", "Contract Status",
    "Start Date", "End Date", "Days Until", "Opp Owner", "Billing Method",
    "Renewal Status", "Sub Status", "Subscription ID", "Currency",
  ];

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = rows.map((c) => [
    escape(c.customerName),
    escape(c.csmName ?? ""),
    ((c.mrr * 12) / 100).toFixed(0),
    (c.mrr / 100).toFixed(0),
    escape(c.contract?.contractNumber ?? ""),
    escape(c.contract?.status ?? ""),
    c.contract?.startDate ?? "",
    c.contract?.endDate ?? "",
    String(daysUntil(c.dueDate)),
    escape(c.contract?.ownerName ?? ""),
    collectionLabel(c.collectionMethod),
    renewalStatusLabel(c.renewalStatus),
    c.subscriptionStatus ?? "",
    c.id,
    c.currency.toUpperCase(),
  ].join(","));

  return [headers.join(","), ...lines].join("\n");
}

function downloadCsv(rows: RenewalCandidate[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `renewals-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

const COLUMNS: { field: SortField; label: string; align?: "right"; filterType: FilterType }[] = [
  { field: "customerName", label: "Customer", filterType: "text" },
  { field: "csmName", label: "CSM", filterType: "select" },
  { field: "arr", label: "ARR", align: "right", filterType: "text" },
  { field: "mrr", label: "MRR", align: "right", filterType: "text" },
  { field: "contractNumber", label: "Contract #", filterType: "text" },
  { field: "contractStatus", label: "Status", filterType: "select" },
  { field: "startDate", label: "Start", filterType: "text" },
  { field: "endDate", label: "End", filterType: "text" },
  { field: "daysUntil", label: "Days", align: "right", filterType: "text" },
  { field: "ownerName", label: "Opp Owner", filterType: "select" },
  { field: "collectionMethod", label: "Billing", filterType: "select" },
  { field: "renewalStatus", label: "Renewal", filterType: "select" },
  { field: "subscriptionStatus", label: "Sub Status", filterType: "select" },
];

// ---------------------------------------------------------------------------
// Filter dropdown component
// ---------------------------------------------------------------------------

function ColumnFilter({
  col,
  value,
  options,
  onChange,
  onClear,
}: {
  col: typeof COLUMNS[number];
  value: string;
  options: string[];
  onChange: (val: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          "inline-flex items-center gap-0.5 rounded p-0.5 transition-colors",
          value ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground",
        )}
      >
        <Filter className="size-3" />
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            className="rounded-full hover:bg-muted p-0.5"
          >
            <X className="size-2.5" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 min-w-[180px] max-h-[240px] overflow-y-auto bg-card rounded-lg border shadow-lg p-1"
            style={{ top: pos.top, left: pos.left }}
          >
            {col.filterType === "select" ? (
              <>
                <button
                  type="button"
                  onClick={() => { onClear(); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors",
                    !value ? "bg-muted/50 font-medium text-foreground" : "text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  All
                </button>
                {options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors",
                      value === opt ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted/30",
                    )}
                  >
                    {opt || "(empty)"}
                  </button>
                ))}
              </>
            ) : (
              <div className="p-1">
                <input
                  type="text"
                  placeholder={`Filter ${col.label.toLowerCase()}...`}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setOpen(false); }}
                  autoFocus
                  className="w-full text-xs bg-transparent border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RenewalsReportTable({
  candidates,
}: {
  candidates: RenewalCandidate[];
}) {
  const [sortField, setSortField] = useState<SortField>("arr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Filters>({});
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "customerName" || field === "csmName" ? "asc" : "desc");
    }
  }

  function setFilter(field: SortField, value: string) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  function clearFilter(field: SortField) {
    setFilters((f) => {
      const next = { ...f };
      delete next[field];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
    setDateFrom("");
    setDateTo("");
  }

  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (hasDateFilter ? 1 : 0);

  // Date-range filtered candidates (by contract end date)
  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return candidates;
    return candidates.filter((c) => {
      const end = c.contract?.endDate;
      if (!end) return false;
      if (dateFrom && end < dateFrom) return false;
      if (dateTo && end > dateTo) return false;
      return true;
    });
  }, [candidates, dateFrom, dateTo]);

  // Compute distinct values for select filters from month-filtered data
  const selectOptions = useMemo(() => {
    const opts: Partial<Record<SortField, string[]>> = {};
    for (const col of COLUMNS) {
      if (col.filterType === "select") {
        opts[col.field] = getDistinctValues(dateFiltered, col.field);
      }
    }
    return opts;
  }, [dateFiltered]);

  const filtered = useMemo(
    () => applyFilters(dateFiltered, filters),
    [dateFiltered, filters],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareCandidates(a, b, sortField, sortDir)),
    [filtered, sortField, sortDir],
  );

  const totalArr = candidates.reduce((s, c) => s + c.mrr * 12, 0);
  const filteredArr = filtered.reduce((s, c) => s + c.mrr * 12, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Customer Success"
        stats={[
          { label: "showing", value: `${filtered.length} / ${candidates.length}` },
          { label: "filtered ARR", value: fmtCurrency(filteredArr) },
          { label: "total ARR", value: fmtCurrency(totalArr) },
        ]}
      >
        <Toolbar>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Expiring</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[140px] text-xs"
              placeholder="From"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[140px] text-xs"
              placeholder="To"
            />
          </div>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={clearAllFilters}
            >
              <X className="size-3" />
              Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
            </Button>
          )}
          <ToolbarIconButton onClick={() => downloadCsv(sorted)}>
            <Download className="size-4" />
          </ToolbarIconButton>
        </Toolbar>
      </PageHeader>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                {COLUMNS.map((col) => (
                  <th
                    key={col.field}
                    className={cn(
                      "px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap select-none",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <div className={cn(
                        "flex items-center gap-1.5",
                        col.align === "right" && "justify-end",
                      )}>
                        <span
                          className="cursor-pointer hover:text-foreground transition-colors inline-flex items-center gap-1"
                          onClick={() => toggleSort(col.field)}
                        >
                          {col.label}
                          <ArrowUpDown className={cn(
                            "size-3",
                            sortField === col.field ? "text-foreground" : "text-muted-foreground/40",
                          )} />
                        </span>
                        <ColumnFilter
                          col={col}
                          value={filters[col.field] ?? ""}
                          options={selectOptions[col.field] ?? []}
                          onChange={(v) => setFilter(col.field, v)}
                          onClear={() => clearFilter(col.field)}
                        />
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((c) => {
                const days = daysUntil(c.dueDate);
                return (
                  <tr
                    key={c.candidateId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap max-w-[200px] truncate">
                      {c.customerName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {c.csmName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-foreground whitespace-nowrap">
                      {fmtCurrency(c.mrr * 12)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-foreground whitespace-nowrap">
                      {fmtCurrency(c.mrr)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.contract?.contractNumber ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                          {c.contract.contractNumber}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {c.contract?.status ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-medium">
                      {fmtDate(c.contract?.startDate ?? null)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-red-500 dark:text-red-400 font-medium">
                      {fmtDate(c.contract?.endDate ?? null)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right font-medium whitespace-nowrap",
                      days < 0 ? "text-red-500" : days === 0 ? "text-orange-500" : days <= 7 ? "text-amber-500" : "text-muted-foreground",
                    )}>
                      {daysLabel(c.dueDate)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {c.contract?.ownerName ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.collectionMethod === "send_invoice" ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                          Invoice
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400 ring-1 ring-inset ring-purple-500/20">
                          Auto-charge
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {renewalStatusLabel(c.renewalStatus)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.subscriptionStatus ? (
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                          c.subscriptionStatus === "active"
                            ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                            : c.subscriptionStatus === "past_due"
                              ? "bg-red-500/10 text-red-500 ring-red-500/20"
                              : "bg-muted text-muted-foreground ring-border",
                        )}>
                          {c.subscriptionStatus}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <BarChart3 className="size-8" />
            <p className="text-sm">
              {candidates.length > 0 ? "No results match your filters" : "No renewal data available"}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
