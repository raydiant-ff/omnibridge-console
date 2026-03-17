/**
 * Backfill Stripe subscriptions into the local mirror tables.
 *
 * Iterates through all Stripe subscriptions (status: all) and upserts each
 * into stripe_subscriptions + stripe_subscription_items. Run once to seed
 * existing data; webhooks keep it fresh afterward.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-subscriptions.ts
 */

import Stripe from "stripe";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia" as any,
});

const prisma = new PrismaClient();

function resolveCustomerName(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return customer.id;
  const c = customer as Stripe.Customer;
  return c.name ?? c.email ?? c.id;
}

function resolveProductId(price: Stripe.Price | null | undefined): string {
  if (!price) return "unknown";
  const product = price.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) return product.id;
  return "unknown";
}

function resolveProductName(price: Stripe.Price | null | undefined): string {
  if (!price) return "Unknown";
  const product = price.product;
  if (typeof product === "object" && product !== null && "name" in product) {
    return (product as Stripe.Product).name;
  }
  return price.nickname ?? price.id ?? "Unknown";
}

function epochToDate(epoch: number): Date {
  return new Date(epoch * 1000);
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerName = resolveCustomerName(sub.customer);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.stripeSubscription.upsert({
      where: { id: sub.id },
      create: {
        id: sub.id,
        customerId,
        customerName,
        status: sub.status,
        collectionMethod: sub.collection_method ?? "charge_automatically",
        currency: sub.currency ?? "usd",
        currentPeriodStart: epochToDate(sub.current_period_start),
        currentPeriodEnd: epochToDate(sub.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt: sub.cancel_at ? epochToDate(sub.cancel_at) : null,
        canceledAt: sub.canceled_at ? epochToDate(sub.canceled_at) : null,
        trialStart: sub.trial_start ? epochToDate(sub.trial_start) : null,
        trialEnd: sub.trial_end ? epochToDate(sub.trial_end) : null,
        startDate: epochToDate(sub.start_date),
        created: epochToDate(sub.created),
        billingCycleAnchor: epochToDate(sub.billing_cycle_anchor),
        hasSchedule: !!sub.schedule,
        hasDiscount:
          (Array.isArray(sub.discounts) && sub.discounts.length > 0) ||
          !!(sub as any).discount,
        hasPaymentMethod: !!sub.default_payment_method,
        metadata: (sub.metadata as Record<string, string>) ?? {},
        syncedAt: now,
      },
      update: {
        customerId,
        customerName,
        status: sub.status,
        collectionMethod: sub.collection_method ?? "charge_automatically",
        currency: sub.currency ?? "usd",
        currentPeriodStart: epochToDate(sub.current_period_start),
        currentPeriodEnd: epochToDate(sub.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt: sub.cancel_at ? epochToDate(sub.cancel_at) : null,
        canceledAt: sub.canceled_at ? epochToDate(sub.canceled_at) : null,
        trialStart: sub.trial_start ? epochToDate(sub.trial_start) : null,
        trialEnd: sub.trial_end ? epochToDate(sub.trial_end) : null,
        startDate: epochToDate(sub.start_date),
        billingCycleAnchor: epochToDate(sub.billing_cycle_anchor),
        hasSchedule: !!sub.schedule,
        hasDiscount:
          (Array.isArray(sub.discounts) && sub.discounts.length > 0) ||
          !!(sub as any).discount,
        hasPaymentMethod: !!sub.default_payment_method,
        metadata: (sub.metadata as Record<string, string>) ?? {},
        syncedAt: now,
      },
    });

    await tx.stripeSubscriptionItem.deleteMany({
      where: { subscriptionId: sub.id },
    });

    const items = sub.items?.data ?? [];
    if (items.length > 0) {
      await tx.stripeSubscriptionItem.createMany({
        data: items.map((si) => {
          const price = si.price;
          return {
            id: si.id,
            subscriptionId: sub.id,
            productId: resolveProductId(price),
            productName: resolveProductName(price),
            priceId: price?.id ?? "unknown",
            unitAmount: price?.unit_amount ?? 0,
            currency: price?.currency ?? "usd",
            billingInterval: price?.recurring?.interval ?? null,
            intervalCount: price?.recurring?.interval_count ?? 1,
            quantity: si.quantity ?? 1,
            usageType: price?.recurring?.usage_type ?? "licensed",
            syncedAt: now,
          };
        }),
      });
    }
  });
}

const productNameCache = new Map<string, string>();

async function resolveProductNames(sub: Stripe.Subscription) {
  for (const si of sub.items?.data ?? []) {
    const product = si.price?.product;
    const pid = typeof product === "string" ? product : undefined;
    if (pid && !productNameCache.has(pid)) {
      try {
        const prod = await stripe.products.retrieve(pid);
        productNameCache.set(pid, prod.name);
      } catch {
        productNameCache.set(pid, pid);
      }
    }
    if (pid && typeof si.price?.product === "string") {
      (si.price as any).product = { id: pid, name: productNameCache.get(pid)! };
    }
  }
}

async function main() {
  console.log("Starting subscription backfill...");

  let count = 0;
  let errors = 0;

  for await (const sub of stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  })) {
    try {
      await resolveProductNames(sub);
      await upsertSubscription(sub);
      count++;
      if (count % 100 === 0) {
        console.log(`  ... ${count} subscriptions synced (${productNameCache.size} products cached)`);
      }
    } catch (err) {
      errors++;
      console.error(`  [ERROR] Failed to sync ${sub.id}:`, err);
    }
  }

  console.log(`\nBackfill complete: ${count} synced, ${errors} errors.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
