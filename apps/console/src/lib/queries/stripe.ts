"use server";

import { flags } from "@/lib/feature-flags";
import { getMockStripeData, type MockStripeData } from "@/lib/mock-data";

export async function getStripeDataForCustomer(stripeCustomerId: string | null): Promise<MockStripeData | null> {
  if (!stripeCustomerId) return null;

  if (flags.useMockStripe) {
    return getMockStripeData(stripeCustomerId);
  }

  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const [customer, subscriptions, invoices, paymentMethods] = await Promise.all([
    stripe.customers.retrieve(stripeCustomerId),
    stripe.subscriptions.list({ customer: stripeCustomerId, limit: 20 }),
    stripe.invoices.list({ customer: stripeCustomerId, limit: 20 }),
    stripe.paymentMethods.list({ customer: stripeCustomerId, limit: 10 }),
  ]);

  if (customer.deleted) return null;

  return {
    customer: {
      id: customer.id,
      name: customer.name ?? "",
      email: customer.email ?? "",
      currency: customer.currency ?? "usd",
      balance: customer.balance ?? 0,
      created: customer.created,
      default_source: typeof customer.default_source === "string" ? customer.default_source : null,
    },
    subscriptions: subscriptions.data.map((s) => ({
      id: s.id,
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      plan: {
        id: s.items.data[0]?.price?.id ?? "",
        nickname: s.items.data[0]?.price?.nickname ?? "—",
        amount: s.items.data[0]?.price?.unit_amount ?? 0,
        currency: s.items.data[0]?.price?.currency ?? "usd",
        interval: s.items.data[0]?.price?.recurring?.interval ?? "month",
      },
    })),
    invoices: invoices.data.map((i) => ({
      id: i.id,
      status: i.status ?? "draft",
      amount_due: i.amount_due,
      amount_paid: i.amount_paid,
      currency: i.currency,
      created: i.created,
      hosted_invoice_url: i.hosted_invoice_url ?? "#",
    })),
    paymentMethods: paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year } : null,
    })),
  };
}
