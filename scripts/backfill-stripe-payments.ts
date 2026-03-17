/**
 * Backfill script: Stripe payment intents → local mirror table.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-stripe-payments.ts
 *   npx tsx scripts/backfill-stripe-payments.ts --since 2025-01-01
 *
 * Requires: DATABASE_URL and STRIPE_SECRET_KEY in env.
 */

import Stripe from "stripe";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as any,
});

const prisma = new PrismaClient();

const sinceIdx = process.argv.indexOf("--since");
const sinceDate =
  sinceIdx !== -1 ? new Date(process.argv[sinceIdx + 1]) : null;

function epochToDate(epoch: number): Date {
  return new Date(epoch * 1000);
}

function resolveId(
  obj: string | { id: string } | null | undefined,
): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  return obj.id ?? null;
}

async function main() {
  console.log("\n--- Backfilling Stripe payment intents ---");
  if (sinceDate) {
    console.log(`  Filtering: created after ${sinceDate.toISOString()}`);
  }

  let count = 0;
  let errors = 0;

  const params: Stripe.PaymentIntentListParams = { limit: 100 };
  if (sinceDate) {
    params.created = { gte: Math.floor(sinceDate.getTime() / 1000) };
  }

  for await (const pi of stripe.paymentIntents.list(params)) {
    try {
      const customerId = resolveId(pi.customer);
      if (!customerId) continue;

      // Ensure parent customer exists in mirror
      const customerExists = await prisma.stripeCustomer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customerExists) continue;

      // Extract card details from latest_charge if available
      let cardBrand: string | null = null;
      let cardLast4: string | null = null;
      let receiptUrl: string | null = null;

      if (pi.latest_charge && typeof pi.latest_charge === "object") {
        const charge = pi.latest_charge as Stripe.Charge;
        if (charge.payment_method_details?.card) {
          cardBrand = charge.payment_method_details.card.brand ?? null;
          cardLast4 = charge.payment_method_details.card.last4 ?? null;
        }
        receiptUrl = charge.receipt_url ?? null;
      }

      const data = {
        customerId,
        invoiceId: resolveId(pi.invoice),
        amount: pi.amount ?? 0,
        amountReceived: pi.amount_received ?? 0,
        currency: pi.currency ?? "usd",
        status: pi.status,
        description: pi.description ?? null,
        paymentMethodId: resolveId(pi.payment_method),
        cardBrand,
        cardLast4,
        receiptUrl,
        metadata: pi.metadata ?? {},
        raw: pi as any,
        syncedAt: new Date(),
      };

      await prisma.stripePayment.upsert({
        where: { id: pi.id },
        create: {
          id: pi.id,
          ...data,
          stripeCreated: epochToDate(pi.created),
        },
        update: data,
      });

      count++;
      if (count % 100 === 0) console.log(`  ...${count} payments`);
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error on ${pi.id}:`, (err as Error).message);
      }
    }
  }

  console.log(`Payments done: ${count} synced, ${errors} errors`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
