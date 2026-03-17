"use server";

import { cached } from "@/lib/cache";
import { flags } from "@/lib/feature-flags";

export interface StripeCoupon {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: "forever" | "once" | "repeating";
  durationInMonths: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  valid: boolean;
  created: number;
  metadata: Record<string, string> | null;
  appliesTo: string[] | null;
}

const MOCK_COUPONS: StripeCoupon[] = [
  {
    id: "coup_mock_10pct",
    name: "10% Off",
    percentOff: 10,
    amountOff: null,
    currency: null,
    duration: "once",
    durationInMonths: null,
    maxRedemptions: null,
    timesRedeemed: 5,
    valid: true,
    created: 1700000000,
    metadata: {},
    appliesTo: null,
  },
  {
    id: "coup_mock_50usd",
    name: "$50 Off",
    percentOff: null,
    amountOff: 5000,
    currency: "usd",
    duration: "once",
    durationInMonths: null,
    maxRedemptions: 100,
    timesRedeemed: 12,
    valid: true,
    created: 1700100000,
    metadata: {},
    appliesTo: null,
  },
];

async function _fetchStripeCouponsFromApi(): Promise<StripeCoupon[]> {
  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const all: StripeCoupon[] = [];
  let starting_after: string | undefined;

  for (;;) {
    const page = await stripe.coupons.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const c of page.data) {
      all.push({
        id: c.id,
        name: c.name,
        percentOff: c.percent_off,
        amountOff: c.amount_off,
        currency: c.currency,
        duration: c.duration,
        durationInMonths: c.duration_in_months,
        maxRedemptions: c.max_redemptions,
        timesRedeemed: c.times_redeemed,
        valid: c.valid,
        created: c.created,
        metadata: c.metadata,
        appliesTo: c.applies_to?.products ?? null,
      });
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }

  return all;
}

export async function fetchStripeCoupons(): Promise<StripeCoupon[]> {
  if (flags.useMockStripe) return MOCK_COUPONS;
  return cached(_fetchStripeCouponsFromApi, "stripe-coupons", {
    revalidate: 120,
    tags: ["stripe-coupons"],
  });
}
