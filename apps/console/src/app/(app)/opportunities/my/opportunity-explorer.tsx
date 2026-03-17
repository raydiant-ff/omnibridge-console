"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import {
  Search,
  Loader2,
  Building2,
  ExternalLink,
  DollarSign,
  Target,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Globe,
  Users,
  Mail,
  MapPin,
  Shield,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@omnibridge/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  searchCustomersTypeahead,
} from "@/lib/actions/customer-lookup";
import { getOpportunityPanelData } from "@/lib/actions/opportunity-lookup";
import type { CustomerSearchResult } from "@/lib/actions/customer-lookup";
import type { OpportunityPanelData } from "@/lib/actions/opportunity-lookup";
import type { AccountDetail } from "@/lib/queries/customers";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import type { MyOpportunitySignals } from "@/lib/queries/opportunity-signals";

/* ─── Helpers ─── */

function fmtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return fmtCurrency(val);
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stageBadgeClasses(stage: string): string {
  switch (stage) {
    case "Closed Won":
      return "bg-success/10 text-success";
    case "Closed Lost":
      return "bg-destructive/10 text-destructive";
    case "Contract Sent":
      return "bg-purple-500/10 text-purple-600";
    case "Pricing & Negotiation":
      return "bg-amber-500/10 text-amber-600";
    case "Customer Evaluation":
      return "bg-blue-500/10 text-blue-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ─── Signal Card ─── */

function SignalCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

/* ─── Main Component ─── */

interface Props {
  signals: MyOpportunitySignals;
}

export function OpportunityExplorer({ signals }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<CustomerSearchResult | null>(null);
  const [panelData, setPanelData] = useState<OpportunityPanelData | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isLoading, startLoadTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      startSearchTransition(async () => {
        const results = await searchCustomersTypeahead(value.trim());
        setSuggestions(results);
        setShowDropdown(true);
      });
    }, 250);
  }, []);

  function handleSelect(customer: CustomerSearchResult) {
    setSelected(customer);
    setQuery(customer.name);
    setShowDropdown(false);
    startLoadTransition(async () => {
      const data = await getOpportunityPanelData(customer.sfAccountId);
      setPanelData(data);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers by name, domain, or Salesforce ID..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 200);
            }}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-2 w-full bg-card rounded-xl border border-border card-shadow overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={() => handleSelect(s)}
                className={cn(
                  "w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors",
                  selected?.id === s.id && "bg-muted/50",
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.domain && <span>{s.domain}</span>}
                    {s.sfAccountId && <span className="font-mono">{s.sfAccountId}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(s.sfAccountId || s.source === "salesforce") && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/10 text-blue-600">SF</span>
                  )}
                  {(s.stripeCustomerId || s.source === "stripe") && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-600">Stripe</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {showDropdown && suggestions.length === 0 && query.trim().length >= 2 && !isSearching && (
          <div className="absolute z-50 top-full mt-2 w-full bg-card rounded-xl border border-border card-shadow p-6 text-center">
            <p className="text-sm text-muted-foreground">No customers found for &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Signal Cards (always visible) */}
      <div className="grid grid-cols-3 gap-4 xl:grid-cols-6">
        <SignalCard
          icon={Target}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          label="Open Opps"
          value={String(signals.totalOpen)}
          subtitle="Assigned to you"
        />
        <SignalCard
          icon={DollarSign}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          label="Open Pipeline"
          value={fmtCompact(signals.openPipelineValue)}
        />
        <SignalCard
          icon={CheckCircle}
          iconBg="bg-success/10"
          iconColor="text-success"
          label="Closed Won"
          value={String(signals.closedWonYtd)}
          subtitle="YTD"
        />
        <SignalCard
          icon={TrendingUp}
          iconBg="bg-success/10"
          iconColor="text-success"
          label="Won Revenue"
          value={fmtCompact(signals.closedWonRevenue)}
          subtitle="YTD"
        />
        <SignalCard
          icon={AlertTriangle}
          iconBg={signals.overdueCount > 0 ? "bg-destructive/10" : "bg-success/10"}
          iconColor={signals.overdueCount > 0 ? "text-destructive" : "text-success"}
          label="Overdue"
          value={String(signals.overdueCount)}
          subtitle={signals.overdueCount > 0 ? "Past close date" : "All on track"}
        />
        <SignalCard
          icon={DollarSign}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-600"
          label="Avg Deal Size"
          value={fmtCompact(signals.avgDealSize)}
          subtitle="Closed won YTD"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Customer Detail: SF Account + Opportunities side by side */}
      {selected && panelData && !isLoading && (
        <div className="grid grid-cols-2 gap-6">
          <SalesforcePanel account={panelData.sfAccount} sfUrl={panelData.sfUrl} />
          <OpportunitiesPanel opportunities={panelData.opportunities} accountName={panelData.sfAccount?.name ?? selected.name} />
        </div>
      )}
    </div>
  );
}

/* ─── Salesforce Panel ─── */

function SalesforcePanel({
  account,
  sfUrl,
}: {
  account: AccountDetail | null;
  sfUrl: string | null;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-6 w-auto" />
            <div className="flex items-center gap-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">Salesforce Account</h3>
                <p className="text-sm text-muted-foreground">CRM details & contacts</p>
              </div>
              {account?.status && (
                <span className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-full",
                  account.status === "Active" || account.status === "Active Customer"
                    ? "bg-success/10 text-success"
                    : account.status === "Churned"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                )}>
                  {account.status}
                </span>
              )}
            </div>
          </div>
          {sfUrl && (
            <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
              <a href={sfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open in Salesforce
              </a>
            </Button>
          )}
        </div>
      </div>

      {!account ? (
        <div className="p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No Salesforce account linked</p>
          <p className="text-xs text-muted-foreground mt-1">This customer has no associated SF Account ID.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Account Details</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailRow icon={Building2} label="Name" value={account.name} />
              <DetailRow icon={Globe} label="Website" value={account.website} />
              <DetailRow icon={Clock} label="First Closed Won" value={fmtDate(account.dateOfFirstClosedWon)} />
              <DetailRow icon={DollarSign} label="MRR" value={fmtCurrency(account.accountValue)} />
              <DetailRow icon={DollarSign} label="ARR" value={fmtCurrency(account.totalArr)} />
              <DetailRow icon={DollarSign} label="Lifetime Value" value={fmtCurrency(account.lifetimeValue)} />
            </div>
          </div>

          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Accounts Receivable</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailRow icon={DollarSign} label="Outstanding AR" value={fmtCurrency(account.outstandingAr)} />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">AR Status</p>
                  {account.arStatus ? (
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      account.arStatus === "Current" || account.arStatus === "In Good Standing"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}>
                      {account.arStatus}
                    </span>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Contacts</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <DetailRow icon={Users} label="Primary Contact" value={account.primaryContactName} />
              <DetailRow icon={Mail} label="Primary Email" value={account.primaryContactEmail} />
              <DetailRow icon={Mail} label="Dashboard Email" value={account.dashboardEmail} />
              <DetailRow icon={Users} label="Bill To Contact" value={account.billToContactName} />
            </div>
          </div>

          {(account.billingAddress.city || account.shippingAddress.city) && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Addresses</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {account.billingAddress.city && (
                  <DetailRow icon={MapPin} label="Billing" value={[account.billingAddress.street, [account.billingAddress.city, account.billingAddress.state].filter(Boolean).join(", "), account.billingAddress.postalCode].filter(Boolean).join(" · ")} />
                )}
                {account.shippingAddress.city && (
                  <DetailRow icon={MapPin} label="Shipping" value={[account.shippingAddress.street, [account.shippingAddress.city, account.shippingAddress.state].filter(Boolean).join(", "), account.shippingAddress.postalCode].filter(Boolean).join(" · ")} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Opportunities Panel ─── */

function OpportunitiesPanel({
  opportunities,
  accountName,
}: {
  opportunities: OpportunityRow[];
  accountName: string;
}) {
  const openOpps = opportunities.filter(
    (o) => o.stageName !== "Closed Won" && o.stageName !== "Closed Lost",
  );
  const closedWon = opportunities.filter((o) => o.stageName === "Closed Won");
  const closedLost = opportunities.filter((o) => o.stageName === "Closed Lost");

  const openPipeline = openOpps.reduce((s, o) => s + (o.amount ?? 0), 0);
  const wonRevenue = closedWon.reduce((s, o) => s + (o.amount ?? 0), 0);

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Opportunities</h3>
              <p className="text-sm text-muted-foreground">{accountName}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 rounded-full">
            {opportunities.length} total
          </span>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No opportunities found</p>
          <p className="text-xs text-muted-foreground mt-1">This account has no opportunities in Salesforce.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Summary stats */}
          <div className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-blue-500/5 p-3 text-center">
                <p className="text-lg font-semibold text-foreground">{openOpps.length}</p>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-xs font-mono text-blue-600 mt-0.5">{fmtCompact(openPipeline)}</p>
              </div>
              <div className="rounded-xl bg-success/5 p-3 text-center">
                <p className="text-lg font-semibold text-foreground">{closedWon.length}</p>
                <p className="text-xs text-muted-foreground">Won</p>
                <p className="text-xs font-mono text-success mt-0.5">{fmtCompact(wonRevenue)}</p>
              </div>
              <div className="rounded-xl bg-destructive/5 p-3 text-center">
                <p className="text-lg font-semibold text-foreground">{closedLost.length}</p>
                <p className="text-xs text-muted-foreground">Lost</p>
              </div>
            </div>
          </div>

          {/* Open opportunities */}
          {openOpps.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Open Opportunities</h4>
              <div className="space-y-2">
                {openOpps
                  .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
                  .map((opp) => (
                    <OppRow key={opp.id} opp={opp} isPast={isPast} />
                  ))}
              </div>
            </div>
          )}

          {/* Closed Won */}
          {closedWon.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Closed Won</h4>
              <div className="space-y-2">
                {closedWon
                  .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
                  .slice(0, 10)
                  .map((opp) => (
                    <OppRow key={opp.id} opp={opp} isPast={isPast} />
                  ))}
              </div>
            </div>
          )}

          {/* Closed Lost */}
          {closedLost.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Closed Lost</h4>
              <div className="space-y-2">
                {closedLost
                  .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
                  .slice(0, 5)
                  .map((opp) => (
                    <OppRow key={opp.id} opp={opp} isPast={isPast} />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Opp Row ─── */

function OppRow({
  opp,
  isPast,
}: {
  opp: OpportunityRow;
  isPast: (d: string) => boolean;
}) {
  const isOpen = opp.stageName !== "Closed Won" && opp.stageName !== "Closed Lost";
  const overdue = isOpen && isPast(opp.closeDate);

  return (
    <div className={cn(
      "rounded-xl border p-3 text-sm transition-colors",
      overdue
        ? "border-destructive/40 bg-destructive/5"
        : "bg-muted/30 border-border hover:bg-muted/50",
    )}>
      <div className="flex items-start justify-between mb-1">
        <p className="font-medium text-foreground line-clamp-1 flex-1 mr-2">{opp.name}</p>
        <span className="font-mono text-xs text-foreground shrink-0">
          {opp.amount !== null ? fmtCompact(opp.amount) : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className={cn(
          "px-1.5 py-0.5 text-[10px] font-medium rounded-full",
          stageBadgeClasses(opp.stageName),
        )}>
          {opp.stageName}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span className={cn(overdue && "text-destructive font-medium")}>
            {fmtDate(opp.closeDate)}
            {overdue && " (overdue)"}
          </span>
        </div>
      </div>
      {opp.ownerName && (
        <p className="mt-1 text-[10px] text-muted-foreground">{opp.ownerName}</p>
      )}
    </div>
  );
}

/* ─── Shared ─── */

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground truncate">{value ?? "—"}</p>
      </div>
    </div>
  );
}
