import { soql } from "../packages/integrations/salesforce/src/index.ts";
import Stripe from "stripe";

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
  Family: string | null;
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

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  process.stderr.write("Fetching Stripe products...\n");
  const stripeProducts = await paginateProducts(stripe);
  process.stderr.write(`  Found ${stripeProducts.length} active Stripe products\n`);

  process.stderr.write("Fetching Stripe prices for each product...\n");
  const stripePriceMap = new Map<string, Stripe.Price[]>();
  let count = 0;
  for (const prod of stripeProducts) {
    const prices = await paginatePrices(stripe, prod.id);
    stripePriceMap.set(prod.id, prices);
    count++;
    if (count % 20 === 0)
      process.stderr.write(`  ${count}/${stripeProducts.length}\n`);
  }
  process.stderr.write("  Done fetching prices\n");

  process.stderr.write("Fetching Salesforce products...\n");
  const sfProducts = await soql<SFProd>(
    "SELECT Id, Name, ProductCode, IsActive, Family, Stripe_Product_ID__c, Stripe_Price_ID__c FROM Product2 ORDER BY Name LIMIT 2000",
  );
  process.stderr.write(`  Found ${sfProducts.length} Salesforce products\n`);

  const sfPbes = await soql<SFPbe>(
    "SELECT Id, Product2Id, UnitPrice, IsActive, Pricebook2.Name, CurrencyIsoCode FROM PricebookEntry ORDER BY Product2Id, UnitPrice LIMIT 5000",
  );
  process.stderr.write(`  Found ${sfPbes.length} pricebook entries\n`);

  const pbeByProduct = new Map<string, SFPbe[]>();
  for (const e of sfPbes) {
    const arr = pbeByProduct.get(e.Product2Id) ?? [];
    arr.push(e);
    pbeByProduct.set(e.Product2Id, arr);
  }

  const sfById = new Map<string, SFProd>();
  for (const p of sfProducts) sfById.set(p.Id, p);

  const sfByStripeId = new Map<string, SFProd>();
  for (const p of sfProducts) {
    if (p.Stripe_Product_ID__c) sfByStripeId.set(p.Stripe_Product_ID__c, p);
  }

  const matchedSfIds = new Set<string>();

  const header = [
    "Stripe Product ID",
    "Stripe Product Name",
    "Stripe Active",
    "Stripe Default Price",
    "Stripe Prices (ID | Amount | Currency | Interval | Active)",
    "SF Product ID (from Stripe metadata)",
    "SF Product ID",
    "SF Product Name",
    "SF Product Code",
    "SF Active",
    "SF Family",
    "SF Stripe_Product_ID__c",
    "SF Stripe_Price_ID__c",
    "SF Pricebook Entries (Pricebook | Price | Active)",
  ];
  const rows: string[][] = [];

  for (const sp of stripeProducts) {
    const sfIdFromMeta = getSfIdFromMeta(sp.metadata);
    const sfProd = sfIdFromMeta
      ? sfById.get(sfIdFromMeta)
      : sfByStripeId.get(sp.id);
    if (sfProd) matchedSfIds.add(sfProd.Id);

    const prices = stripePriceMap.get(sp.id) ?? [];
    const priceList = prices
      .map((p) => {
        const amt =
          p.unit_amount != null
            ? (p.unit_amount / 100).toFixed(2)
            : "usage-based";
        const interval = p.recurring ? p.recurring.interval : "one-time";
        return `${p.id} | ${amt} | ${p.currency} | ${interval} | ${p.active}`;
      })
      .join(" ;; ");

    const pbes = sfProd ? pbeByProduct.get(sfProd.Id) ?? [] : [];
    const pbeList = pbes
      .map(
        (e) =>
          `${e.Pricebook2.Name} | ${e.UnitPrice.toFixed(2)} | ${e.IsActive}`,
      )
      .join(" ;; ");

    rows.push([
      sp.id,
      sp.name,
      String(sp.active),
      sp.default_price
        ? typeof sp.default_price === "string"
          ? sp.default_price
          : sp.default_price.id
        : "",
      priceList,
      sfIdFromMeta,
      sfProd?.Id ?? "",
      sfProd?.Name ?? "",
      sfProd?.ProductCode ?? "",
      sfProd ? String(sfProd.IsActive) : "",
      sfProd?.Family ?? "",
      sfProd?.Stripe_Product_ID__c ?? "",
      sfProd?.Stripe_Price_ID__c ?? "",
      pbeList,
    ]);
  }

  for (const sfp of sfProducts) {
    if (matchedSfIds.has(sfp.Id)) continue;
    const pbes = pbeByProduct.get(sfp.Id) ?? [];
    const pbeList = pbes
      .map(
        (e) =>
          `${e.Pricebook2.Name} | ${e.UnitPrice.toFixed(2)} | ${e.IsActive}`,
      )
      .join(" ;; ");

    rows.push([
      sfp.Stripe_Product_ID__c ?? "",
      "",
      "",
      "",
      "",
      "",
      sfp.Id,
      sfp.Name,
      sfp.ProductCode ?? "",
      String(sfp.IsActive),
      sfp.Family ?? "",
      sfp.Stripe_Product_ID__c ?? "",
      sfp.Stripe_Price_ID__c ?? "",
      pbeList,
    ]);
  }

  process.stdout.write(header.map(csvEscape).join(",") + "\n");
  for (const row of rows) {
    process.stdout.write(row.map(csvEscape).join(",") + "\n");
  }

  process.stderr.write(
    `\nTotal rows: ${rows.length} (${stripeProducts.length} Stripe + ${sfProducts.length - matchedSfIds.size} unmatched SF)\n`,
  );
  process.stderr.write(
    `Matched: ${matchedSfIds.size} products linked between Stripe <-> SF\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
