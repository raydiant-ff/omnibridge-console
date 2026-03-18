import Link from "next/link";
import {
  X,
  ExternalLink,
  RotateCw,
  AlertTriangle,
  Search,
  Loader2,
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailCard, DetailRow, ActionBar } from "@/components/omni";
import { RenewalStatusBadge } from "./renewal-status-badge";
import type { RenewalDetailData } from "@/lib/queries/cs-renewals";
import type {
  CustomerSearchResult,
  CustomerPanelData,
} from "@/lib/actions/customer-lookup";

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

function fmtDateFull(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDollars(amount: number | null): string {
  if (amount == null) return "—";
  return `$${amount.toLocaleString()}`;
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

// ---------------------------------------------------------------------------
// Detail pane: renewal candidate
// ---------------------------------------------------------------------------

interface RenewalDetailPaneProps {
  detail: RenewalDetailData | null;
  loading: boolean;
  onClose: () => void;
}

export function RenewalDetailPane({ detail, loading, onClose }: RenewalDetailPaneProps) {
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <DetailCard
        title={c.customerName}
        action={
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        }
        description={
          [
            fmtCurrency(c.mrr) + "/mo",
            c.contract?.status,
          ]
            .filter(Boolean)
            .join(" · ")
        }
      >
        <div className="flex items-center gap-2 flex-wrap -mt-1 mb-2">
          <RenewalStatusBadge status={c.renewalStatus} />
          {c.contract && (
            <Badge variant="outline" className="text-xs">{c.contract.status}</Badge>
          )}
        </div>

        {/* Risk alert */}
        {risks.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 px-3 py-2 text-xs mb-2">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {risks.join(" · ")}
            </span>
          </div>
        )}

        {/* Context fields */}
        <DetailRow label="Due date" value={fmtDateFull(c.dueDate)} emphasis />
        <DetailRow
          label="Due basis"
          value={c.dueBasis === "contract" ? "Contract End" : "Subscription End"}
        />
        {c.contract?.startDate && c.contract?.endDate && (
          <DetailRow
            label="Contract term"
            value={`${fmtDateFull(c.contract.startDate)} → ${fmtDateFull(c.contract.endDate)}`}
          />
        )}
        {c.contract?.contractTerm && (
          <DetailRow label="Term length" value={`${c.contract.contractTerm} months`} />
        )}
        <DetailRow
          label="Collection"
          value={c.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge"}
        />
        {(c.csmName || account?.csmName) && (
          <DetailRow label="CSM" value={c.csmName ?? account?.csmName ?? "—"} />
        )}
      </DetailCard>

      {/* Contract lines */}
      {contractLines.length > 0 && (
        <DetailCard title="Contract Lines" count={contractLines.length}>
          {contractLines.map((line) => (
            <div key={line.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
              <span className="text-sm text-foreground truncate max-w-[240px]">
                {line.productName || "—"}
              </span>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums shrink-0 ml-4",
                  line.netPrice != null ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {line.netPrice != null ? fmtDollars(line.netPrice) : "—"}
              </span>
            </div>
          ))}
        </DetailCard>
      )}

      {/* Linked records */}
      <DetailCard title="Linked Records">
        {c.contract && (
          <DetailRow
            label="SF Contract"
            value={
              <a
                href={`https://displai.lightning.force.com/lightning/r/Contract/${c.contract.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                {c.contract.contractNumber ?? c.contract.id.slice(0, 15)}
                <ExternalLink className="size-3" />
              </a>
            }
          />
        )}
        <DetailRow
          label="Stripe Sub"
          value={
            <a
              href={`https://dashboard.stripe.com/subscriptions/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-mono text-xs"
            >
              {c.id.slice(0, 20)}…
              <ExternalLink className="size-3" />
            </a>
          }
        />
        <DetailRow
          label="Customer"
          value={
            <Link
              href={`/customers/${c.customerId}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              Profile
              <ExternalLink className="size-3" />
            </Link>
          }
        />
      </DetailCard>

      {/* Actions */}
      <ActionBar className="flex-col">
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
      </ActionBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail pane: customer lookup
// ---------------------------------------------------------------------------

interface CustomerLookupPaneProps {
  customer: CustomerSearchResult;
  panel: CustomerPanelData;
  onClose: () => void;
}

export function CustomerLookupPane({ customer, panel, onClose }: CustomerLookupPaneProps) {
  const sf = panel.sfAccount;
  const stripe = panel.stripeDetail;

  return (
    <div className="flex flex-col gap-4">
      {/* Account header */}
      <DetailCard
        title={customer.name}
        description={[customer.email, customer.domain].filter(Boolean).join(" · ")}
        action={
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        }
      >
        {/* Salesforce section */}
        {sf && (
          <>
            <div className="flex items-center gap-2 mb-2 mt-1">
              <Building2 className="size-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Salesforce</span>
              {sf.status && (
                <Badge
                  variant={sf.status === "Active" || sf.status === "Active Customer" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {sf.status}
                </Badge>
              )}
            </div>
            <DetailRow label="MRR" value={fmtDollarsFull(sf.accountValue)} emphasis />
            <DetailRow label="ARR" value={fmtDollarsFull(sf.totalArr)} emphasis />
            <DetailRow label="Outstanding AR" value={fmtDollarsFull(sf.outstandingAr)} />
            <DetailRow label="Primary contact" value={sf.primaryContactName ?? "—"} />
            <DetailRow label="Primary email" value={sf.primaryContactEmail ?? "—"} />
            {panel.sfUrl && (
              <div className="pt-2">
                <a
                  href={panel.sfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Open in Salesforce
                </a>
              </div>
            )}
          </>
        )}
      </DetailCard>

      {/* Stripe section */}
      {stripe && (
        <DetailCard title="Stripe">
          <div className="flex items-center gap-2 -mt-1 mb-2">
            <CreditCard className="size-4 text-purple-500" />
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
                      {sub.id.slice(0, 24)}…
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
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Open in Stripe
            </a>
          )}
        </DetailCard>
      )}

      {/* CTA */}
      <ActionBar>
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/customers/${customer.stripeCustomerId ?? customer.sfAccountId ?? customer.id}`}>
            <Users className="mr-2 size-3.5" />
            View Full Customer Profile
          </Link>
        </Button>
      </ActionBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function DetailEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-64 rounded-xl border bg-card text-center">
      <Search className="size-5 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Select a renewal or search a customer</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDollarsFull(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}
