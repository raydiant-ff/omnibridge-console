export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAccountDetailById } from "@/lib/queries/customers";
import { getStripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";
import type { StripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  PageHeader,
  DetailGrid,
  Section,
  FieldRow,
  EmptyState,
} from "@/components/workspace";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtCurrency(amount: number | null | undefined, currency = "usd"): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtCents(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
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

function formatAddress(addr: {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}): string | null {
  const parts = [
    addr.street,
    [addr.city, addr.state].filter(Boolean).join(", "),
    addr.postalCode,
    addr.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
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
    case "requires_action":
      return "secondary";
    case "canceled":
    case "cancelled":
    case "failed":
    case "requires_payment_method":
    case "uncollectible":
    case "void":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;

  const account = await getAccountDetailById(id);
  if (!account) notFound();

  const stripeDetail = await getStripeCustomerDetail(account.stripeCustomerId);

  const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";
  const sfUrl = `${sfBase}/lightning/r/Account/${account.id}/view`;
  const stripeUrl = account.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${account.stripeCustomerId}`
    : null;

  const shippingFormatted = formatAddress(account.shippingAddress);
  const billingFormatted = formatAddress(account.billingAddress);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Customers", href: "/customers" },
          { label: account.name },
        ]}
      />

      <PageHeader
        title={account.name}
        description={[account.industry, account.type].filter(Boolean).join(" \u00b7 ")}
        actions={
          <>
            <Button variant="default" size="sm" asChild>
              <Link href={`/customers/${id}/360`}>360 View</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 px-2" asChild>
              <a href={sfUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-6 w-auto" />
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
            {stripeUrl ? (
              <Button variant="outline" size="sm" className="gap-1.5 px-2" asChild>
                <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/stripe-logo.svg" alt="Stripe" className="h-6 w-auto" />
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="px-2 opacity-30" disabled>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/stripe-logo.svg" alt="Stripe" className="h-6 w-auto opacity-30" />
              </Button>
            )}
          </>
        }
      />

      {/* Salesforce */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-7 w-auto" />
        </div>
        <DetailGrid columns={2}>
          <Section title="Details">
            <FieldRow label="Name" value={account.name} />
            <FieldRow label="Links">
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild>
                  <a href={sfUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-5 w-auto" />
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
                {stripeUrl ? (
                  <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild>
                    <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/stripe-logo.svg" alt="Stripe" className="h-5 w-auto" />
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 px-2 opacity-30" disabled>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/stripe-logo.svg" alt="Stripe" className="h-5 w-auto opacity-30" />
                  </Button>
                )}
              </div>
            </FieldRow>
            <FieldRow label="First Closed Won" value={fmtDate(account.dateOfFirstClosedWon)} />
            <FieldRow label="Account Value (MRR)" mono value={fmtCurrency(account.accountValue)} />
            <FieldRow label="Total ARR" mono value={fmtCurrency(account.totalArr)} />
            <FieldRow label="Lifetime Value" mono value={fmtCurrency(account.lifetimeValue)} />
          </Section>

          <Section title="AR">
            <FieldRow label="Outstanding AR" mono value={fmtCurrency(account.outstandingAr)} />
            <FieldRow label="AR Status">
              {account.arStatus ? (
                <Badge
                  variant={account.arStatus === "Current" ? "default" : "destructive"}
                >
                  {account.arStatus}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FieldRow>
          </Section>

          <Section title="Contacts & Addresses">
            <FieldRow label="Primary Contact" value={account.primaryContactName} />
            <FieldRow label="Primary Contact Email" value={account.primaryContactEmail} />
            <FieldRow label="Dashboard Email" value={account.dashboardEmail} />
            <FieldRow label="Bill To Contact" value={account.billToContactName} />
            <FieldRow label="Bill To Email" value={account.billToEmail} />
            <FieldRow label="Shipping Address">
              {shippingFormatted ? (
                <span className="whitespace-pre-line text-sm">{shippingFormatted}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FieldRow>
            <FieldRow label="Billing Address">
              {billingFormatted ? (
                <span className="whitespace-pre-line text-sm">{billingFormatted}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FieldRow>
          </Section>

          <Section title="Customer Success">
            <FieldRow label="Account Notes">
              {account.accountNotes ? (
                <p className="whitespace-pre-wrap text-sm">{account.accountNotes}</p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FieldRow>
            <FieldRow label="Additional Notes" value={account.churnDetails} />
            <FieldRow label="AR Notes" value={account.arNotes} />
            <FieldRow label="CSM Health Update">
              {account.latestHealthUpdate ? (
                <p className="whitespace-pre-wrap text-sm">{account.latestHealthUpdate}</p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FieldRow>
          </Section>
        </DetailGrid>
      </div>

      {/* Stripe */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/stripe-logo.svg" alt="Stripe" className="h-7 w-auto" />
        </div>
        {!stripeDetail ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No Stripe data available</p>
            <p className="text-sm text-muted-foreground">
              {account.stripeCustomerId
                ? "Could not fetch data from Stripe."
                : "This account has no linked Stripe Customer ID."}
            </p>
          </div>
        ) : (
          <DetailGrid columns={2}>
            <SubscriptionsBlock subscriptions={stripeDetail.subscriptions} />
            <PaymentsBlock payments={stripeDetail.payments} />
            <InvoicesBlock invoices={stripeDetail.invoices} />
            <ActivityBlock events={stripeDetail.recentActivity} />
          </DetailGrid>
        )}
      </div>
    </div>
  );
}

/* ─── Stripe blocks ─── */

function SubscriptionsBlock({
  subscriptions,
}: {
  subscriptions: StripeCustomerDetail["subscriptions"];
}) {
  return (
    <Section title={`Subscriptions (${subscriptions.length})`}>
      {subscriptions.length === 0 ? (
        <EmptyState title="No subscriptions" />
      ) : (
        <div className="divide-y">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-sm text-primary hover:underline"
                >
                  {sub.id}
                  <ExternalLink className="size-3" />
                </a>
                <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
              </div>
              <p className="text-xs text-foreground">
                {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}
                {sub.cancelAtPeriodEnd && <span className="text-muted-foreground"> (cancels at period end)</span>}
              </p>
              {sub.items.length > 0 && (
                <div className="overflow-x-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-right text-xs">Qty</TableHead>
                        <TableHead className="text-right text-xs">Price</TableHead>
                        <TableHead className="text-right text-xs">Interval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            {item.productName ?? item.priceId}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.quantity ?? 1}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {fmtCents(item.amount, item.currency)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.interval ? `/${item.interval}` : "one-time"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function PaymentsBlock({
  payments,
}: {
  payments: StripeCustomerDetail["payments"];
}) {
  return (
    <Section title={`Payments (${payments.length})`}>
      {payments.length === 0 ? (
        <EmptyState title="No payments" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-right text-xs">Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {fmtDate(p.created)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">
                    {fmtCents(p.amount, p.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={`max-w-[180px] truncate text-xs ${p.description ? "text-foreground" : "text-muted-foreground"}`}>
                    {p.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://dashboard.stripe.com/payments/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

function InvoicesBlock({
  invoices,
}: {
  invoices: StripeCustomerDetail["invoices"];
}) {
  return (
    <Section title={`Invoices (${invoices.length})`}>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-right text-xs">Due</TableHead>
                <TableHead className="text-right text-xs">Paid</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    {inv.number ?? inv.id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {fmtDate(inv.created)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">
                    {fmtCents(inv.amountDue, inv.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium">
                    {fmtCents(inv.amountPaid, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant(inv.status ?? "unknown")}
                      className="text-[10px]"
                    >
                      {inv.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <a
                      href={inv.hostedInvoiceUrl ?? `https://dashboard.stripe.com/invoices/${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

function ActivityBlock({
  events,
}: {
  events: StripeCustomerDetail["recentActivity"];
}) {
  return (
    <Section title="Recent Activity">
      {events.length === 0 ? (
        <EmptyState title="No recent activity" />
      ) : (
        <div className="divide-y">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-3 px-4 py-2.5"
            >
              <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm">{evt.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDateTime(evt.created)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
