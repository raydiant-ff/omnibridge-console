"use server";

import { cached } from "@/lib/cache";
import { getStripeClient } from "@omnibridge/stripe";
import { flags } from "@/lib/feature-flags";

export interface StripeSubscriptionItem {
  id: string;
  priceId: string;
  productName: string | null;
  quantity: number | null;
  amount: number;
  currency: string;
  interval: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  items: StripeSubscriptionItem[];
}

export interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created: string;
  paymentMethod: string | null;
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string | null;
  dueDate: string | null;
  created: string;
  hostedInvoiceUrl: string | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  created: string;
  summary: string;
}

export interface StripeCustomerDetail {
  subscriptions: StripeSubscription[];
  payments: StripePayment[];
  invoices: StripeInvoice[];
  recentActivity: StripeEvent[];
}

const MOCK_STRIPE_DETAIL: StripeCustomerDetail = {
  subscriptions: [
    {
      id: "sub_mock001",
      status: "active",
      currentPeriodStart: "2026-01-01",
      currentPeriodEnd: "2026-02-01",
      cancelAtPeriodEnd: false,
      items: [
        { id: "si_mock001", priceId: "price_mock001", productName: "Pro Plan", quantity: 1, amount: 4900, currency: "usd", interval: "month" },
        { id: "si_mock002", priceId: "price_mock002", productName: "Add-on: Analytics", quantity: 3, amount: 1500, currency: "usd", interval: "month" },
      ],
    },
  ],
  payments: [
    { id: "pi_mock001", amount: 6400, currency: "usd", status: "succeeded", description: "Invoice for Pro Plan", created: "2026-02-01T00:00:00Z", paymentMethod: "Visa ···4242" },
    { id: "pi_mock002", amount: 6400, currency: "usd", status: "succeeded", description: "Invoice for Pro Plan", created: "2026-01-01T00:00:00Z", paymentMethod: "Visa ···4242" },
  ],
  invoices: [
    { id: "in_mock001", number: "INV-0042", amountDue: 6400, amountPaid: 6400, currency: "usd", status: "paid", dueDate: "2026-02-15", created: "2026-02-01T00:00:00Z", hostedInvoiceUrl: null },
    { id: "in_mock002", number: "INV-0041", amountDue: 6400, amountPaid: 6400, currency: "usd", status: "paid", dueDate: "2026-01-15", created: "2026-01-01T00:00:00Z", hostedInvoiceUrl: null },
  ],
  recentActivity: [
    { id: "evt_mock001", type: "invoice.paid", created: "2026-02-01T00:05:00Z", summary: "Invoice INV-0042 was paid ($64.00)" },
    { id: "evt_mock002", type: "payment_intent.succeeded", created: "2026-02-01T00:04:00Z", summary: "Payment of $64.00 succeeded" },
    { id: "evt_mock003", type: "invoice.created", created: "2026-02-01T00:00:00Z", summary: "Invoice INV-0042 was created" },
  ],
};

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

function formatCents(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}


async function _fetchStripeCustomerDetailFromApi(
  stripeCustomerId: string,
): Promise<StripeCustomerDetail | null> {
  try {
    const stripe = getStripeClient();

    const [subscriptions, paymentIntents, invoices] = await Promise.all([
      stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 20,
        expand: ["data.items.data.price"],
      }),
      stripe.paymentIntents.list({
        customer: stripeCustomerId,
        limit: 20,
      }),
      stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 20,
      }),
    ]);

    // Collect unique product IDs and resolve names
    const productIds = new Set<string>();
    for (const sub of subscriptions.data) {
      for (const si of sub.items.data) {
        const pid = si.price.product;
        if (typeof pid === "string") productIds.add(pid);
      }
    }
    const productNames = new Map<string, string>();
    await Promise.all(
      [...productIds].map(async (id) => {
        try {
          const product = await stripe.products.retrieve(id);
          productNames.set(id, product.name);
        } catch {
          // ignore — will fall back to null
        }
      }),
    );

    return {
      subscriptions: subscriptions.data.map((sub) => ({
        id: sub.id,
        status: sub.status,
        currentPeriodStart: formatTimestamp(sub.current_period_start),
        currentPeriodEnd: formatTimestamp(sub.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        items: sub.items.data.map((si) => {
          const price = si.price;
          const pid = price.product;
          const productName =
            typeof pid === "object" && pid !== null && "name" in pid
              ? (pid as { name: string }).name
              : typeof pid === "string"
                ? productNames.get(pid) ?? null
                : null;
          return {
            id: si.id,
            priceId: price.id,
            productName,
            quantity: si.quantity ?? null,
            amount: price.unit_amount ?? 0,
            currency: price.currency,
            interval: price.recurring?.interval ?? null,
          };
        }),
      })),
      payments: paymentIntents.data.map((pi) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description,
        created: formatTimestamp(pi.created),
        paymentMethod:
          typeof pi.payment_method === "object" &&
          pi.payment_method !== null &&
          "card" in pi.payment_method
            ? `${(pi.payment_method as { card: { brand: string; last4: string } }).card.brand} ···${(pi.payment_method as { card: { brand: string; last4: string } }).card.last4}`
            : null,
      })),
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.due_date ? formatTimestamp(inv.due_date) : null,
        created: formatTimestamp(inv.created),
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      })),
      recentActivity: [
        ...invoices.data.map((inv) => ({
          id: `evt_${inv.id}`,
          type: inv.status === "paid" ? "invoice.paid" : inv.status === "open" ? "invoice.created" : `invoice.${inv.status ?? "unknown"}`,
          created: formatTimestamp(inv.created),
          summary: inv.status === "paid"
            ? `Invoice ${inv.number ?? ""} was paid (${formatCents(inv.amount_paid, inv.currency)})`
            : `Invoice ${inv.number ?? ""} was created`,
        })),
        ...paymentIntents.data.map((pi) => ({
          id: `evt_${pi.id}`,
          type: pi.status === "succeeded" ? "payment_intent.succeeded" : `payment_intent.${pi.status}`,
          created: formatTimestamp(pi.created),
          summary: pi.status === "succeeded"
            ? `Payment of ${formatCents(pi.amount, pi.currency)} succeeded`
            : `Payment of ${formatCents(pi.amount, pi.currency)} ${pi.status}`,
        })),
      ]
        .sort((a, b) => b.created.localeCompare(a.created))
        .slice(0, 15),
    };
  } catch (err) {
    console.error("[getStripeCustomerDetail] error:", err);
    return null;
  }
}

function getCachedStripeCustomerDetail(stripeCustomerId: string) {
  return cached(
    () => _fetchStripeCustomerDetailFromApi(stripeCustomerId),
    `stripe-customer:${stripeCustomerId}`,
    { revalidate: 120, tags: ["stripe-customer"] },
  );
}

export async function getStripeCustomerDetail(
  stripeCustomerId: string | null,
): Promise<StripeCustomerDetail | null> {
  if (!stripeCustomerId) return null;
  if (flags.useMockStripe) return MOCK_STRIPE_DETAIL;
  return getCachedStripeCustomerDetail(stripeCustomerId);
}
