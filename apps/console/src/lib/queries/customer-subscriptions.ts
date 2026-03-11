"use server";

import { flags } from "@/lib/feature-flags";
import { computeItemMrr } from "@/lib/billing-utils";

export interface SubscriptionItemSummary {
  id: string;
  priceId: string;
  productId: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number;
}

export interface CustomerSubscription {
  id: string;
  status: string;
  collectionMethod: string;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  startDate: string;
  scheduleId: string | null;
  mrr: number;
  items: SubscriptionItemSummary[];
  billingInterval: string | null;
  billingIntervalCount: number;
  metadata: Record<string, string>;
}

function ts(epoch: number): string {
  return new Date(epoch * 1000).toISOString();
}

function productNameFrom(
  price: any,
  names?: Map<string, string>,
): string {
  const product = price?.product;
  if (typeof product === "object" && product !== null && "name" in product) {
    return (product as { name: string }).name;
  }
  if (typeof product === "string" && names?.has(product)) {
    return names.get(product)!;
  }
  return price?.nickname ?? price?.id ?? "Unknown";
}

function productIdFrom(price: any): string {
  const product = price?.product;
  if (typeof product === "string") return product;
  if (typeof product === "object" && product !== null && "id" in product) {
    return (product as { id: string }).id;
  }
  return "";
}

export async function getCustomerSubscriptions(
  stripeCustomerId: string,
): Promise<CustomerSubscription[]> {
  if (flags.useMockStripe) {
    return MOCK_SUBSCRIPTIONS;
  }

  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const subs: any[] = [];

  for await (const sub of stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 100,
    expand: ["data.schedule", "data.items.data.price.product"],
    status: "all",
  })) {
    if (sub.status === "active" || sub.status === "trialing") {
      subs.push(sub);
    }
  }

  return subs.map((sub) => {
    const items: SubscriptionItemSummary[] = sub.items.data.map((si: any) => {
      const price = si.price;
      const interval = price?.recurring?.interval ?? null;
      const intervalCount = price?.recurring?.interval_count ?? 1;
      const quantity = si.quantity ?? 1;
      const unitAmount = price?.unit_amount ?? 0;
      const mrr =
        interval && (sub.status === "active" || sub.status === "trialing")
          ? computeItemMrr(unitAmount, interval, intervalCount, quantity)
          : 0;

      return {
        id: si.id,
        priceId: price?.id ?? "",
        productId: productIdFrom(price),
        productName: productNameFrom(price),
        unitAmount,
        currency: price?.currency ?? "usd",
        interval,
        intervalCount,
        quantity,
        mrr,
      };
    });

    const subMrr = items.reduce((s, i) => s + i.mrr, 0);
    const firstRecurring = sub.items.data.find(
      (si: any) => si.price?.recurring,
    );

    const schedule = sub.schedule;
    const scheduleId =
      typeof schedule === "string"
        ? schedule
        : typeof schedule === "object" && schedule !== null
          ? (schedule as any).id
          : null;

    return {
      id: sub.id,
      status: sub.status,
      collectionMethod: sub.collection_method ?? "charge_automatically",
      currency: sub.currency ?? "usd",
      currentPeriodStart: ts(sub.current_period_start),
      currentPeriodEnd: ts(sub.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      cancelAt: sub.cancel_at ? ts(sub.cancel_at) : null,
      startDate: ts(sub.start_date),
      scheduleId,
      mrr: subMrr,
      items,
      billingInterval: firstRecurring?.price?.recurring?.interval ?? null,
      billingIntervalCount:
        firstRecurring?.price?.recurring?.interval_count ?? 1,
      metadata: (sub.metadata as Record<string, string>) ?? {},
    };
  });
}

const MOCK_SUBSCRIPTIONS: CustomerSubscription[] = [
  {
    id: "sub_mock_coterm_001",
    status: "active",
    collectionMethod: "send_invoice",
    currency: "usd",
    currentPeriodStart: "2026-02-01T00:00:00Z",
    currentPeriodEnd: "2026-03-01T00:00:00Z",
    cancelAtPeriodEnd: false,
    cancelAt: null,
    startDate: "2025-06-15T00:00:00Z",
    scheduleId: "sub_sched_mock_001",
    mrr: 18400,
    items: [
      {
        id: "si_mock_1",
        priceId: "price_mock_1",
        productId: "prod_mock_1",
        productName: "Screen Service Pro",
        unitAmount: 5900,
        currency: "usd",
        interval: "month",
        intervalCount: 1,
        quantity: 2,
        mrr: 11800,
      },
      {
        id: "si_mock_2",
        priceId: "price_mock_2",
        productId: "prod_mock_2",
        productName: "Hoopla User License",
        unitAmount: 2200,
        currency: "usd",
        interval: "month",
        intervalCount: 1,
        quantity: 3,
        mrr: 6600,
      },
    ],
    billingInterval: "month",
    billingIntervalCount: 1,
    metadata: { source: "displai_omni", contract_term: "1yr" },
  },
];
