import { prisma } from "@omnibridge/db";
import type { Stripe } from "@omnibridge/stripe";

/**
 * Upsert a Stripe Subscription (and its items) into the local mirror tables.
 *
 * Accepts a full Stripe.Subscription object — ideally retrieved/expanded with
 *   expand: ["customer", "items.data.price.product"]
 *
 * Safe to call from both webhook handlers and the backfill script.
 *
 * Correlation pass:
 *   After upserting items, each item is correlated to a SfContractLine using
 *   strict precedence:
 *     1. exact_item_id  — SfContractLine.stripeSubItemId = si.id
 *     2. exact_price_id — SfContractLine.stripeSubscriptionId = sub.id AND stripePriceId = si.priceId
 *     3. heuristic      — SfContractLine.stripeSubscriptionId = sub.id AND stripeProductId = si.productId
 *   Heuristic matches are marked "candidate", not "matched".
 */
export async function upsertStripeSubscription(sub: Stripe.Subscription) {
  const customerName = resolveCustomerName(sub.customer);
  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer?.id ?? "";

  const now = new Date();
  const items = sub.items?.data ?? [];

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

    if (items.length === 0) return;

    // --- Correlation pass ---
    // Batch-fetch candidate SfContractLines before creating items so we can
    // include correlation fields in the initial createMany (avoids a second write).
    const itemIds = items.map((si) => si.id);
    const priceIds = items
      .map((si) => si.price?.id)
      .filter((id): id is string => Boolean(id) && id !== "unknown");
    const productIds = items
      .map((si) => resolveProductId(si.price))
      .filter((id) => id !== "unknown");

    const [byItemId, byPriceId, byProductId] = await Promise.all([
      tx.sfContractLine.findMany({
        where: { stripeSubItemId: { in: itemIds } },
        select: { id: true, stripeSubItemId: true },
      }),
      priceIds.length > 0
        ? tx.sfContractLine.findMany({
            where: {
              stripeSubscriptionId: sub.id,
              stripePriceId: { in: priceIds },
            },
            select: { id: true, stripePriceId: true },
          })
        : Promise.resolve([]),
      productIds.length > 0
        ? tx.sfContractLine.findMany({
            where: {
              stripeSubscriptionId: sub.id,
              stripeProductId: { in: productIds },
            },
            select: { id: true, stripeProductId: true },
          })
        : Promise.resolve([]),
    ]);

    // Build lookup maps (first-match wins for multi-line edge cases)
    const itemIdMap = new Map(
      byItemId
        .filter((l) => l.stripeSubItemId)
        .map((l) => [l.stripeSubItemId!, l.id]),
    );
    const priceIdMap = new Map(
      byPriceId
        .filter((l) => l.stripePriceId)
        .map((l) => [l.stripePriceId!, l.id]),
    );
    const productIdMap = new Map(
      byProductId
        .filter((l) => l.stripeProductId)
        .map((l) => [l.stripeProductId!, l.id]),
    );

    await tx.stripeSubscriptionItem.createMany({
      data: items.map((si) => {
        const price = si.price;
        const productId = resolveProductId(price);
        const priceId = price?.id ?? "unknown";

        // Correlation — strict precedence
        let sfContractLineId: string | null = null;
        let correlationStatus = "unmatched";
        let correlationMethod: string | null = null;

        if (itemIdMap.has(si.id)) {
          sfContractLineId = itemIdMap.get(si.id)!;
          correlationStatus = "matched";
          correlationMethod = "exact_item_id";
        } else if (priceIdMap.has(priceId)) {
          sfContractLineId = priceIdMap.get(priceId)!;
          correlationStatus = "matched";
          correlationMethod = "exact_price_id";
        } else if (productIdMap.has(productId)) {
          sfContractLineId = productIdMap.get(productId)!;
          correlationStatus = "candidate"; // heuristic — not authoritative
          correlationMethod = "heuristic";
        }

        return {
          id: si.id,
          subscriptionId: sub.id,
          customerId,
          productId,
          productName: resolveProductName(price),
          priceId,
          unitAmount: price?.unit_amount ?? 0,
          currency: price?.currency ?? "usd",
          billingInterval: price?.recurring?.interval ?? null,
          intervalCount: price?.recurring?.interval_count ?? 1,
          quantity: si.quantity ?? 1,
          usageType: price?.recurring?.usage_type ?? "licensed",
          sfContractLineId,
          correlationStatus,
          correlationMethod,
          syncedAt: now,
        };
      }),
    });
  });
}

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
