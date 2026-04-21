"use server";

import { cached } from "@/lib/cache";
import { getStripeClient } from "@omnibridge/stripe";
import { flags } from "@/lib/feature-flags";

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  defaultPriceId: string | null;
  images: string[];
  metadata: Record<string, string>;
  created: number;
  updated: number;
  priceCount: number;
}

export interface StripeProductPrice {
  id: string;
  nickname: string | null;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
  active: boolean;
  type: "recurring" | "one_time";
}

const MOCK_PRODUCTS: StripeProduct[] = [
  { id: "prod_mock_starter", name: "Starter Plan", description: "For small teams getting started", active: true, defaultPriceId: "price_mock_starter_mo", images: [], metadata: { tier: "starter" }, created: 1700000000, updated: 1700000000, priceCount: 2 },
  { id: "prod_mock_pro", name: "Pro Plan", description: "For growing businesses that need more power", active: true, defaultPriceId: "price_mock_pro_mo", images: [], metadata: { tier: "pro" }, created: 1700100000, updated: 1700100000, priceCount: 2 },
  { id: "prod_mock_enterprise", name: "Enterprise Plan", description: "Custom solutions for large organizations", active: true, defaultPriceId: "price_mock_ent_mo", images: [], metadata: { tier: "enterprise" }, created: 1700200000, updated: 1700200000, priceCount: 2 },
  { id: "prod_mock_addon_seats", name: "Seat Add-on", description: "Additional user seats", active: true, defaultPriceId: "price_mock_addon_seat", images: [], metadata: { type: "addon" }, created: 1700300000, updated: 1700300000, priceCount: 1 },
  { id: "prod_mock_onboarding", name: "Onboarding Fee", description: "One-time implementation and onboarding", active: true, defaultPriceId: "price_mock_onboard", images: [], metadata: { type: "service" }, created: 1700400000, updated: 1700400000, priceCount: 1 },
  { id: "prod_mock_legacy", name: "Legacy Plan", description: "Deprecated plan — no longer sold", active: false, defaultPriceId: null, images: [], metadata: { tier: "legacy" }, created: 1690000000, updated: 1695000000, priceCount: 1 },
];

const MOCK_PRICES: StripeProductPrice[] = [
  { id: "price_mock_starter_yr", nickname: "Annual", unitAmount: 29000, currency: "usd", interval: "year", active: true, type: "recurring" },
  { id: "price_mock_starter_mo", nickname: "Monthly", unitAmount: 2900, currency: "usd", interval: "month", active: true, type: "recurring" },
];

async function _fetchStripeProductsFromApi(): Promise<StripeProduct[]> {
  const stripe = getStripeClient();

  const allProducts = await paginate((starting_after) =>
    stripe.products.list({ limit: 100, active: true, starting_after }),
  );

  return allProducts.map((prod) => ({
    id: prod.id,
    name: prod.name,
    description: prod.description,
    active: prod.active,
    defaultPriceId: typeof prod.default_price === "string"
      ? prod.default_price
      : prod.default_price?.id ?? null,
    images: prod.images,
    metadata: prod.metadata,
    created: prod.created,
    updated: prod.updated,
    priceCount: prod.default_price ? 1 : 0,
  }));
}

export async function fetchStripeProducts(): Promise<StripeProduct[]> {
  if (flags.useMockStripe) return MOCK_PRODUCTS;
  return cached(_fetchStripeProductsFromApi, "stripe-products", {
    revalidate: 300,
    tags: ["stripe-products"],
  });
}

export async function fetchPricesForProduct(productId: string): Promise<StripeProductPrice[]> {
  if (flags.useMockStripe) return MOCK_PRICES;
  return cached(
    async () => {
      const stripe = getStripeClient();
      const prices = await stripe.prices.list({ product: productId, limit: 100 });
      return prices.data.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        unitAmount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval ?? null,
        active: p.active,
        type: (p.recurring ? "recurring" : "one_time") as "recurring" | "one_time",
      }));
    },
    `stripe-prices:${productId}`,
    { revalidate: 300, tags: ["stripe-products"] },
  );
}

/**
 * Determine expected recurrence from product metadata.
 * Returns true for recurring, false for one-time, null if unknown.
 */
function expectedRecurring(meta: Record<string, string>): boolean | null {
  const subType = (meta["Subscription Type"] ?? "").toLowerCase();
  const category = (meta["RAY Category"] ?? "").toLowerCase();

  if (
    subType.includes("one-time") ||
    subType.includes("one time") ||
    category === "hw"
  ) {
    return false;
  }
  if (
    subType.includes("renew") ||
    subType.includes("recurring") ||
    subType.includes("subscription")
  ) {
    return true;
  }
  return null;
}

function toProductPrice(p: {
  id: string;
  nickname: string | null;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
  active: boolean;
}): StripeProductPrice {
  return {
    id: p.id,
    nickname: p.nickname,
    unitAmount: p.unit_amount,
    currency: p.currency,
    interval: p.recurring?.interval ?? null,
    active: p.active,
    type: (p.recurring ? "recurring" : "one_time") as "recurring" | "one_time",
  };
}

/**
 * For recurring prices, prefer the annual/yearly price as the canonical base.
 * All billing-frequency normalization (quarterly, semi-annual, etc.) derives
 * from the annual amount, avoiding dynamic prices from shorter intervals.
 */
function preferAnnualPrice<
  T extends { recurring: { interval: string } | null; unit_amount: number | null },
>(candidates: T[]): T | undefined {
  const yearly = candidates.find(
    (p) => p.recurring?.interval === "year" && p.unit_amount != null,
  );
  if (yearly) return yearly;
  return candidates.find((p) => p.unit_amount != null);
}

export async function fetchStandardPriceForProduct(
  productId: string,
  defaultPriceId: string | null,
  productMetadata?: Record<string, string>,
): Promise<StripeProductPrice | null> {
  if (flags.useMockStripe) return MOCK_PRICES[0] ?? null;
  return cached(
    async () => {
      const stripe = getStripeClient();

      const allPrices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 100,
      });

      const shouldRecur = productMetadata
        ? expectedRecurring(productMetadata)
        : null;

      const recurrenceMatches = (p: { recurring: unknown }) => {
        if (shouldRecur === null) return true;
        return shouldRecur ? !!p.recurring : !p.recurring;
      };

      const backfilled = allPrices.data.filter(
        (p) => p.metadata?.source === "backfill_standard_price",
      );

      const matchingBackfills = backfilled.filter((p) => recurrenceMatches(p));
      if (matchingBackfills.length > 0) {
        const pick = preferAnnualPrice(matchingBackfills);
        if (pick) return toProductPrice(pick);
      }

      if (backfilled.length > 0 && shouldRecur === null) {
        const pick = preferAnnualPrice(backfilled);
        if (pick) return toProductPrice(pick);
      }

      const recurrencePool = allPrices.data.filter(
        (p) => p.unit_amount != null && recurrenceMatches(p),
      );
      if (recurrencePool.length > 0) {
        const pick = preferAnnualPrice(recurrencePool);
        if (pick) return toProductPrice(pick);
      }

      const first = allPrices.data.find((p) => p.unit_amount != null);
      if (first) return toProductPrice(first);

      return null;
    },
    `stripe-standard-price:${productId}`,
    { revalidate: 300, tags: ["stripe-products"] },
  );
}

async function paginate<T extends { id: string }>(
  fetch: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>,
): Promise<T[]> {
  const all: T[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await fetch(startingAfter);
    all.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return all;
}
