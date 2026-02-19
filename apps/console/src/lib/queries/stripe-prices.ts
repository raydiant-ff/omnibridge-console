"use server";

import { flags } from "@/lib/feature-flags";

export interface StripePrice {
  id: string;
  nickname: string;
  unitAmount: number;
  currency: string;
  interval: string;
  productName: string;
  active: boolean;
}

const MOCK_PRICES: StripePrice[] = [
  { id: "price_mock_starter_mo", nickname: "Starter Monthly", unitAmount: 2900, currency: "usd", interval: "month", productName: "Starter Plan", active: true },
  { id: "price_mock_starter_yr", nickname: "Starter Annual", unitAmount: 29000, currency: "usd", interval: "year", productName: "Starter Plan", active: true },
  { id: "price_mock_pro_mo", nickname: "Pro Monthly", unitAmount: 9900, currency: "usd", interval: "month", productName: "Pro Plan", active: true },
  { id: "price_mock_pro_yr", nickname: "Pro Annual", unitAmount: 99000, currency: "usd", interval: "year", productName: "Pro Plan", active: true },
  { id: "price_mock_ent_mo", nickname: "Enterprise Monthly", unitAmount: 49900, currency: "usd", interval: "month", productName: "Enterprise Plan", active: true },
  { id: "price_mock_ent_yr", nickname: "Enterprise Annual", unitAmount: 499000, currency: "usd", interval: "year", productName: "Enterprise Plan", active: true },
  { id: "price_mock_addon_seat", nickname: "Additional Seat", unitAmount: 1500, currency: "usd", interval: "month", productName: "Seat Add-on", active: true },
];

export async function searchStripePrices(query: string): Promise<StripePrice[]> {
  if (flags.useMockStripe) {
    if (!query) return MOCK_PRICES;
    const q = query.toLowerCase();
    return MOCK_PRICES.filter(
      (p) =>
        p.nickname.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        p.id.includes(q),
    );
  }

  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const prices = await stripe.prices.list({
    active: true,
    limit: 50,
    expand: ["data.product"],
    ...(query ? { lookup_keys: [query] } : {}),
  });

  return prices.data
    .filter((p) => p.recurring)
    .map((p) => {
      const product = p.product as { name?: string } | string;
      const productName = typeof product === "object" ? product.name ?? "—" : "—";
      return {
        id: p.id,
        nickname: p.nickname ?? productName,
        unitAmount: p.unit_amount ?? 0,
        currency: p.currency,
        interval: p.recurring!.interval,
        productName,
        active: p.active,
      };
    });
}
