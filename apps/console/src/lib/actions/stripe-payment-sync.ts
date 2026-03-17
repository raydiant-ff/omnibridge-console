import { prisma, Prisma } from "@omnibridge/db";
import type { Stripe } from "@omnibridge/stripe";

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

/**
 * Upsert a Stripe PaymentIntent into the local mirror.
 * Safe to call from webhooks and backfill scripts.
 */
export async function upsertStripePayment(pi: Stripe.PaymentIntent) {
  const customerId = resolveId(pi.customer);
  if (!customerId) return;

  const invoiceId = resolveId(pi.invoice);
  const paymentMethodId = resolveId(pi.payment_method);

  // Extract card details from expanded payment_method
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;

  if (pi.payment_method && typeof pi.payment_method === "object") {
    const pm = pi.payment_method as Stripe.PaymentMethod;
    if (pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }
  }

  // Fallback: extract from latest_charge if available
  if (!cardBrand && pi.latest_charge && typeof pi.latest_charge === "object") {
    const charge = pi.latest_charge as Stripe.Charge;
    if (charge.payment_method_details?.card) {
      cardBrand = charge.payment_method_details.card.brand ?? null;
      cardLast4 = charge.payment_method_details.card.last4 ?? null;
    }
  }

  const receiptUrl =
    pi.latest_charge && typeof pi.latest_charge === "object"
      ? (pi.latest_charge as Stripe.Charge).receipt_url ?? null
      : null;

  const data = {
    customerId,
    invoiceId,
    amount: pi.amount ?? 0,
    amountReceived: pi.amount_received ?? 0,
    currency: pi.currency ?? "usd",
    status: pi.status,
    description: pi.description ?? null,
    paymentMethodId,
    cardBrand,
    cardLast4,
    receiptUrl,
    metadata: (pi.metadata ?? {}) as Prisma.JsonObject,
    raw: pi as unknown as Prisma.JsonObject,
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
}
