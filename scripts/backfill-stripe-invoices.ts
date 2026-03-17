/**
 * Backfill script: Stripe invoices → local mirror table.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-stripe-invoices.ts
 *   npx tsx scripts/backfill-stripe-invoices.ts --since 2025-01-01
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
  console.log("\n--- Backfilling Stripe invoices ---");
  if (sinceDate) {
    console.log(`  Filtering: created after ${sinceDate.toISOString()}`);
  }

  let count = 0;
  let errors = 0;

  const params: Stripe.InvoiceListParams = { limit: 100 };
  if (sinceDate) {
    params.created = { gte: Math.floor(sinceDate.getTime() / 1000) };
  }

  for await (const invoice of stripe.invoices.list(params)) {
    try {
      const customerId = resolveId(invoice.customer);
      if (!customerId) continue;

      // Ensure parent customer exists in mirror
      const customerExists = await prisma.stripeCustomer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customerExists) {
        continue;
      }

      const data = {
        customerId,
        subscriptionId: resolveId(invoice.subscription),
        number: invoice.number ?? null,
        status: invoice.status ?? null,
        currency: invoice.currency ?? "usd",
        amountDue: invoice.amount_due ?? 0,
        amountPaid: invoice.amount_paid ?? 0,
        amountRemaining: invoice.amount_remaining ?? 0,
        subtotal: invoice.subtotal ?? 0,
        total: invoice.total ?? 0,
        tax: invoice.tax ?? null,
        dueDate: invoice.due_date ? epochToDate(invoice.due_date) : null,
        paidAt: invoice.status_transitions?.paid_at
          ? epochToDate(invoice.status_transitions.paid_at)
          : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
        billingReason: invoice.billing_reason ?? null,
        collectionMethod: invoice.collection_method ?? null,
        periodStart: invoice.period_start
          ? epochToDate(invoice.period_start)
          : null,
        periodEnd: invoice.period_end
          ? epochToDate(invoice.period_end)
          : null,
        metadata: invoice.metadata ?? {},
        raw: invoice as any,
        syncedAt: new Date(),
      };

      await prisma.stripeInvoice.upsert({
        where: { id: invoice.id },
        create: {
          id: invoice.id,
          ...data,
          stripeCreated: epochToDate(invoice.created),
        },
        update: data,
      });

      count++;
      if (count % 100 === 0) console.log(`  ...${count} invoices`);
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error on ${invoice.id}:`, (err as Error).message);
      }
    }
  }

  console.log(`Invoices done: ${count} synced, ${errors} errors`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
