"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import {
  Search,
  Loader2,
  Building2,
  ExternalLink,
  CreditCard,
  FileText,
  Clock,
  DollarSign,
  Users,
  MapPin,
  Mail,
  Globe,
  Shield,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { cn } from "@omnibridge/ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import type { PortfolioSignals } from "@/lib/queries/customer-signals";

/* ─── Helpers ─── */

function fmtCurrency(val: number | null | undefined, currency = "usd"): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
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

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
    case "processing":
      return "secondary";
    case "canceled":
    case "failed":
    case "uncollectible":
    case "void":
      return "destructive";
    default:
      return "outline";
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
  signals: PortfolioSignals;
}

export function CustomerExplorer({ signals }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CustomerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<CustomerSearchResult | null>(null);
  const [panelData, setPanelData] = useState<CustomerPanelData | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isLoading, startLoadTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const data = await getCustomerPanelData(
        customer.sfAccountId,
        customer.stripeCustomerId,
      );
      setPanelData(data);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers by name, domain, Stripe ID, or Salesforce ID..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onBlur={() => {
              // Delay to allow click on dropdown
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
                    {s.email && <span>{s.email}</span>}
                    {s.domain && <span>{s.domain}</span>}
                    {s.stripeCustomerId && <span className="font-mono">{s.stripeCustomerId}</span>}
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

      {/* Portfolio Signal Cards (always visible) */}
      <div className="grid grid-cols-3 gap-4 xl:grid-cols-6">
          <SignalCard
            icon={Building2}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-600"
            label="SF Accounts"
            value={String(signals.activeSfAccounts)}
            subtitle="Active customers"
          />
          <SignalCard
            icon={CreditCard}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-600"
            label="Stripe Customers"
            value={String(signals.activeStripeCustomers)}
            subtitle="With active subs"
          />
          <SignalCard
            icon={DollarSign}
            iconBg="bg-success/10"
            iconColor="text-success"
            label="Total MRR"
            value={fmtCurrency(signals.totalMrr)}
          />
          <SignalCard
            icon={TrendingUp}
            iconBg="bg-success/10"
            iconColor="text-success"
            label="Total ARR"
            value={fmtCurrency(signals.totalArr)}
          />
          <SignalCard
            icon={CheckCircle}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Subscriptions"
            value={String(signals.activeSubscriptions)}
            subtitle="Active Stripe subs"
          />
          <SignalCard
            icon={FileText}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-600"
            label="Contracts"
            value={String(signals.activeContracts)}
            subtitle="Active SFDC contracts"
          />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Customer Detail */}
      {selected && panelData && !isLoading && (
        <div className="grid grid-cols-2 gap-6">
          <SalesforcePanel account={panelData.sfAccount} sfUrl={panelData.sfUrl} />
          <StripePanel
            detail={panelData.stripeDetail}
            stripeUrl={panelData.stripeUrl}
            stripeCustomerId={selected.stripeCustomerId}
          />
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
              <DetailRow icon={Mail} label="Bill To Email" value={account.billToEmail} />
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

          {(account.accountNotes || account.latestHealthUpdate) && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Notes</h4>
              <div className="grid grid-cols-2 gap-3">
                {account.accountNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Account Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{account.accountNotes}</p>
                  </div>
                )}
                {account.latestHealthUpdate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">CSM Health Update</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{account.latestHealthUpdate}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Stripe Panel ─── */

function StripePanel({
  detail,
  stripeUrl,
  stripeCustomerId,
}: {
  detail: StripeCustomerDetail | null;
  stripeUrl: string | null;
  stripeCustomerId: string | null;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border card-shadow">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/stripe-logo.svg" alt="Stripe" className="h-6 w-auto" />
            <div>
              <h3 className="text-base font-semibold text-foreground">Stripe Customer</h3>
              <p className="text-sm text-muted-foreground">Billing, subscriptions & payments</p>
            </div>
          </div>
          {stripeUrl && (
            <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
              <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open in Stripe
              </a>
            </Button>
          )}
        </div>
      </div>

      {!detail ? (
        <div className="p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No Stripe data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            {stripeCustomerId ? "Could not fetch data from Stripe." : "This customer has no linked Stripe Customer ID."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Subscriptions ({detail.subscriptions.length})
            </h4>
            {detail.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions</p>
            ) : (
              <div className="space-y-3">
                {detail.subscriptions.map((sub) => (
                  <div key={sub.id} className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        {sub.id}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}
                      {sub.cancelAtPeriodEnd && " (cancels at period end)"}
                    </p>
                    {sub.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-foreground">
                          {item.productName ?? item.priceId}
                          {item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {fmtCents(item.amount, item.currency)}
                          {item.interval ? `/${item.interval}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Recent Payments ({detail.payments.length})
            </h4>
            {detail.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments</p>
            ) : (
              <div className="space-y-1">
                {detail.payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", p.status === "succeeded" ? "bg-success/10" : "bg-destructive/10")}>
                      <DollarSign className={cn("w-4 h-4", p.status === "succeeded" ? "text-success" : "text-destructive")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{p.description ?? "Payment"}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.created)}{p.paymentMethod && ` · ${p.paymentMethod}`}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-medium text-foreground">{fmtCents(p.amount, p.currency)}</p>
                      <Badge variant={statusVariant(p.status)} className="text-[10px]">{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Invoices ({detail.invoices.length})
            </h4>
            {detail.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices</p>
            ) : (
              <div className="space-y-1">
                {detail.invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{inv.number ?? inv.id}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(inv.created)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-medium text-foreground">{fmtCents(inv.amountDue, inv.currency)}</p>
                      <Badge variant={statusVariant(inv.status ?? "unknown")} className="text-[10px]">{inv.status ?? "—"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h4>
            {detail.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {detail.recentActivity.slice(0, 6).map((evt) => (
                  <div key={evt.id} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{evt.summary}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(evt.created)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
