"use client";

import Link from "next/link";
import {
  Building2,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  RefreshCw,
  SidebarIcon,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailCard, DetailRow } from "@/components/omni/detail-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ContractView,
  CustomerView,
  RenewalView,
  SubscriptionItemView,
  SubscriptionView,
  UnifiedInvoiceRow,
  UnifiedPaymentRow,
} from "@/lib/projections/types";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtInterval(interval: string | null, count: number): string {
  if (!interval) return "—";
  if (interval === "month" && count === 1) return "Monthly";
  if (interval === "month" && count === 3) return "Quarterly";
  if (interval === "month" && count === 6) return "Semi-annual";
  if (interval === "year" && count === 1) return "Annual";
  return count > 1 ? `Every ${count} ${interval}s` : interval;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtUnits(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

type BV = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

function subStatusVariant(s: string): BV {
  if (s === "active" || s === "trialing") return "success";
  if (s === "past_due") return "warning";
  if (s === "canceled" || s === "unpaid") return "destructive";
  return "secondary";
}

function invoiceStatusVariant(s: string | null): BV {
  if (s === "paid") return "success";
  if (s === "open") return "warning";
  if (s === "uncollectible") return "destructive";
  if (s === "void") return "secondary";
  return "outline";
}

function contractStatusVariant(s: string): BV {
  const l = s.toLowerCase();
  if (l === "activated") return "success";
  if (l === "draft" || l === "pending") return "secondary";
  if (l === "canceled" || l === "cancelled") return "destructive";
  return "outline";
}

function correlationVariant(status: "matched" | "candidate" | "unmatched"): BV {
  if (status === "matched") return "success";
  if (status === "candidate") return "warning";
  return "secondary";
}

function correlationLabel(
  status: "matched" | "candidate" | "unmatched",
  method: "exact_item_id" | "exact_price_id" | "heuristic" | null,
): string {
  if (status === "unmatched") return "Unmatched";
  if (status === "candidate") return "Candidate";
  if (method === "exact_item_id") return "Matched (item)";
  if (method === "exact_price_id") return "Matched (price)";
  return "Matched";
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Empty({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-semibold text-foreground leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  customer: CustomerView;
  subscriptions: SubscriptionView[];
  contracts: ContractView[];
  invoices: UnifiedInvoiceRow[];
  payments: UnifiedPaymentRow[];
  renewal: RenewalView | null;
}

// ---------------------------------------------------------------------------
// Page header (must live inside SidebarProvider to call useSidebar)
// ---------------------------------------------------------------------------

function PageHeader({ customer, subscriptions }: { customer: CustomerView; subscriptions: SubscriptionView[] }) {
  const { toggleSidebar } = useSidebar();
  const activeSub = subscriptions.find((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  );

  return (
    <header className="bg-background sticky top-10 z-40 flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
        <SidebarIcon className="size-4" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/customers" className="text-sm">
              Customers
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">{customer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {activeSub && (
          <Badge variant={subStatusVariant(activeSub.status)}>{activeSub.status}</Badge>
        )}
        <Separator orientation="vertical" className="h-4 mx-1" />

        {customer.sfAccountId && (
          <a
            href={`https://displai.lightning.force.com/lightning/r/Account/${customer.sfAccountId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-3" />
            Salesforce
          </a>
        )}
        {customer.stripeCustomerId && (
          <a
            href={`https://dashboard.stripe.com/customers/${customer.stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-3" />
            Stripe
          </a>
        )}
        {customer.sfAccountId && (
          <Link
            href={`/quotes/create?customerId=${customer.sfAccountId}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Create Quote
          </Link>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// SubscriptionBlock — parent subscription summary + nested line items
// ---------------------------------------------------------------------------

function LineItemsTable({ items, currency }: { items: SubscriptionItemView[]; currency: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs h-8">Product</TableHead>
            <TableHead className="text-xs h-8 text-right">Qty</TableHead>
            <TableHead className="text-xs h-8 text-right">Price</TableHead>
            <TableHead className="text-xs h-8">Interval</TableHead>
            <TableHead className="text-xs h-8">Service Period</TableHead>
            <TableHead className="text-xs h-8">SF Subscription</TableHead>
            <TableHead className="text-xs h-8">Contract</TableHead>
            <TableHead className="text-xs h-8">Correlation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/20">
              <TableCell className="text-sm font-medium py-2">{item.productName}</TableCell>
              <TableCell className="text-sm tabular-nums text-right py-2">{item.quantity}</TableCell>
              <TableCell className="text-sm tabular-nums text-right py-2">
                {fmtCents(item.unitAmountCents, currency)}
              </TableCell>
              <TableCell className="text-sm py-2">
                {fmtInterval(item.billingInterval, item.intervalCount)}
              </TableCell>
              <TableCell className="text-xs py-2 whitespace-nowrap">
                {fmtDate(item.servicePeriodStart)}
                <span className="mx-1 text-muted-foreground">→</span>
                {fmtDate(item.servicePeriodEnd)}
              </TableCell>
              <TableCell className="text-sm py-2">
                {item.sfContractLineName ? (
                  <span className="text-foreground">{item.sfContractLineName}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm py-2">
                {item.contractNumber ? (
                  <span className="font-mono text-xs">{item.contractNumber}</span>
                ) : item.contractId ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    …{item.contractId.slice(-6)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-2">
                <Badge
                  variant={correlationVariant(item.correlationStatus)}
                  className="text-xs"
                  title={item.correlationMethod ?? undefined}
                >
                  {correlationLabel(item.correlationStatus, item.correlationMethod)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SubscriptionBlock({ sub }: { sub: SubscriptionView }) {
  const productNames = sub.items.map((i) => i.productName).join(", ");
  const primaryItem = sub.items[0];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Parent summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Badge variant={subStatusVariant(sub.status)}>{sub.status}</Badge>
          {sub.cancelAtPeriodEnd && <Badge variant="warning">cancelling</Badge>}
        </div>
        <span className="text-sm font-medium text-foreground truncate max-w-xs" title={productNames}>
          {productNames || "—"}
        </span>
        <span className="text-sm tabular-nums font-medium text-foreground ml-auto">
          {fmtCents(sub.mrrCents, sub.currency)}
          <span className="text-muted-foreground text-xs ml-1">/mo</span>
        </span>
        {primaryItem && (
          <span className="text-sm text-muted-foreground">
            {fmtInterval(primaryItem.billingInterval, primaryItem.intervalCount)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          ends {fmtDate(sub.currentPeriodEnd)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{sub.id}</span>
      </div>

      {/* Nested line items */}
      <LineItemsTable items={sub.items} currency={sub.currency} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section navigation sidebar
// ---------------------------------------------------------------------------

function PageSidebar({
  subscriptions,
  contracts,
  invoices,
  payments,
}: Pick<Props, "subscriptions" | "contracts" | "invoices" | "payments">) {
  const activeSubCount = subscriptions.filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  ).length;

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      collapsible="offcanvas"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#sf-account"><Building2 />Salesforce Account</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#stripe-customer"><CreditCard />Stripe Customer</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Commercial</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#subscriptions"><RefreshCw />Subscriptions</a>
                </SidebarMenuButton>
                {activeSubCount > 0 && <SidebarMenuBadge>{activeSubCount}</SidebarMenuBadge>}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#contracts"><FileCheck2 />Contracts</a>
                </SidebarMenuButton>
                {contracts.length > 0 && <SidebarMenuBadge>{contracts.length}</SidebarMenuBadge>}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#invoices"><FileText />Invoices</a>
                </SidebarMenuButton>
                {invoices.length > 0 && <SidebarMenuBadge>{invoices.length}</SidebarMenuBadge>}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#payments"><Wallet />Payments</a>
                </SidebarMenuButton>
                {payments.length > 0 && <SidebarMenuBadge>{payments.length}</SidebarMenuBadge>}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// Customer360
// ---------------------------------------------------------------------------

export function Customer360({ customer, subscriptions, contracts, invoices, payments, renewal }: Props) {
  const activeSub = subscriptions.find((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  );
  const activeContract = contracts.find((c) => c.status === "Activated");

  const mrrDisplay = activeSub?.mrrCents != null
    ? fmtCents(activeSub.mrrCents, activeSub.currency)
    : customer.activeContract?.mrrApprox != null
    ? fmtUnits(customer.activeContract.mrrApprox)
    : "—";

  const arrDisplay = activeContract?.arrApprox != null
    ? fmtUnits(activeContract.arrApprox)
    : customer.activeContract?.arrApprox != null
    ? fmtUnits(customer.activeContract.arrApprox)
    : activeSub?.mrrCents != null
    ? fmtCents(activeSub.mrrCents * 12, activeSub.currency)
    : "—";

  const contractEndDate = activeContract?.endDate ?? customer.activeContract?.endDate;
  const daysToExpiry = activeContract?.daysToExpiry ?? customer.activeContract?.daysToExpiry;

  const activeSubCount = subscriptions.filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  ).length;

  return (
    <>
      <PageHeader customer={customer} subscriptions={subscriptions} />

      <div className="flex flex-1">
        <PageSidebar
          subscriptions={subscriptions}
          contracts={contracts}
          invoices={invoices}
          payments={payments}
        />

        <SidebarInset className="bg-white">
          {/* Heading block */}
          <div className="border-b px-6 pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {[customer.domain, customer.accountType, customer.accountStatus].filter(Boolean).join(" · ") || "Customer account"}
                </p>
              </div>
              {customer.delinquent && <Badge variant="destructive">Delinquent</Badge>}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-6 p-6">

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="MRR" value={mrrDisplay} />
                <Stat label="ARR" value={arrDisplay} />
                <Stat label="Active Subscriptions" value={activeSubCount.toString()} />
                <Stat
                  label="Contract End"
                  value={contractEndDate ? fmtDate(contractEndDate) : "—"}
                  sub={daysToExpiry != null ? `${daysToExpiry} days remaining` : undefined}
                />
              </div>

              {/* Salesforce Account + Stripe Customer */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DetailCard
                  id="sf-account"
                  title="Salesforce Account"
                  action={
                    customer.sfAccountId ? (
                      <a
                        href={`https://displai.lightning.force.com/lightning/r/Account/${customer.sfAccountId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Open in Salesforce"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : undefined
                  }
                >
                  <DetailRow label="Account ID" value={customer.sfAccountId} mono />
                  <DetailRow label="Domain" value={customer.domain} />
                  <DetailRow label="Account Owner" value={customer.ownerName} />
                  <DetailRow label="CSM" value={customer.csmName} />
                  <DetailRow label="Account Type" value={customer.accountType} />
                  <DetailRow label="Status" value={customer.accountStatus} />
                </DetailCard>

                <DetailCard
                  id="stripe-customer"
                  title="Stripe Customer"
                  action={
                    customer.stripeCustomerId ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${customer.stripeCustomerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Open in Stripe"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : undefined
                  }
                >
                  <DetailRow label="Customer ID" value={customer.stripeCustomerId} mono />
                  <DetailRow label="Email" value={customer.billingEmail} />
                  <DetailRow label="Currency" value={customer.currency?.toUpperCase()} />
                  <DetailRow
                    label="Balance"
                    value={
                      customer.balanceCents !== 0
                        ? fmtCents(Math.abs(customer.balanceCents), customer.currency ?? "usd")
                        : "None"
                    }
                    emphasis={customer.balanceCents !== 0}
                  />
                  <DetailRow
                    label="Delinquent"
                    value={
                      customer.delinquent
                        ? <Badge variant="destructive">Yes</Badge>
                        : "No"
                      }
                    />
                </DetailCard>
              </div>

              {/* Subscriptions */}
              <Card id="subscriptions">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Subscriptions
                    {subscriptions.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {subscriptions.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {subscriptions.length === 0 ? (
                    <Empty message="No subscriptions found." />
                  ) : (
                    <div className="space-y-3">
                      {subscriptions.map((sub) => (
                        <SubscriptionBlock key={sub.id} sub={sub} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contracts */}
              <Card id="contracts">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Contracts
                    {contracts.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {contracts.length}
                      </span>
                    )}
                  </CardTitle>
                  {renewal && (
                    <CardAction>
                      <Badge
                        variant={
                          renewal.renewalUrgency === "overdue" || renewal.renewalUrgency === "critical"
                            ? "destructive"
                            : renewal.renewalUrgency === "due_soon"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        Renewal: {renewal.renewalUrgency.replace("_", "\u00a0")}
                      </Badge>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {contracts.length === 0 ? (
                    <Empty message="No contracts found." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contract #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>ARR</TableHead>
                          <TableHead>Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              {c.contractNumber ?? `…${c.id.slice(-6)}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant={contractStatusVariant(c.status)}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{fmtDate(c.startDate)}</TableCell>
                            <TableCell>
                              <span>{fmtDate(c.endDate)}</span>
                              {c.daysToExpiry != null && c.status === "Activated" && (
                                <span
                                  className={cn(
                                    "ml-1.5 text-xs",
                                    c.daysToExpiry < 0
                                      ? "text-destructive"
                                      : c.daysToExpiry < 30
                                      ? "text-warning"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  ({c.daysToExpiry}d)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {c.contractTerm ? `${c.contractTerm}mo` : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums font-medium">
                              {c.mrrApprox != null ? fmtUnits(c.mrrApprox) : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums font-medium">
                              {c.arrApprox != null ? fmtUnits(c.arrApprox) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {c.doNotRenew && <Badge variant="destructive">DNR</Badge>}
                                {c.evergreen && <Badge variant="secondary">Evergreen</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Invoices */}
              <Card id="invoices">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Invoices
                    {invoices.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {invoices.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {invoices.length === 0 ? (
                    <Empty message="No invoices found." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {inv.source === "stripe" ? "Stripe" : "Salesforce"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {inv.number ?? `…${inv.id.slice(-8)}`}
                            </TableCell>
                            <TableCell>
                              {inv.status && (
                                <Badge variant={invoiceStatusVariant(inv.status)}>
                                  {inv.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                            <TableCell>{fmtDate(inv.dueDate)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtCents(inv.totalCents, inv.currency)}
                            </TableCell>
                            <TableCell>
                              {inv.externalUrl && (
                                <a
                                  href={inv.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Payments */}
              <Card id="payments">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Payments
                    {payments.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {payments.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {payments.length === 0 ? (
                    <Empty message="No payments found." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {p.source === "stripe" ? "Stripe" : "Salesforce"}
                              </Badge>
                            </TableCell>
                            <TableCell>{fmtDate(p.paymentDate)}</TableCell>
                            <TableCell className={p.paymentMethod ? "text-foreground" : "text-muted-foreground"}>
                              {p.paymentMethod ?? "—"}
                            </TableCell>
                            <TableCell className={`font-mono text-xs ${p.invoiceId ? "text-foreground" : "text-muted-foreground"}`}>
                              {p.invoiceId ? `…${p.invoiceId.slice(-8)}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  p.status === "succeeded" || p.status === "Applied"
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtUnits(p.amount, p.currency)}
                            </TableCell>
                            <TableCell>
                              {p.receiptUrl && (
                                <a
                                  href={p.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

          </div>
        </SidebarInset>
      </div>
    </>
  );
}
