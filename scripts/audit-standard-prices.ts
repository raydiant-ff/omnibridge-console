/**
 * Audit & Fix Standard Prices for Stripe Products
 *
 * Checks all active Stripe products and ensures:
 *   1. Standard price recurrence matches product metadata (Subscription Type)
 *   2. Recurring products have BOTH a monthly and annual standard price
 *   3. One-time products have a one-time standard price
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/audit-standard-prices.ts                          # dry run
 *   npx tsx scripts/audit-standard-prices.ts --execute                # apply fixes
 */

import Stripe from "stripe";
import { soql } from "../packages/integrations/salesforce/src/index.ts";

const EXECUTE = process.argv.includes("--execute");

function log(msg: string) {
  process.stderr.write(msg + "\n");
}

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
      active: true,
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all;
}

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

interface SFProd {
  Id: string;
  Name: string;
  Stripe_Product_ID__c: string | null;
}

interface SFPbe {
  Id: string;
  Product2Id: string;
  UnitPrice: number;
  IsActive: boolean;
  Pricebook2: { Name: string };
  CurrencyIsoCode?: string;
}

interface AuditRow {
  productId: string;
  productName: string;
  subscriptionType: string;
  expectedType: string;
  hasMonthly: boolean;
  hasAnnual: boolean;
  hasOneTime: boolean;
  sfMatch: string;
  sfPrice: string;
  issues: string[];
  actions: string[];
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    log("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  log(EXECUTE ? "=== EXECUTE MODE ===" : "=== DRY RUN ===");
  log("");

  log("Fetching all active Stripe products...");
  const products = await paginateProducts(stripe);
  log(`  Found ${products.length} active products`);

  log("Fetching Salesforce products...");
  const sfProducts = await soql<SFProd>(
    "SELECT Id, Name, Stripe_Product_ID__c FROM Product2 WHERE IsActive = true ORDER BY Name LIMIT 2000",
  );
  log(`  Found ${sfProducts.length} active SF products`);

  log("Fetching Salesforce pricebook entries...");
  const sfPbes = await soql<SFPbe>(
    "SELECT Id, Product2Id, UnitPrice, IsActive, Pricebook2.Name, CurrencyIsoCode FROM PricebookEntry WHERE IsActive = true ORDER BY Product2Id LIMIT 5000",
  );
  log(`  Found ${sfPbes.length} active pricebook entries`);

  const sfById = new Map<string, SFProd>();
  for (const p of sfProducts) sfById.set(p.Id, p);
  const sfByStripeId = new Map<string, SFProd>();
  for (const p of sfProducts) {
    if (p.Stripe_Product_ID__c) sfByStripeId.set(p.Stripe_Product_ID__c, p);
  }

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

  const rows: AuditRow[] = [];
  let totalIssues = 0;
  let totalActions = 0;
  let processed = 0;

  for (const prod of products) {
    processed++;
    if (processed % 20 === 0) log(`  Processing ${processed}/${products.length}...`);

    const prices = await paginatePrices(stripe, prod.id);
    const backfilled = prices.filter(
      (p) => p.metadata?.source === "backfill_standard_price",
    );

    const shouldRecur = expectedRecurring(prod.metadata);
    const subType = prod.metadata["Subscription Type"] ?? "(none)";
    const expectedType =
      shouldRecur === true
        ? "recurring"
        : shouldRecur === false
          ? "one-time"
          : "unknown";

    const monthlyStd = backfilled.find(
      (p) => p.recurring?.interval === "month" && p.recurring?.interval_count === 1,
    );
    const annualStd = backfilled.find(
      (p) => p.recurring?.interval === "year" && p.recurring?.interval_count === 1,
    );
    const oneTimeStd = backfilled.find((p) => !p.recurring);

    const sfIdFromMeta = getSfIdFromMeta(prod.metadata);
    const sfProd = sfIdFromMeta
      ? sfById.get(sfIdFromMeta)
      : sfByStripeId.get(prod.id);
    const pbe = sfProd
      ? (stdPbeByProduct.get(sfProd.Id) ??
        (allPbeByProduct.get(sfProd.Id) ?? [])[0])
      : null;
    const sfMonthlyAmountCents = pbe ? Math.round(pbe.UnitPrice * 100) : null;

    const issues: string[] = [];
    const actions: string[] = [];

    if (shouldRecur === true) {
      if (oneTimeStd) {
        issues.push(`Has one-time backfill (${oneTimeStd.id}) but should be recurring`);
        actions.push(`DEACTIVATE ${oneTimeStd.id} (wrong type)`);
      }

      if (!annualStd) {
        const monthlyCents =
          sfMonthlyAmountCents ??
          monthlyStd?.unit_amount ??
          null;

        if (monthlyCents != null && monthlyCents > 0) {
          const annualAmount = monthlyCents * 12;
          const source = sfMonthlyAmountCents != null ? "SF" : "backfill";

          issues.push("Missing annual standard price");
          actions.push(
            `CREATE annual price: $${(annualAmount / 100).toFixed(2)}/year (from ${source} $${(monthlyCents / 100).toFixed(2)}/mo × 12)`,
          );

          if (EXECUTE) {
            try {
              const newPrice = await stripe.prices.create({
                product: prod.id,
                unit_amount: annualAmount,
                currency: "usd",
                recurring: { interval: "year" },
                metadata: {
                  source: "backfill_standard_price",
                  created_by: "audit-standard-prices",
                },
              });
              actions[actions.length - 1] += ` → ${newPrice.id}`;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              actions[actions.length - 1] += ` → ERROR: ${msg}`;
            }
          }
        } else {
          issues.push("Missing annual standard price (no SF or backfill reference)");
        }
      }

      if (!monthlyStd) {
        const monthlyCents =
          sfMonthlyAmountCents ??
          (annualStd?.unit_amount != null
            ? Math.round(annualStd.unit_amount / 12)
            : null);

        if (monthlyCents != null && monthlyCents > 0) {
          const source = sfMonthlyAmountCents != null ? "SF" : "annual÷12";

          issues.push("Missing monthly standard price");
          actions.push(
            `CREATE monthly price: $${(monthlyCents / 100).toFixed(2)}/month (from ${source})`,
          );

          if (EXECUTE) {
            try {
              const newPrice = await stripe.prices.create({
                product: prod.id,
                unit_amount: monthlyCents,
                currency: "usd",
                recurring: { interval: "month" },
                metadata: {
                  source: "backfill_standard_price",
                  created_by: "audit-standard-prices",
                },
              });
              actions[actions.length - 1] += ` → ${newPrice.id}`;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              actions[actions.length - 1] += ` → ERROR: ${msg}`;
            }
          }
        } else {
          issues.push(
            "Missing monthly standard price (no SF or backfill reference)",
          );
        }
      }

      if (oneTimeStd && EXECUTE) {
        try {
          await stripe.prices.update(oneTimeStd.id, { active: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`  ERROR deactivating ${oneTimeStd.id}: ${msg}`);
        }
      }
    } else if (shouldRecur === false) {
      if (monthlyStd) {
        issues.push(
          `Has monthly backfill (${monthlyStd.id}) but should be one-time`,
        );
        actions.push(`DEACTIVATE ${monthlyStd.id} (wrong type)`);
        if (EXECUTE) {
          try {
            await stripe.prices.update(monthlyStd.id, { active: false });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`  ERROR deactivating ${monthlyStd.id}: ${msg}`);
          }
        }
      }
      if (annualStd) {
        issues.push(
          `Has annual backfill (${annualStd.id}) but should be one-time`,
        );
        actions.push(`DEACTIVATE ${annualStd.id} (wrong type)`);
        if (EXECUTE) {
          try {
            await stripe.prices.update(annualStd.id, { active: false });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`  ERROR deactivating ${annualStd.id}: ${msg}`);
          }
        }
      }

      if (!oneTimeStd) {
        const refCents =
          sfMonthlyAmountCents ??
          monthlyStd?.unit_amount ??
          annualStd?.unit_amount ??
          prices.find((p) => !p.recurring && p.unit_amount != null)
            ?.unit_amount ??
          null;

        if (refCents != null && refCents > 0) {
          const source = sfMonthlyAmountCents != null ? "SF" : "existing";

          issues.push("Missing one-time standard price");
          actions.push(
            `CREATE one-time price: $${(refCents / 100).toFixed(2)} (from ${source})`,
          );
          if (EXECUTE) {
            try {
              const newPrice = await stripe.prices.create({
                product: prod.id,
                unit_amount: refCents,
                currency: "usd",
                metadata: {
                  source: "backfill_standard_price",
                  created_by: "audit-standard-prices",
                },
              });
              actions[actions.length - 1] += ` → ${newPrice.id}`;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              actions[actions.length - 1] += ` → ERROR: ${msg}`;
            }
          }
        } else {
          issues.push(
            "Missing one-time standard price (no SF or existing reference)",
          );
        }
      }
    }

    if (issues.length > 0) {
      totalIssues += issues.length;
      totalActions += actions.length;
    }

    rows.push({
      productId: prod.id,
      productName: prod.name,
      subscriptionType: subType,
      expectedType,
      hasMonthly: !!monthlyStd,
      hasAnnual: !!annualStd,
      hasOneTime: !!oneTimeStd,
      sfMatch: sfProd ? sfProd.Name : "",
      sfPrice: sfMonthlyAmountCents != null ? `$${(sfMonthlyAmountCents / 100).toFixed(2)}` : "",
      issues,
      actions,
    });
  }

  log("");
  log("=== AUDIT RESULTS ===");
  log(`  Total products: ${rows.length}`);
  log(
    `  Recurring: ${rows.filter((r) => r.expectedType === "recurring").length}`,
  );
  log(
    `  One-time:  ${rows.filter((r) => r.expectedType === "one-time").length}`,
  );
  log(
    `  Unknown:   ${rows.filter((r) => r.expectedType === "unknown").length}`,
  );
  log(`  Issues found: ${totalIssues}`);
  log(`  Actions ${EXECUTE ? "taken" : "proposed"}: ${totalActions}`);
  log("");

  const issueRows = rows.filter((r) => r.issues.length > 0);
  if (issueRows.length > 0) {
    log("=== PRODUCTS WITH ISSUES ===");
    for (const row of issueRows) {
      log(`\n  ${row.productName} (${row.productId})`);
      log(`    Subscription Type: ${row.subscriptionType} → ${row.expectedType}`);
      log(
        `    Standard prices: ${[row.hasMonthly ? "monthly ✓" : "", row.hasAnnual ? "annual ✓" : "", row.hasOneTime ? "one-time ✓" : ""].filter(Boolean).join(", ") || "none"}`,
      );
      if (row.sfMatch)
        log(`    SF Match: ${row.sfMatch} @ ${row.sfPrice}/mo`);
      else
        log(`    SF Match: (none)`);
      for (const issue of row.issues) log(`    ⚠ ${issue}`);
      for (const action of row.actions) log(`    → ${action}`);
    }
  }

  const cleanRows = rows.filter(
    (r) => r.issues.length === 0 && r.expectedType !== "unknown",
  );
  log(`\n=== CLEAN PRODUCTS: ${cleanRows.length} ===`);

  const unknownRows = rows.filter((r) => r.expectedType === "unknown");
  if (unknownRows.length > 0) {
    log(`\n=== PRODUCTS WITH NO SUBSCRIPTION TYPE METADATA: ${unknownRows.length} ===`);
    for (const row of unknownRows) {
      log(`  ${row.productName} (${row.productId})`);
    }
  }

  // CSV output
  const header = [
    "Product ID",
    "Product Name",
    "Subscription Type",
    "Expected",
    "Has Monthly",
    "Has Annual",
    "Has One-Time",
    "Issues",
    "Actions",
  ];

  process.stdout.write(header.join(",") + "\n");
  for (const row of rows) {
    const escape = (s: string) =>
      s.includes(",") || s.includes('"') || s.includes("\n")
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    process.stdout.write(
      [
        row.productId,
        escape(row.productName),
        escape(row.subscriptionType),
        row.expectedType,
        row.hasMonthly ? "yes" : "no",
        row.hasAnnual ? "yes" : "no",
        row.hasOneTime ? "yes" : "no",
        escape(row.issues.join("; ")),
        escape(row.actions.join("; ")),
      ].join(",") + "\n",
    );
  }
}

main().catch((err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
