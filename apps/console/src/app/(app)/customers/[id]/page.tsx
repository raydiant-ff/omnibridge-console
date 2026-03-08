import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
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

  const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://raydiant.lightning.force.com";
  const sfUrl = `${sfBase}/lightning/r/Account/${account.id}/view`;
  const stripeUrl = account.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${account.stripeCustomerId}`
    : null;

  const shippingFormatted = formatAddress(account.shippingAddress);
  const billingFormatted = formatAddress(account.billingAddress);

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/customers"
          className="transition-colors hover:text-foreground"
        >
          Customers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{account.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {account.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[account.industry, account.type].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 px-2" asChild>
            <a href={sfUrl} target="_blank" rel="noopener noreferrer">
              { /* eslint-disable-next-line @next/next/no-img-element */ }
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
        </div>
      </div>

      {/* ────── Salesforce ────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-7 w-auto" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Details">
            <Field label="Name" value={account.name} />
            <Field label="Links">
              <LinkButtons sfUrl={sfUrl} stripeUrl={stripeUrl} />
            </Field>
            <Field
              label="First Closed Won"
              value={fmtDate(account.dateOfFirstClosedWon)}
            />
            <Field label="Account Value (MRR)">
              <span className="font-mono">
                {fmtCurrency(account.accountValue)}
              </span>
            </Field>
            <Field label="Total ARR">
              <span className="font-mono">
                {fmtCurrency(account.totalArr)}
              </span>
            </Field>
            <Field label="Lifetime Value">
              <span className="font-mono">
                {fmtCurrency(account.lifetimeValue)}
              </span>
            </Field>
          </Section>

          <Section title="AR">
            <Field label="Outstanding AR">
              <span className="font-mono">
                {fmtCurrency(account.outstandingAr)}
              </span>
            </Field>
            <Field label="AR Status">
              {account.arStatus ? (
                <Badge
                  variant={
                    account.arStatus === "Current" ? "default" : "destructive"
                  }
                >
                  {account.arStatus}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>

          <Section title="Contacts & Addresses">
            <Field label="Primary Contact" value={account.primaryContactName} />
            <Field
              label="Primary Contact Email"
              value={account.primaryContactEmail}
            />
            <Field label="Dashboard Email" value={account.dashboardEmail} />
            <Field label="Bill To Contact" value={account.billToContactName} />
            <Field label="Bill To Email" value={account.billToEmail} />
            <Field label="Shipping Address">
              {shippingFormatted ? (
                <span className="whitespace-pre-line text-sm">
                  {shippingFormatted}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Billing Address">
              {billingFormatted ? (
                <span className="whitespace-pre-line text-sm">
                  {billingFormatted}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>

          <Section title="Customer Success">
            <Field label="Account Notes">
              {account.accountNotes ? (
                <p className="whitespace-pre-wrap text-sm">
                  {account.accountNotes}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Additional Notes" value={account.churnDetails} />
            <Field label="AR Notes" value={account.arNotes} />
            <Field label="CSM Health Update">
              {account.latestHealthUpdate ? (
                <p className="whitespace-pre-wrap text-sm">
                  {account.latestHealthUpdate}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>
        </div>
      </div>

      {/* ────── Stripe ────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/stripe-logo.svg" alt="Stripe" className="h-7 w-auto" />
        </div>
        {!stripeDetail ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No Stripe data available</p>
            <p className="text-sm text-muted-foreground">
              {account.stripeCustomerId
                ? "Could not fetch data from Stripe."
                : "This account has no linked Stripe Customer ID."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <SubscriptionsBlock subscriptions={stripeDetail.subscriptions} />
            <PaymentsBlock payments={stripeDetail.payments} />
            <InvoicesBlock invoices={stripeDetail.invoices} />
            <ActivityBlock events={stripeDetail.recentActivity} />
          </div>
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
        <EmptyRow>No subscriptions</EmptyRow>
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
              <p className="text-xs text-muted-foreground">
                {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}
                {sub.cancelAtPeriodEnd && " (cancels at period end)"}
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
                          <TableCell className="text-right font-mono text-xs">
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
        <EmptyRow>No payments</EmptyRow>
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
                  <TableCell className="text-right font-mono text-xs">
                    {fmtCents(p.amount, p.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
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
        <EmptyRow>No invoices</EmptyRow>
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
                  <TableCell className="text-right font-mono text-xs">
                    {fmtCents(inv.amountDue, inv.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
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
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <a
                        href={`https://dashboard.stripe.com/invoices/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
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
        <EmptyRow>No recent activity</EmptyRow>
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

/* ─── Shared components ─── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="min-w-[160px] shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">
        {children ??
          (value ? value : <span className="text-muted-foreground">—</span>)}
      </dd>
    </div>
  );
}

function LinkButtons({
  sfUrl,
  stripeUrl,
}: {
  sfUrl: string;
  stripeUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2"
        asChild
      >
        <a href={sfUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-5 w-auto" />
          <ExternalLink className="size-3" />
        </a>
      </Button>
      {stripeUrl ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2"
          asChild
        >
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
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
