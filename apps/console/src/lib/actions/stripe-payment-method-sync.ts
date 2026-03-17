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
 * Upsert a Stripe PaymentMethod into the local mirror.
 * Safe to call from webhooks and backfill scripts.
 */
export async function upsertStripePaymentMethod(
  pm: Stripe.PaymentMethod,
  isDefault = false,
) {
  const customerId = resolveId(pm.customer);

  // If not explicitly provided, check if this is the customer's default PM
  let defaultFlag = isDefault;
  if (!defaultFlag && customerId) {
    const customer = await prisma.stripeCustomer.findUnique({
      where: { id: customerId },
      select: { defaultPaymentMethod: true },
    });
    if (customer?.defaultPaymentMethod === pm.id) {
      defaultFlag = true;
    }
  }

  // Extract card details
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  let cardExpMonth: number | null = null;
  let cardExpYear: number | null = null;
  let cardFunding: string | null = null;

  if (pm.card) {
    cardBrand = pm.card.brand ?? null;
    cardLast4 = pm.card.last4 ?? null;
    cardExpMonth = pm.card.exp_month ?? null;
    cardExpYear = pm.card.exp_year ?? null;
    cardFunding = pm.card.funding ?? null;
  }

  // Extract bank details
  let bankName: string | null = null;
  let bankLast4: string | null = null;

  if (pm.us_bank_account) {
    bankName = pm.us_bank_account.bank_name ?? null;
    bankLast4 = pm.us_bank_account.last4 ?? null;
  }

  const data = {
    customerId,
    type: pm.type,
    cardBrand,
    cardLast4,
    cardExpMonth,
    cardExpYear,
    cardFunding,
    bankName,
    bankLast4,
    isDefault: defaultFlag,
    metadata: (pm.metadata ?? {}) as Prisma.JsonObject,
    raw: pm as unknown as Prisma.JsonObject,
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
}

/**
 * Delete a payment method from the local mirror (for detach events).
 */
export async function deleteStripePaymentMethod(pmId: string) {
  await prisma.stripePaymentMethod
    .delete({ where: { id: pmId } })
    .catch(() => {});
}
