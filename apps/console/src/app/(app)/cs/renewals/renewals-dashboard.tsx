"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Building2,
} from "lucide-react";
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
import { FilterBar, FilterField } from "@/components/omni";
import type {
  RenewalsDashboardData,
  RenewalCandidate,
  RenewalDetailData,
} from "@/lib/omni/adapters/renewals";
import { fetchRenewalsForMonth, fetchRenewalDetail } from "./actions";
import {
  searchCustomersTypeahead,
  getCustomerPanelData,
} from "@/lib/actions/customer-lookup";
import type {
  CustomerSearchResult,
  CustomerPanelData,
} from "@/lib/actions/customer-lookup";

import { cn } from "@/lib/utils";
import { RenewalsKpiStrip } from "./renewals-kpi-strip";
import { RenewalsQueue, bucketCandidates } from "./renewals-queue";
import { RenewalDetailPane, CustomerLookupPane, DetailEmptyState } from "./renewals-detail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Dashboard shell
// ---------------------------------------------------------------------------

export function RenewalsDashboard({
  initialMonth,
  initialData,
  initialAccountFilter,
}: {
  initialMonth: string;
  initialData: RenewalsDashboardData;
  initialAccountFilter?: string | null;
}) {
  // ── Data state ──
  const [month, setMonth] = useState(initialMonth);
  const [csm, setCsm] = useState<string>("__all__");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // ── Detail pane state ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RenewalDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Account filter (from deep link) ──
  const [accountFilter, setAccountFilter] = useState<string | null>(initialAccountFilter ?? null);

  // ── Customer search state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const [searchedCustomer, setSearchedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerPanel, setCustomerPanel] = useState<CustomerPanelData | null>(null);
  const [isLoadingCustomer, startCustomerTransition] = useTransition();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Handlers ──

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
      const panelData = await getCustomerPanelData(
        customer.sfAccountId,
        customer.stripeCustomerId,
      );
      setCustomerPanel(panelData);
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

  // ── Derived ──

  const { summary } = data;
  const visibleCandidates = accountFilter
    ? data.candidates.filter((c) => c.customerId === accountFilter)
    : data.candidates;
  const visibleOverdue = accountFilter
    ? data.overdue.filter((c) => c.customerId === accountFilter)
    : data.overdue;
  const buckets = bucketCandidates(visibleCandidates, visibleOverdue);
  const overdueMrr = buckets.overdue.reduce((s, c) => s + c.mrr, 0);

  const emptyLabel =
    `No contracts due in ${monthLabel(month)}` +
    (csm !== "__all__"
      ? ` for ${csm === "__unassigned__" ? "unassigned" : csm}`
      : "") +
    ".";

  // ── Render ──

  return (
    <div className="flex flex-col gap-5">
      {/* Header + controls */}
      <PageHeader
        title="Renewals"
        description="Contract renewal pipeline"
        actions={
          <FilterBar>
            <FilterField label="Month">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-8" onClick={() => navigateMonth(-1)} disabled={isPending}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[120px] text-center text-sm font-semibold text-foreground select-none">
                  {isPending ? <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" /> : monthLabel(month)}
                </span>
                <Button variant="outline" size="icon" className="size-8" onClick={() => navigateMonth(1)} disabled={isPending}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </FilterField>
            <FilterField label="CSM">
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
            </FilterField>
          </FilterBar>
        }
      />

      {/* KPI strip */}
      <RenewalsKpiStrip
        summary={summary}
        overdueCount={buckets.overdue.length}
        overdueMrr={overdueMrr}
        dueTodayCount={buckets.dueToday.length}
        dueSoonCount={buckets.dueSoon.length}
        onTrackCount={buckets.onTrack.length}
        isPending={isPending}
      />

      {/* Account filter banner */}
      {accountFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm text-foreground">
            Filtered to account: <span className="font-medium">{
              visibleCandidates[0]?.customerName ?? accountFilter
            }</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setAccountFilter(null)}
          >
            Clear filter
          </Button>
        </div>
      )}

      {/* Split workspace: table + detail */}
      <div className={cn(
        "grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]",
        isPending && "opacity-50 pointer-events-none transition-opacity",
      )}>
        {/* Left — table */}
        <RenewalsQueue
          buckets={buckets}
          selectedId={selectedId}
          onSelect={selectCandidate}
          emptyLabel={emptyLabel}
        />

        {/* Right — detail pane */}
        <div className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-4">
            {/* Customer search */}
            <CustomerSearchInput
              searchQuery={searchQuery}
              searchResults={searchResults}
              showDropdown={showSearchDropdown}
              isSearching={isSearching}
              onSearch={handleCustomerSearch}
              onSelect={handleCustomerSelect}
              onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
              onBlur={() => { setTimeout(() => setShowSearchDropdown(false), 200); }}
            />

            {/* Renewal detail */}
            {selectedId && (
              <RenewalDetailPane
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
                <CustomerLookupPane
                  customer={searchedCustomer}
                  panel={customerPanel}
                  onClose={clearCustomerSearch}
                />
              ) : null
            )}

            {/* Empty state */}
            {!selectedId && !searchedCustomer && <DetailEmptyState />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer search input (kept here — small, tightly coupled to dashboard state)
// ---------------------------------------------------------------------------

function CustomerSearchInput({
  searchQuery,
  searchResults,
  showDropdown,
  isSearching,
  onSearch,
  onSelect,
  onFocus,
  onBlur,
}: {
  searchQuery: string;
  searchResults: CustomerSearchResult[];
  showDropdown: boolean;
  isSearching: boolean;
  onSearch: (value: string) => void;
  onSelect: (customer: CustomerSearchResult) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Look up any customer..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="pl-9 h-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card rounded-xl border shadow-lg overflow-hidden">
          {searchResults.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={() => onSelect(s)}
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

      {showDropdown && searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card rounded-xl border shadow-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">No customers found</p>
        </div>
      )}
    </div>
  );
}
