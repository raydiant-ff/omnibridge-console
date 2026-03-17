"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Download,
  MoreHorizontal,
  ExternalLink,
  RotateCw,
  X,
  Search,
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/workspace";
import type {
  RenewalsDashboardData,
  RenewalCandidate,
  RenewalDetailData,
} from "@/lib/queries/cs-renewals";
import { fetchRenewalsForMonth, fetchRenewalDetail } from "./actions";
import {
  searchCustomersTypeahead,
  getCustomerPanelData,
} from "@/lib/actions/customer-lookup";
import type {
  CustomerSearchResult,
  CustomerPanelData,
} from "@/lib/actions/customer-lookup";
import type { AccountDetail } from "@/lib/queries/customers";
import type { StripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}

function fmtDollars(amount: number | null): string {
  if (amount == null) return "—";
  return `$${amount.toLocaleString()}`;
}

function fmtDateFull(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
// Bucket helpers
// ---------------------------------------------------------------------------

interface Bucket {
  overdue: RenewalCandidate[];
  dueToday: RenewalCandidate[];
  dueSoon: RenewalCandidate[];
  onTrack: RenewalCandidate[];
}

function bucketCandidates(
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

  return {
    overdue: overdueAll.sort((a, b) => b.mrr - a.mrr),
    dueToday: dueToday.sort((a, b) => b.mrr - a.mrr),
    dueSoon: dueSoon.sort((a, b) => b.mrr - a.mrr),
    onTrack: onTrack.sort((a, b) => b.mrr - a.mrr),
  };
}

// ---------------------------------------------------------------------------
// Renewal row
// ---------------------------------------------------------------------------

function RenewalRow({
  c,
  accentColor,
  isSelected,
  onSelect,
}: {
  c: RenewalCandidate;
  accentColor: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group",
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate text-foreground">{c.customerName}</span>
          <span className="text-sm font-medium tabular-nums text-foreground">{fmtCompact(c.mrr * 12)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {c.csmName && (
            <Badge variant="secondary" className="text-[10px]">{c.csmName}</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {c.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge"}
          </Badge>
          {c.contract?.contractNumber && (
            <Badge variant="outline" className="text-[10px] font-mono">{c.contract.contractNumber}</Badge>
          )}
          {c.subscriptionStatus === "past_due" && (
            <Badge variant="destructive" className="text-[10px]">Past due</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "text-xs font-medium whitespace-nowrap tabular-nums",
            daysUntil(c.dueDate) < 0 ? "text-destructive" : daysUntil(c.dueDate) <= 7 ? "text-amber-500" : "text-muted-foreground",
          )}
        >
          {daysLabel(c.dueDate)}
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section bucket
// ---------------------------------------------------------------------------

function BucketSection({
  title,
  count,
  mrrTotal,
  accentColor,
  candidates,
  selectedId,
  onSelect,
}: {
  title: string;
  count: number;
  mrrTotal: number;
  accentColor: string;
  candidates: RenewalCandidate[];
  selectedId: string | null;
  onSelect: (c: RenewalCandidate) => void;
}) {
  if (count === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-y">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", accentColor)} />
          <span className="text-xs font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {fmtCompact(mrrTotal)} MRR
        </span>
      </div>
      <div className="divide-y">
        {candidates.map((c) => (
          <RenewalRow
            key={c.candidateId}
            c={c}
            accentColor={accentColor}
            isSelected={selectedId === c.candidateId}
            onSelect={() => onSelect(c)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RenewalsDashboard({
  initialMonth,
  initialData,
}: {
  initialMonth: string;
  initialData: RenewalsDashboardData;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [csm, setCsm] = useState<string>("__all__");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RenewalDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const [searchedCustomer, setSearchedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerPanel, setCustomerPanel] = useState<CustomerPanelData | null>(null);
  const [isLoadingCustomer, startCustomerTransition] = useTransition();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleCustomerSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      startSearchTransition(async () => {
        const results = await searchCustomersTypeahead(value.trim());
        setSearchResults(results);
        setShowSearchDropdown(true);
      });
    }, 250);
  }, []);

  function handleCustomerSelect(customer: CustomerSearchResult) {
    setSearchedCustomer(customer);
    setSearchQuery(customer.name);
    setShowSearchDropdown(false);
    setSelectedId(null);
    setDetail(null);
    startCustomerTransition(async () => {
      const data = await getCustomerPanelData(
        customer.sfAccountId,
        customer.stripeCustomerId,
      );
      setCustomerPanel(data);
    });
  }

  function clearCustomerSearch() {
    setSearchedCustomer(null);
    setCustomerPanel(null);
    setSearchQuery("");
    setSearchResults([]);
  }

  function refresh(nextMonth: string, nextCsm: string) {
    setMonth(nextMonth);
    setCsm(nextCsm);
    setSelectedId(null);
    setDetail(null);
    startTransition(async () => {
      const csmParam = nextCsm === "__all__" ? null : nextCsm;
      const result = await fetchRenewalsForMonth(nextMonth, csmParam);
      setData(result);
    });
  }

  function navigateMonth(delta: number) {
    refresh(shiftMonth(month, delta), csm);
  }

  function changeCsm(value: string) {
    refresh(month, value);
  }

  async function selectCandidate(c: RenewalCandidate) {
    if (selectedId === c.candidateId) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSearchedCustomer(null);
    setCustomerPanel(null);
    setSelectedId(c.candidateId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const result = await fetchRenewalDetail(c.candidateId);
      setDetail(result);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const { summary } = data;
  const buckets = bucketCandidates(data.candidates, data.overdue);
  const totalAtRisk =
    buckets.overdue.reduce((s, c) => s + c.mrr, 0) +
    buckets.dueSoon.reduce((s, c) => s + c.mrr, 0);
  const dueTodayMrr = buckets.dueToday.reduce((s, c) => s + c.mrr, 0);
  const dueNext7Mrr = buckets.dueSoon.reduce((s, c) => s + c.mrr, 0);

  const isEmpty =
    buckets.overdue.length === 0 &&
    buckets.dueToday.length === 0 &&
    buckets.dueSoon.length === 0 &&
    buckets.onTrack.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header: sets AppHeader title via PageTitleContext ── */}
      <PageHeader title="Renewals" description="Contract renewal pipeline" />

      {/* ── Control bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigateMonth(-1)} disabled={isPending}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-foreground select-none">
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" /> : monthLabel(month)}
          </span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigateMonth(1)} disabled={isPending}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={csm} onValueChange={changeCsm} disabled={isPending}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All CSMs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All CSMs</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {data.csmList.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="size-8">
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className={cn(
        "flex items-center rounded-xl border bg-card divide-x",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}>
        {[
          { label: "MRR", value: fmtCompact(summary.totalMrr) },
          { label: "ARR", value: fmtCompact(summary.totalMrr * 12) },
          { label: "Contracts", value: String(summary.total) },
          { label: "At risk", value: totalAtRisk > 0 ? fmtCompact(totalAtRisk) : "—", danger: totalAtRisk > 0 },
          { label: "Due today", value: String(buckets.dueToday.length), warn: buckets.dueToday.length > 0 },
          { label: "Next 7d", value: String(buckets.dueSoon.length), warn: buckets.dueSoon.length > 0 },
          { label: "On track", value: String(buckets.onTrack.length) },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-4 py-3 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            <p className={cn(
              "text-lg font-semibold tabular-nums leading-tight mt-0.5",
              stat.danger ? "text-destructive" : stat.warn ? "text-amber-500" : "text-foreground",
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Split workspace ── */}
      <div className={cn(
        "grid gap-5 grid-cols-1 lg:grid-cols-[1fr_420px]",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}>
        {/* Left — renewal queue */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {isEmpty ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No contracts due in {monthLabel(month)}
              {csm !== "__all__" ? ` for ${csm === "__unassigned__" ? "unassigned" : csm}` : ""}.
            </div>
          ) : (
            <>
              <BucketSection
                title="Overdue"
                count={buckets.overdue.length}
                mrrTotal={buckets.overdue.reduce((s, c) => s + c.mrr, 0)}
                accentColor="bg-destructive"
                candidates={buckets.overdue}
                selectedId={selectedId}
                onSelect={selectCandidate}
              />
              <BucketSection
                title="Due today"
                count={buckets.dueToday.length}
                mrrTotal={dueTodayMrr}
                accentColor="bg-orange-500"
                candidates={buckets.dueToday}
                selectedId={selectedId}
                onSelect={selectCandidate}
              />
              <BucketSection
                title="Due soon"
                count={buckets.dueSoon.length}
                mrrTotal={buckets.dueSoon.reduce((s, c) => s + c.mrr, 0)}
                accentColor="bg-amber-500"
                candidates={buckets.dueSoon}
                selectedId={selectedId}
                onSelect={selectCandidate}
              />
              <BucketSection
                title="On track"
                count={buckets.onTrack.length}
                mrrTotal={buckets.onTrack.reduce((s, c) => s + c.mrr, 0)}
                accentColor="bg-emerald-500"
                candidates={buckets.onTrack}
                selectedId={selectedId}
                onSelect={selectCandidate}
              />
            </>
          )}
        </div>

        {/* Right — detail workspace */}
        <div className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-4">
            {/* Customer search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Look up any customer..."
                  value={searchQuery}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                  onBlur={() => { setTimeout(() => setShowSearchDropdown(false), 200); }}
                  className="pl-9 h-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-card rounded-xl border shadow-lg overflow-hidden">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => handleCustomerSelect(s)}
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[s.email, s.domain].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(s.sfAccountId || s.source === "salesforce") && (
                          <Badge variant="secondary" className="text-[10px]">SF</Badge>
                        )}
                        {(s.stripeCustomerId || s.source === "stripe") && (
                          <Badge variant="secondary" className="text-[10px]">Stripe</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showSearchDropdown && searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
                <div className="absolute z-50 top-full mt-1 w-full bg-card rounded-xl border shadow-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">No customers found</p>
                </div>
              )}
            </div>

            {/* Renewal detail */}
            {selectedId && (
              <DetailPanel
                detail={detail}
                loading={detailLoading}
                onClose={() => { setSelectedId(null); setDetail(null); }}
              />
            )}

            {/* Customer lookup */}
            {searchedCustomer && !selectedId && (
              isLoadingCustomer ? (
                <div className="rounded-xl border bg-card p-8 flex items-center justify-center min-h-[300px]">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : customerPanel ? (
                <CustomerLookupPanel
                  customer={searchedCustomer}
                  panel={customerPanel}
                  onClose={clearCustomerSearch}
                />
              ) : null
            )}

            {/* Empty state */}
            {!selectedId && !searchedCustomer && (
              <div className="flex flex-col items-center justify-center gap-2 h-64 rounded-xl border bg-card text-center">
                <Search className="size-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Select a renewal or search a customer</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: RenewalDetailData | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-xl border bg-card p-8 flex items-center justify-center min-h-[400px] text-sm text-muted-foreground">
        Failed to load details.
      </div>
    );
  }

  const { candidate: c, contractLines, account } = detail;
  const renewUrl = `/cs/renewals/create?sub=${encodeURIComponent(c.id)}&customer=${encodeURIComponent(c.customerId)}`;

  const risks: string[] = [];
  if (c.renewalStatus === "cancelling") risks.push("Cancelling");
  if (c.contract?.doNotRenew) risks.push("Do Not Renew");
  if (c.status === "past_due") risks.push("Past Due");
  if (c.hasSchedule) risks.push("Schedule Active");

  const fields: [string, string][] = [];
  fields.push(["Due date", fmtDateFull(c.dueDate)]);
  fields.push(["Due basis", c.dueBasis === "contract" ? "Contract End" : "Subscription End"]);
  if (c.contract?.startDate && c.contract?.endDate) {
    fields.push(["Contract term", `${fmtDateFull(c.contract.startDate)} → ${fmtDateFull(c.contract.endDate)}`]);
  }
  if (c.contract?.contractTerm) {
    fields.push(["Term length", `${c.contract.contractTerm} months`]);
  }
  fields.push(["Collection", c.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge"]);
  if (c.csmName || account?.csmName) {
    fields.push(["CSM", c.csmName ?? account?.csmName ?? "—"]);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{c.customerName}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <RenewalStatusBadge status={c.renewalStatus} />
              {c.contract && (
                <Badge variant="outline" className="text-xs">{c.contract.status}</Badge>
              )}
              <span className="text-sm font-medium tabular-nums text-foreground">
                {fmtCurrency(c.mrr)}/mo
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Risk alerts */}
      {risks.length > 0 && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 px-3 py-2 text-xs">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {risks.join(" · ")}
          </span>
        </div>
      )}

      {/* Context fields */}
      <div className="border-t px-5">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* Linked records */}
      <div className="border-t px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground mb-2.5">Linked records</p>
        <div className="flex flex-col gap-2">
          {c.contract && (
            <a
              href={`https://displai.lightning.force.com/lightning/r/Contract/${c.contract.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              SF Contract {c.contract.contractNumber ?? c.contract.id.slice(0, 15)}
            </a>
          )}
          <a
            href={`https://dashboard.stripe.com/subscriptions/${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Stripe Subscription
          </a>
          <Link
            href={`/customers/${c.customerId}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Customer Profile
          </Link>
        </div>
      </div>

      {/* Contract lines */}
      {contractLines.length > 0 && (
        <div className="border-t px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground mb-2.5">
            Contract lines ({contractLines.length})
          </p>
          {contractLines.map((line) => (
            <div key={line.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground truncate max-w-[240px]">
                {line.productName || "—"}
              </span>
              <span className={`text-sm font-medium tabular-nums shrink-0 ml-4 ${line.netPrice != null ? "text-foreground" : "text-muted-foreground"}`}>
                {line.netPrice != null ? fmtDollars(line.netPrice) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pt-2 pb-5 flex flex-col gap-2">
        <Button className="w-full" asChild>
          <Link href={renewUrl}>
            <RotateCw className="mr-2 size-3.5" />
            Prepare Renewal Quote
          </Link>
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/cs/renewals/${encodeURIComponent(c.candidateId)}`}>
            View Full Details
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renewal status badge
// ---------------------------------------------------------------------------

function RenewalStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: string }> = {
    cancelling: { label: "Cancelling", variant: "destructive" },
    scheduled_end: { label: "Schedule Ending", variant: "secondary" },
    period_ending: { label: "Period Ending", variant: "outline" },
  };
  const cfg = config[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant as "destructive" | "secondary" | "outline"} className="text-xs">
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Customer lookup panel
// ---------------------------------------------------------------------------

function fmtCurrencyDollars(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtCents(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
    case "succeeded":
    case "paid":
      return "default";
    case "trialing":
    case "open":
      return "secondary";
    case "canceled":
    case "failed":
    case "void":
      return "destructive";
    default:
      return "outline";
  }
}

function CustomerLookupPanel({
  customer,
  panel,
  onClose,
}: {
  customer: CustomerSearchResult;
  panel: CustomerPanelData;
  onClose: () => void;
}) {
  const sf = panel.sfAccount;
  const stripe = panel.stripeDetail;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{customer.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[customer.email, customer.domain].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Salesforce */}
      {sf && (
        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="size-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Salesforce</span>
            {sf.status && (
              <Badge
                variant={sf.status === "Active" || sf.status === "Active Customer" ? "success" : "secondary"}
                className="text-[10px]"
              >
                {sf.status}
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <LookupRow label="MRR" value={fmtCurrencyDollars(sf.accountValue)} emphasis />
            <LookupRow label="ARR" value={fmtCurrencyDollars(sf.totalArr)} emphasis />
            <LookupRow label="Outstanding AR" value={fmtCurrencyDollars(sf.outstandingAr)} />
            <LookupRow label="Primary contact" value={sf.primaryContactName} />
            <LookupRow label="Primary email" value={sf.primaryContactEmail} />
          </div>
          {panel.sfUrl && (
            <a
              href={panel.sfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-3"
            >
              <ExternalLink className="size-3.5" />
              Open in Salesforce
            </a>
          )}
        </div>
      )}

      {/* Stripe */}
      {stripe && (
        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="size-4 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">Stripe</span>
          </div>

          {stripe.subscriptions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-foreground mb-2">
                Subscriptions ({stripe.subscriptions.length})
              </p>
              {stripe.subscriptions.map((sub) => (
                <div key={sub.id} className="p-2.5 rounded-lg border bg-muted/20 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {sub.id.slice(0, 24)}...
                    </span>
                    <Badge variant={statusVariant(sub.status)} className="text-[10px]">
                      {sub.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground">
                    {fmtDateFull(sub.currentPeriodStart)} → {fmtDateFull(sub.currentPeriodEnd)}
                  </p>
                  {sub.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs mt-1">
                      <span className="text-foreground truncate">{item.productName ?? item.priceId}</span>
                      <span className="font-mono font-medium text-foreground shrink-0 ml-2">
                        {fmtCents(item.amount, item.currency)}/{item.interval ?? "mo"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {stripe.payments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-foreground mb-2">
                Recent payments ({stripe.payments.length})
              </p>
              {stripe.payments.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <DollarSign className={cn("size-3", p.status === "succeeded" ? "text-emerald-500" : "text-destructive")} />
                    <span className="text-foreground">{fmtDateFull(p.created)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-foreground">{fmtCents(p.amount, p.currency)}</span>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel.stripeUrl && (
            <a
              href={panel.stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Open in Stripe
            </a>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="border-t px-5 py-4">
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/customers/${customer.stripeCustomerId ?? customer.sfAccountId ?? customer.id}`}>
            <Users className="mr-2 size-3.5" />
            View Full Customer Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}

function LookupRow({ label, value, emphasis }: { label: string; value: string | null | undefined; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-right", value ? "text-foreground" : "text-muted-foreground", emphasis && "font-medium tabular-nums")}>
        {value ?? "—"}
      </span>
    </div>
  );
}
