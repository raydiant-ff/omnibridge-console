/**
 * Backfill script: Stripe customers, products, and prices → local mirror tables.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-stripe-mirror.ts
 *   npx tsx scripts/backfill-stripe-mirror.ts --only customers
 *   npx tsx scripts/backfill-stripe-mirror.ts --only products
 *
 * Requires: DATABASE_URL and STRIPE_SECRET_KEY in env.
 */

import Stripe from "stripe";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as any,
});

const prisma = new PrismaClient();

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

async function main() {
  try {
    if (!only || only === "customers") {
      await backfillCustomers();
    }
    if (!only || only === "products") {
      await backfillProducts();
      await backfillPrices();
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function backfillCustomers() {
  console.log("\n--- Backfilling Stripe customers ---");
  let count = 0;
  let errors = 0;

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if ((customer as any).deleted) continue;
    try {
      const sfAccountId =
        customer.metadata?.salesforce_account_id ??
        customer.metadata?.sf_account_id ??
        null;

      const rawPm =
        (customer as any).default_payment_method ??
        customer.invoice_settings?.default_payment_method ??
        null;
      const defaultPm =
        typeof rawPm === "string" ? rawPm : rawPm?.id ?? null;

      const data = {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        description: customer.description,
        currency: customer.currency,
        balance: customer.balance ?? 0,
        delinquent: customer.delinquent ?? false,
        defaultPaymentMethod: defaultPm,
        sfAccountId,
        metadata: customer.metadata ?? {},
        raw: customer as any,
        syncedAt: new Date(),
      };

      await prisma.stripeCustomer.upsert({
        where: { id: customer.id },
        create: {
          id: customer.id,
          ...data,
          stripeCreated: new Date(customer.created * 1000),
        },
        update: data,
      });
      count++;
      if (count % 50 === 0) console.log(`  ...${count} customers`);
    } catch (err) {
      errors++;
      console.error(`  Error on ${customer.id}:`, err);
    }
  }
  console.log(`Customers done: ${count} synced, ${errors} errors`);
}

async function backfillProducts() {
  console.log("\n--- Backfilling Stripe products ---");
  let count = 0;
  let errors = 0;

  for await (const product of stripe.products.list({ limit: 100 })) {
    try {
      const sfProductId =
        product.metadata?.salesforce_product_id ??
        product.metadata?.sf_product_id ??
        null;

      const data = {
        name: product.name,
        description: product.description,
        active: product.active,
        defaultPriceId:
          typeof product.default_price === "string"
            ? product.default_price
            : (product.default_price as any)?.id ?? null,
        sfProductId,
        metadata: product.metadata ?? {},
        raw: product as any,
        syncedAt: new Date(),
      };

      await prisma.stripeProduct.upsert({
        where: { id: product.id },
        create: { id: product.id, ...data },
        update: data,
      });
      count++;
    } catch (err) {
      errors++;
      console.error(`  Error on ${product.id}:`, err);
    }
  }
  console.log(`Products done: ${count} synced, ${errors} errors`);
}

async function backfillPrices() {
  console.log("\n--- Backfilling Stripe prices ---");
  let count = 0;
  let errors = 0;

  for await (const price of stripe.prices.list({ limit: 100, expand: ["data.product"] })) {
    try {
      const productId =
        typeof price.product === "string"
          ? price.product
          : (price.product as any)?.id ?? "unknown";

      // Skip if parent product doesn't exist in mirror
      const productExists = await prisma.stripeProduct.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!productExists) {
        console.log(`  Skipping price ${price.id} — product ${productId} not in mirror`);
        continue;
      }

      const data = {
        productId,
        active: price.active,
        currency: price.currency,
        unitAmount: price.unit_amount,
        billingScheme: price.billing_scheme,
        recurringInterval: price.recurring?.interval ?? null,
        recurringIntervalCount: price.recurring?.interval_count ?? 1,
        type: price.type,
        nickname: price.nickname,
        metadata: price.metadata ?? {},
        raw: price as any,
        syncedAt: new Date(),
      };

      await prisma.stripePrice.upsert({
        where: { id: price.id },
        create: { id: price.id, ...data },
        update: data,
      });
      count++;
      if (count % 100 === 0) console.log(`  ...${count} prices`);
    } catch (err) {
      errors++;
      console.error(`  Error on ${price.id}:`, err);
    }
  }
  console.log(`Prices done: ${count} synced, ${errors} errors`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
