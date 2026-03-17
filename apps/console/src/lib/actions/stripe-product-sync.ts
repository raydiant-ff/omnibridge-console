import { prisma, Prisma } from "@omnibridge/db";
import type { Stripe } from "@omnibridge/stripe";

/**
 * Upsert a Stripe Product into the local mirror.
 * Safe to call from webhooks and backfill scripts.
 */
export async function upsertStripeProduct(product: Stripe.Product) {
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
        : product.default_price?.id ?? null,
    sfProductId,
    metadata: (product.metadata ?? {}) as Prisma.JsonObject,
    raw: product as unknown as Prisma.JsonObject,
    syncedAt: new Date(),
  };

  await prisma.stripeProduct.upsert({
    where: { id: product.id },
    create: { id: product.id, ...data },
    update: data,
  });
}

/**
 * Upsert a Stripe Price into the local mirror.
 * Requires the parent StripeProduct to exist — call upsertStripeProduct first.
 */
export async function upsertStripePrice(price: Stripe.Price) {
  const productId =
    typeof price.product === "string"
      ? price.product
      : (price.product as Stripe.Product)?.id ?? "unknown";

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
    metadata: (price.metadata ?? {}) as Prisma.JsonObject,
    raw: price as unknown as Prisma.JsonObject,
    syncedAt: new Date(),
  };

  await prisma.stripePrice.upsert({
    where: { id: price.id },
    create: { id: price.id, ...data },
    update: data,
  });
}
