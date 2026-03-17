"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import type { InvoiceView } from "./types";

/**
 * Fetch InvoiceViews for a Stripe customer.
 *
 * Composes: StripeInvoice + StripeCustomer
 *
 * NOTE: StripeInvoice.subscriptionId is a bare string — no Prisma relation to
 * StripeSubscription exists yet. It is surfaced as-is for drill-through use.
 * See docs/schema-cleanup-candidates.md (Priority 2) for the FK migration plan.
 */
export async function getCustomerInvoiceViews(
  stripeCustomerId: string,
  limit = 50,
): Promise<InvoiceView[]> {
  await requireSession();

  const [invoices, customer] = await Promise.all([
    prisma.stripeInvoice.findMany({
      where: { customerId: stripeCustomerId },
      orderBy: { stripeCreated: "desc" },
      take: limit,
      select: {
        id: true,
        customerId: true,
        subscriptionId: true,
        number: true,
        status: true,
        currency: true,
        amountDue: true,
        amountPaid: true,
        amountRemaining: true,
        total: true,
        dueDate: true,
        paidAt: true,
        hostedInvoiceUrl: true,
        invoicePdf: true,
        billingReason: true,
        collectionMethod: true,
        periodStart: true,
        periodEnd: true,
        stripeCreated: true,
        syncedAt: true,
      },
    }),

    prisma.stripeCustomer.findUnique({
      where: { id: stripeCustomerId },
      select: { name: true, email: true },
    }),
  ]);

  return invoices.map((inv) => ({
    id: inv.id,
    customerId: inv.customerId,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    amountDueCents: inv.amountDue,
    amountPaidCents: inv.amountPaid,
    amountRemainingCents: inv.amountRemaining,
    totalCents: inv.total,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    hostedInvoiceUrl: inv.hostedInvoiceUrl,
    invoicePdf: inv.invoicePdf,
    billingReason: inv.billingReason,
    collectionMethod: inv.collectionMethod,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    stripeCreated: inv.stripeCreated,
    syncedAt: inv.syncedAt,
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
    // WARNING: bare string — no FK to StripeSubscription
    subscriptionId: inv.subscriptionId,
  }));
}

/**
 * Fetch a single InvoiceView by invoice ID.
 */
export async function getInvoiceView(invoiceId: string): Promise<InvoiceView | null> {
  await requireSession();

  const inv = await prisma.stripeInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      customerId: true,
      subscriptionId: true,
      number: true,
      status: true,
      currency: true,
      amountDue: true,
      amountPaid: true,
      amountRemaining: true,
      total: true,
      dueDate: true,
      paidAt: true,
      hostedInvoiceUrl: true,
      invoicePdf: true,
      billingReason: true,
      collectionMethod: true,
      periodStart: true,
      periodEnd: true,
      stripeCreated: true,
      syncedAt: true,
    },
  });
  if (!inv) return null;

  const customer = await prisma.stripeCustomer.findUnique({
    where: { id: inv.customerId },
    select: { name: true, email: true },
  });

  return {
    id: inv.id,
    customerId: inv.customerId,
    number: inv.number,
    status: inv.status,
    currency: inv.currency,
    amountDueCents: inv.amountDue,
    amountPaidCents: inv.amountPaid,
    amountRemainingCents: inv.amountRemaining,
    totalCents: inv.total,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    hostedInvoiceUrl: inv.hostedInvoiceUrl,
    invoicePdf: inv.invoicePdf,
    billingReason: inv.billingReason,
    collectionMethod: inv.collectionMethod,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    stripeCreated: inv.stripeCreated,
    syncedAt: inv.syncedAt,
    customerName: customer?.name ?? null,
    customerEmail: customer?.email ?? null,
    subscriptionId: inv.subscriptionId,
  };
}
