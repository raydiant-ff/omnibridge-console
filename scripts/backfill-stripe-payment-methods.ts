/**
 * Backfill script: Stripe payment methods → local mirror table.
 *
 * Iterates all StripeCustomer records from the DB, fetches their payment
 * methods from Stripe, and upserts into the local mirror.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-stripe-payment-methods.ts
 *
 * Requires: DATABASE_URL and STRIPE_SECRET_KEY in env.
 */

import Stripe from "stripe";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as any,
});

const prisma = new PrismaClient();

function epochToDate(epoch: number): Date {
  return new Date(epoch * 1000);
}

async function main() {
  console.log("\n--- Backfilling Stripe payment methods ---");

  const customers = await prisma.stripeCustomer.findMany({
    select: { id: true, defaultPaymentMethod: true },
  });

  console.log(`  Found ${customers.length} customers in mirror`);

  let totalMethods = 0;
  let errors = 0;

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];

    try {
      for await (const pm of stripe.paymentMethods.list({
        customer: customer.id,
        limit: 100,
      })) {
        try {
          const isDefault = pm.id === customer.defaultPaymentMethod;

          let cardBrand: string | null = null;
          let cardLast4: string | null = null;
          let cardExpMonth: number | null = null;
          let cardExpYear: number | null = null;
          let cardFunding: string | null = null;
          let bankName: string | null = null;
          let bankLast4: string | null = null;

          if (pm.card) {
            cardBrand = pm.card.brand ?? null;
            cardLast4 = pm.card.last4 ?? null;
            cardExpMonth = pm.card.exp_month ?? null;
            cardExpYear = pm.card.exp_year ?? null;
            cardFunding = pm.card.funding ?? null;
          }

          if (pm.us_bank_account) {
            bankName = pm.us_bank_account.bank_name ?? null;
            bankLast4 = pm.us_bank_account.last4 ?? null;
          }

          const data = {
            customerId: customer.id,
            type: pm.type,
            cardBrand,
            cardLast4,
            cardExpMonth,
            cardExpYear,
            cardFunding,
            bankName,
            bankLast4,
            isDefault,
            metadata: pm.metadata ?? {},
            raw: pm as any,
            syncedAt: new Date(),
          };

          await prisma.stripePaymentMethod.upsert({
            where: { id: pm.id },
            create: {
              id: pm.id,
              ...data,
              stripeCreated: epochToDate(pm.created),
            },
            update: data,
          });

          totalMethods++;
        } catch (err) {
          errors++;
          if (errors <= 5) {
            console.error(`  Error on PM ${pm.id}:`, (err as Error).message);
          }
        }
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(
          `  Error listing PMs for ${customer.id}:`,
          (err as Error).message,
        );
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(
        `  Progress: ${i + 1}/${customers.length} customers (${totalMethods} methods)`,
      );
    }
  }

  console.log(
    `Payment methods done: ${totalMethods} synced across ${customers.length} customers, ${errors} errors`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
