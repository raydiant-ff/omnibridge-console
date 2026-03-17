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
 * Upsert a Stripe Invoice into the local mirror.
 * Safe to call from webhooks and backfill scripts.
 */
export async function upsertStripeInvoice(invoice: Stripe.Invoice) {
  const customerId = resolveId(invoice.customer);
  if (!customerId) return;

  const subscriptionId = resolveId(invoice.subscription);

  const data = {
    customerId,
    subscriptionId,
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
    periodEnd: invoice.period_end ? epochToDate(invoice.period_end) : null,
    metadata: (invoice.metadata ?? {}) as Prisma.JsonObject,
    raw: invoice as unknown as Prisma.JsonObject,
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
}
