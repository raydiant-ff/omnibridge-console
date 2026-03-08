/**
 * Backfill Standard Prices for Stripe Products
 *
 * Phase 1 (default): Dry-run CSV showing what prices would be created
 * Phase 2 (--execute): Actually creates the prices in Stripe
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-standard-prices.ts > backfill-prices-dryrun.csv
 *   npx tsx scripts/backfill-standard-prices.ts --execute > backfill-prices-results.csv
 */

import { soql } from "../packages/integrations/salesforce/src/index.ts";
import Stripe from "stripe";

const EXECUTE = process.argv.includes("--execute");

const SF_PRODUCT_META_KEYS = [
  "salesforce_product_id",
  "sf_product_id",
  "sfdc_product_id",
  "Salesforce_Product_ID",
  "SalesforceProductId",
];

function getSfIdFromMeta(meta: Record<string, string>): string {
  for (const key of SF_PRODUCT_META_KEYS) {
    if (meta[key]) return meta[key];
  }
  for (const [key, val] of Object.entries(meta)) {
    if (
      key.toLowerCase().includes("salesforce") &&
      key.toLowerCase().includes("product")
    )
      return val;
  }
  return "";
}

async function paginateProducts(stripe: Stripe) {
  const all: Stripe.Product[] = [];
  let starting_after: string | undefined;
  for (;;) {
    const page = await stripe.products.list({
      limit: 100,
      active: true,
      ...(starting_after ? { starting_after } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all;
}

async function paginatePrices(stripe: Stripe, productId: string) {
  const all: Stripe.Price[] = [];
  let starting_after: string | undefined;
  for (;;) {
    const page = await stripe.prices.list({
      product: productId,
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all;
}

interface SFProd {
  Id: string;
  Name: string;
  ProductCode: string | null;
  IsActive: boolean;
  Stripe_Product_ID__c: string | null;
  Stripe_Price_ID__c: string | null;
}

interface SFPbe {
  Id: string;
  Product2Id: string;
  UnitPrice: number;
  IsActive: boolean;
  Pricebook2: { Name: string };
  CurrencyIsoCode?: string;
}

function csvEscape(val: string): string {
  if (
    val.includes(",") ||
    val.includes('"') ||
    val.includes("\n") ||
    val.includes(";")
  ) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

type Action = "CREATE" | "SKIP_HAS_STANDARD" | "SKIP_NO_SF_MATCH" | "SKIP_NO_SF_PRICE" | "SKIP_ZERO_PRICE";

interface PlanRow {
  stripeProductId: string;
  productName: string;
  existingPriceCount: number;
  hasStandardPrice: boolean;
  sfProductId: string;
  sfProductName: string;
  sfStandardPrice: number | null;
  sfCurrency: string;
  proposedAmountCents: number | null;
  proposedInterval: string;
  action: Action;
  newStripePriceId: string;
}

function determineInterval(
  prices: Stripe.Price[],
  productMeta: Record<string, string>,
): string {
  const subType = (productMeta["Subscription Type"] ?? "").toLowerCase();
  const category = (productMeta["RAY Category"] ?? "").toLowerCase();

  if (
    subType.includes("one-time") ||
    subType.includes("one time") ||
    category === "hw"
  ) {
    return "one_time";
  }

  const recurringPrices = prices.filter((p) => p.recurring && p.active);
  if (recurringPrices.length > 0) {
    const intervals = new Map<string, number>();
    for (const p of recurringPrices) {
      const iv = p.recurring!.interval;
      intervals.set(iv, (intervals.get(iv) ?? 0) + 1);
    }
    let best = "month";
    let bestCount = 0;
    for (const [iv, cnt] of intervals) {
      if (cnt > bestCount) {
        best = iv;
        bestCount = cnt;
      }
    }
    return best;
  }

  const oneTimePrices = prices.filter(
    (p) => !p.recurring && p.active && p.unit_amount != null,
  );
  if (oneTimePrices.length > 0) return "one_time";

  return "month";
}

function hasMatchingStandardPrice(
  prices: Stripe.Price[],
  sfUnitPrice: number,
): boolean {
  const sfAmountCents = Math.round(sfUnitPrice * 100);
  return prices.some(
    (p) => p.active && p.unit_amount != null && p.unit_amount === sfAmountCents,
  );
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    process.stderr.write("STRIPE_SECRET_KEY is not set.\n");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  process.stderr.write(
    EXECUTE
      ? "=== EXECUTE MODE — prices will be created in Stripe ===\n\n"
      : "=== DRY RUN — no changes will be made ===\n\n",
  );

  process.stderr.write("Fetching Stripe products...\n");
  const stripeProducts = await paginateProducts(stripe);
  process.stderr.write(`  Found ${stripeProducts.length} active products\n`);

  process.stderr.write("Fetching Stripe prices per product...\n");
  const stripePriceMap = new Map<string, Stripe.Price[]>();
  let fetchCount = 0;
  for (const prod of stripeProducts) {
    const prices = await paginatePrices(stripe, prod.id);
    stripePriceMap.set(prod.id, prices);
    fetchCount++;
    if (fetchCount % 20 === 0)
      process.stderr.write(`  ${fetchCount}/${stripeProducts.length}\n`);
  }
  process.stderr.write(`  Done (${fetchCount} products)\n`);

  process.stderr.write("Fetching Salesforce products...\n");
  const sfProducts = await soql<SFProd>(
    "SELECT Id, Name, ProductCode, IsActive, Stripe_Product_ID__c, Stripe_Price_ID__c FROM Product2 WHERE IsActive = true ORDER BY Name LIMIT 2000",
  );
  process.stderr.write(`  Found ${sfProducts.length} active SF products\n`);

  process.stderr.write("Fetching Salesforce pricebook entries...\n");
  const sfPbes = await soql<SFPbe>(
    "SELECT Id, Product2Id, UnitPrice, IsActive, Pricebook2.Name, CurrencyIsoCode FROM PricebookEntry WHERE IsActive = true ORDER BY Product2Id, UnitPrice LIMIT 5000",
  );
  process.stderr.write(`  Found ${sfPbes.length} active pricebook entries\n`);

  const stdPbeByProduct = new Map<string, SFPbe>();
  for (const e of sfPbes) {
    if (
      e.Pricebook2.Name === "Standard Price Book" ||
      e.Pricebook2.Name === "Standard"
    ) {
      if (!stdPbeByProduct.has(e.Product2Id)) {
        stdPbeByProduct.set(e.Product2Id, e);
      }
    }
  }

  const allPbeByProduct = new Map<string, SFPbe[]>();
  for (const e of sfPbes) {
    const arr = allPbeByProduct.get(e.Product2Id) ?? [];
    arr.push(e);
    allPbeByProduct.set(e.Product2Id, arr);
  }

  const sfById = new Map<string, SFProd>();
  for (const p of sfProducts) sfById.set(p.Id, p);

  const sfByStripeId = new Map<string, SFProd>();
  for (const p of sfProducts) {
    if (p.Stripe_Product_ID__c) sfByStripeId.set(p.Stripe_Product_ID__c, p);
  }

  const plan: PlanRow[] = [];
  let createCount = 0;
  let skipStandard = 0;
  let skipNoSf = 0;
  let skipNoPrice = 0;
  let skipZero = 0;

  for (const sp of stripeProducts) {
    const sfIdFromMeta = getSfIdFromMeta(sp.metadata);
    const sfProd = sfIdFromMeta
      ? sfById.get(sfIdFromMeta)
      : sfByStripeId.get(sp.id);

    const prices = stripePriceMap.get(sp.id) ?? [];
    const activePricesWithAmount = prices.filter(
      (p) => p.active && p.unit_amount != null,
    );

    if (!sfProd) {
      plan.push({
        stripeProductId: sp.id,
        productName: sp.name,
        existingPriceCount: activePricesWithAmount.length,
        hasStandardPrice: false,
        sfProductId: "",
        sfProductName: "",
        sfStandardPrice: null,
        sfCurrency: "",
        proposedAmountCents: null,
        proposedInterval: "",
        action: "SKIP_NO_SF_MATCH",
        newStripePriceId: "",
      });
      skipNoSf++;
      continue;
    }

    const stdPbe = stdPbeByProduct.get(sfProd.Id);
    const fallbackPbe = !stdPbe
      ? (allPbeByProduct.get(sfProd.Id) ?? [])[0]
      : null;
    const pbe = stdPbe ?? fallbackPbe;

    if (!pbe) {
      plan.push({
        stripeProductId: sp.id,
        productName: sp.name,
        existingPriceCount: activePricesWithAmount.length,
        hasStandardPrice: false,
        sfProductId: sfProd.Id,
        sfProductName: sfProd.Name,
        sfStandardPrice: null,
        sfCurrency: "",
        proposedAmountCents: null,
        proposedInterval: "",
        action: "SKIP_NO_SF_PRICE",
        newStripePriceId: "",
      });
      skipNoPrice++;
      continue;
    }

    const sfUnitPrice = pbe.UnitPrice;
    const sfAmountCents = Math.round(sfUnitPrice * 100);
    const sfCurrency = (pbe.CurrencyIsoCode ?? "usd").toLowerCase();

    if (sfAmountCents === 0) {
      plan.push({
        stripeProductId: sp.id,
        productName: sp.name,
        existingPriceCount: activePricesWithAmount.length,
        hasStandardPrice: false,
        sfProductId: sfProd.Id,
        sfProductName: sfProd.Name,
        sfStandardPrice: sfUnitPrice,
        sfCurrency,
        proposedAmountCents: 0,
        proposedInterval: "",
        action: "SKIP_ZERO_PRICE",
        newStripePriceId: "",
      });
      skipZero++;
      continue;
    }

    if (hasMatchingStandardPrice(prices, sfUnitPrice)) {
      plan.push({
        stripeProductId: sp.id,
        productName: sp.name,
        existingPriceCount: activePricesWithAmount.length,
        hasStandardPrice: true,
        sfProductId: sfProd.Id,
        sfProductName: sfProd.Name,
        sfStandardPrice: sfUnitPrice,
        sfCurrency,
        proposedAmountCents: sfAmountCents,
        proposedInterval: "",
        action: "SKIP_HAS_STANDARD",
        newStripePriceId: "",
      });
      skipStandard++;
      continue;
    }

    const interval = determineInterval(prices, sp.metadata);

    plan.push({
      stripeProductId: sp.id,
      productName: sp.name,
      existingPriceCount: activePricesWithAmount.length,
      hasStandardPrice: false,
      sfProductId: sfProd.Id,
      sfProductName: sfProd.Name,
      sfStandardPrice: sfUnitPrice,
      sfCurrency,
      proposedAmountCents: sfAmountCents,
      proposedInterval: interval,
      action: "CREATE",
      newStripePriceId: "",
    });
    createCount++;
  }

  process.stderr.write(`\n--- Summary ---\n`);
  process.stderr.write(`  CREATE:             ${createCount}\n`);
  process.stderr.write(`  SKIP_HAS_STANDARD:  ${skipStandard}\n`);
  process.stderr.write(`  SKIP_NO_SF_MATCH:   ${skipNoSf}\n`);
  process.stderr.write(`  SKIP_NO_SF_PRICE:   ${skipNoPrice}\n`);
  process.stderr.write(`  SKIP_ZERO_PRICE:    ${skipZero}\n`);
  process.stderr.write(`  Total:              ${plan.length}\n\n`);

  if (EXECUTE && createCount > 0) {
    process.stderr.write(`Creating ${createCount} prices in Stripe...\n`);
    let done = 0;
    for (const row of plan) {
      if (row.action !== "CREATE" || !row.proposedAmountCents) continue;

      try {
        const priceParams: Stripe.PriceCreateParams = {
          product: row.stripeProductId,
          unit_amount: row.proposedAmountCents,
          currency: row.sfCurrency,
          metadata: {
            source: "backfill_standard_price",
            sf_product_id: row.sfProductId,
            sf_unit_price: String(row.sfStandardPrice),
          },
        };

        if (row.proposedInterval !== "one_time") {
          priceParams.recurring = {
            interval: row.proposedInterval as Stripe.PriceCreateParams.Recurring.Interval,
          };
        }

        const newPrice = await stripe.prices.create(priceParams);
        row.newStripePriceId = newPrice.id;
        done++;

        if (done % 10 === 0)
          process.stderr.write(`  ${done}/${createCount}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        row.newStripePriceId = `ERROR: ${msg}`;
        process.stderr.write(
          `  ERROR creating price for ${row.stripeProductId}: ${msg}\n`,
        );
      }
    }
    process.stderr.write(`  Done — ${done} prices created\n\n`);
  }

  const header = [
    "Stripe Product ID",
    "Product Name",
    "Existing Price Count",
    "Has Standard Price",
    "SF Product ID",
    "SF Product Name",
    "SF Standard Price (USD)",
    "Proposed Amount (cents)",
    "Proposed Interval",
    "Currency",
    "Action",
    "New Stripe Price ID",
  ];

  process.stdout.write(header.map(csvEscape).join(",") + "\n");
  for (const row of plan) {
    process.stdout.write(
      [
        row.stripeProductId,
        row.productName,
        String(row.existingPriceCount),
        row.hasStandardPrice ? "yes" : "no",
        row.sfProductId,
        row.sfProductName,
        row.sfStandardPrice != null ? row.sfStandardPrice.toFixed(2) : "",
        row.proposedAmountCents != null
          ? String(row.proposedAmountCents)
          : "",
        row.proposedInterval,
        row.sfCurrency,
        row.action,
        row.newStripePriceId,
      ]
        .map(csvEscape)
        .join(",") + "\n",
    );
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
