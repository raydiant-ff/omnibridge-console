"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { Search, Loader2, Check, Briefcase, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  searchCustomersUnified,
  resolveCustomerForOpportunity,
  type UnifiedCustomer,
} from "@/lib/queries/customers";
import {
  getMyOpportunities,
  type OpportunityRow,
} from "@/lib/queries/opportunities";
import { formatCurrency } from "@/lib/format";
import type { QuoteCustomer } from "../wizard";

interface Props {
  selected: QuoteCustomer | null;
  opportunityId: string;
  onSelect: (customer: QuoteCustomer | null) => void;
  onOpportunityChange: (v: string) => void;
  onNext: () => void;
}

export function PickCustomer({
  selected,
  opportunityId,
  onSelect,
  onOpportunityChange,
  onNext,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedCustomer[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [oppsError, setOppsError] = useState(false);
  const [oppSearch, setOppSearch] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyOpportunities();
        if (!cancelled) {
          setOpportunities(data);
          if (data.length === 0) setOppsError(true);
        }
      } catch {
        if (!cancelled) setOppsError(true);
      } finally {
        if (!cancelled) setOppsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedOpps = useMemo(
    () =>
      [...opportunities].sort(
        (a, b) =>
          new Date(b.createdDate).getTime() -
          new Date(a.createdDate).getTime(),
      ),
    [opportunities],
  );

  const visibleOpps = useMemo(() => {
    let list = sortedOpps;
    if (selected?.sfAccountId) {
      list = list.filter((opp) => opp.accountId === selected.sfAccountId);
    }
    if (oppSearch.trim()) {
      const q = oppSearch.toLowerCase();
      list = list.filter(
        (opp) =>
          opp.name.toLowerCase().includes(q) ||
          (opp.accountName?.toLowerCase().includes(q) ?? false) ||
          opp.stageName.toLowerCase().includes(q) ||
          opp.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [sortedOpps, oppSearch, selected?.sfAccountId]);

  async function handleOpportunityChange(oppId: string) {
    onOpportunityChange(oppId);
    setAutoFillError(null);

    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp?.accountId) return;

    if (selected?.sfAccountId === opp.accountId) return;

    setAutoFilling(true);
    try {
      const resolved = await resolveCustomerForOpportunity(
        opp.accountId,
        opp.accountName,
      );
      if (resolved) {
        onSelect({
          id: resolved.id,
          sfAccountId: resolved.sfAccountId,
          sfAccountName: resolved.sfAccountName,
          stripeCustomerId: resolved.stripeCustomerId,
          domain: resolved.domain,
        });
        if (!resolved.stripeCustomerId) {
          setAutoFillError(
            "Customer found but has no Stripe ID. Search manually to find a Stripe-linked customer.",
          );
        }
      } else {
        setAutoFillError(
          "Could not find a customer for this opportunity. Use the search below.",
        );
      }
    } catch {
      setAutoFillError(
        "Failed to resolve customer. Use the search below.",
      );
    } finally {
      setAutoFilling(false);
    }
  }

  function handleCustomerSelect(c: UnifiedCustomer) {
    onSelect({
      id: c.id,
      sfAccountId: c.sfAccountId,
      sfAccountName: c.name,
      stripeCustomerId: c.stripeCustomerId,
      domain: c.domain,
    });
    setAutoFillError(null);

    if (opportunityId) {
      const opp = opportunities.find((o) => o.id === opportunityId);
      if (opp && c.sfAccountId && opp.accountId !== c.sfAccountId) {
        onOpportunityChange("");
      }
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchCustomersUnified(value.trim());
        setResults(data);
        setSearched(true);
      });
    }, 300);
  }

  function formatOppDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const canProceed = !!opportunityId && !!selected?.stripeCustomerId;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        {/* ── Opportunity (required, first) ─────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              Select Opportunity &amp; Customer
            </h2>
            <p className="text-sm text-muted-foreground">
              Every quote must be tied to a Salesforce opportunity. Selecting one
              will auto-fill the customer.
            </p>
          </div>

          <Label className="flex items-center gap-1.5">
            <Briefcase className="size-3.5" />
            Salesforce Opportunity
          </Label>

          {oppsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading opportunities...
            </div>
          ) : oppsError && opportunities.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="size-3.5" />
              Could not load opportunities from Salesforce. You can still search for a customer below.
            </div>
          ) : opportunityId ? (
            <SelectedOppCard
              opp={opportunities.find((o) => o.id === opportunityId) ?? null}
              onClear={() => {
                onOpportunityChange("");
                onSelect(null);
                setAutoFillError(null);
                setOppSearch("");
              }}
              formatDate={formatOppDate}
            />
          ) : sortedOpps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open opportunities found.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by opportunity name, customer, stage..."
                  value={oppSearch}
                  onChange={(e) => setOppSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {visibleOpps.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No opportunities match &ldquo;{oppSearch}&rdquo;.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {visibleOpps.map((opp) => (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => {
                        handleOpportunityChange(opp.id);
                        setOppSearch("");
                      }}
                      className="flex w-full flex-col gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {opp.name}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {opp.stageName}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {[
                          opp.accountName,
                          opp.amount !== null
                            ? formatCurrency(opp.amount * 100)
                            : null,
                          formatOppDate(opp.createdDate),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {autoFilling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Resolving customer...
            </div>
          )}
        </div>

        {/* ── Customer (search, auto-filled from opp or manual) ──── */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <Label>Customer</Label>

          {autoFillError && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {autoFillError}
            </div>
          )}

          {selected ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {selected.sfAccountName ?? "---"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    selected.stripeCustomerId,
                    selected.domain,
                    selected.sfAccountId
                      ? `SFDC: ${selected.sfAccountId}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!selected.stripeCustomerId && (
                  <Badge
                    variant="outline"
                    className="text-xs text-destructive"
                  >
                    No Stripe ID
                  </Badge>
                )}
                {selected.stripeCustomerId && (
                  <Check className="size-4 text-primary" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onSelect(null);
                    setAutoFillError(null);
                  }}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                {isPending && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                <Input
                  type="search"
                  placeholder="Search by account name, domain, or Stripe ID..."
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {searched && results.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No customers found for &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {results.map((c) => {
                    const hasStripe = !!c.stripeCustomerId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCustomerSelect(c)}
                        className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                          hasStripe
                            ? "cursor-pointer hover:bg-muted/50"
                            : "cursor-pointer hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {c.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {[
                              c.stripeCustomerId,
                              c.domain,
                              c.source !== "local"
                                ? c.source
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!hasStripe && (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-600"
                            >
                              No Stripe ID
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!selected?.stripeCustomerId && selected && (
            <p className="text-xs text-destructive">
              This customer has no Stripe ID. You can still proceed but the
              quote cannot be sent to Stripe without one.
            </p>
          )}
        </div>

        {/* ── Continue ───────────────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <Button onClick={onNext} disabled={!canProceed}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectedOppCard({
  opp,
  onClear,
  formatDate,
}: {
  opp: OpportunityRow | null;
  onClear: () => void;
  formatDate: (iso: string) => string;
}) {
  if (!opp) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{opp.name}</span>
        <span className="text-xs text-muted-foreground">
          {[
            opp.accountName,
            opp.stageName,
            opp.amount !== null
              ? formatCurrency(opp.amount * 100)
              : null,
            formatDate(opp.createdDate),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={onClear}
      >
        <X className="mr-1 size-3" />
        Change
      </Button>
    </div>
  );
}
