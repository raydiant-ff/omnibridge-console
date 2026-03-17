"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import type { UnifiedInvoiceRow, UnifiedPaymentRow } from "./types";

/**
 * Fetch a unified invoice list for a customer, merging Stripe and SF sources.
 *
 * - Stripe invoices: from StripeInvoice mirror (amounts in cents)
 * - SF invoices: from SfInvoice mirror (amounts in currency units)
 *
 * Returns newest-first, limited to `limit` rows total.
 * SF invoices will be empty until the SF invoice sync job is implemented.
 */
export async function getCustomerUnifiedInvoices(
  stripeCustomerId: string | null,
  sfAccountId: string | null,
  limit = 25,
): Promise<UnifiedInvoiceRow[]> {
  await requireSession();

  const [stripeInvoices, sfInvoices] = await Promise.all([
    stripeCustomerId
      ? prisma.stripeInvoice.findMany({
          where: { customerId: stripeCustomerId },
          orderBy: { stripeCreated: "desc" },
          take: limit,
          select: {
            id: true,
            number: true,
            status: true,
            currency: true,
            amountDue: true,
            amountPaid: true,
            total: true,
            dueDate: true,
            paidAt: true,
            hostedInvoiceUrl: true,
            subscriptionId: true,
            stripeCreated: true,
          },
        })
      : Promise.resolve([]),

    sfAccountId
      ? prisma.sfInvoice.findMany({
          where: { sfAccountId },
          orderBy: { invoiceDate: "desc" },
          take: limit,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            currency: true,
            totalAmount: true,
            invoiceDate: true,
            dueDate: true,
            externalUrl: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const rows: UnifiedInvoiceRow[] = [
    ...stripeInvoices.map((inv) => ({
      id: inv.id,
      source: "stripe" as const,
      number: inv.number,
      status: inv.status,
      currency: inv.currency,
      totalCents: inv.total,
      invoiceDate: inv.stripeCreated,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      externalUrl: inv.hostedInvoiceUrl,
      amountDueCents: inv.amountDue,
      amountPaidCents: inv.amountPaid,
      subscriptionId: inv.subscriptionId,
    })),
    ...sfInvoices.map((inv) => ({
      id: inv.id,
      source: "salesforce" as const,
      number: inv.invoiceNumber,
      status: inv.status,
      currency: inv.currency ?? "usd",
      totalCents: Math.round((inv.totalAmount ?? 0) * 100),
      invoiceDate: inv.invoiceDate ?? new Date(0),
      dueDate: inv.dueDate,
      paidAt: null,
      externalUrl: inv.externalUrl,
      amountDueCents: null,
      amountPaidCents: null,
      subscriptionId: null,
    })),
  ];

  return rows
    .sort((a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime())
    .slice(0, limit);
}

/**
 * Fetch a unified payment list for a customer, merging Stripe and SF sources.
 *
 * - Stripe payments: succeeded PaymentIntents from StripePayment mirror
 * - SF payments: from SfPayment mirror
 *
 * Returns newest-first, limited to `limit` rows total.
 * SF payments will be empty until the SF payment sync job is implemented.
 */
export async function getCustomerUnifiedPayments(
  stripeCustomerId: string | null,
  sfAccountId: string | null,
  limit = 25,
): Promise<UnifiedPaymentRow[]> {
  await requireSession();

  const [stripePayments, sfPayments] = await Promise.all([
    stripeCustomerId
      ? prisma.stripePayment.findMany({
          where: { customerId: stripeCustomerId, status: "succeeded" },
          orderBy: { stripeCreated: "desc" },
          take: limit,
          select: {
            id: true,
            amountReceived: true,
            currency: true,
            status: true,
            cardBrand: true,
            cardLast4: true,
            receiptUrl: true,
            invoiceId: true,
            stripeCreated: true,
          },
        })
      : Promise.resolve([]),

    sfAccountId
      ? prisma.sfPayment.findMany({
          where: { sfAccountId },
          orderBy: { paymentDate: "desc" },
          take: limit,
          select: {
            id: true,
            sfId: true,
            paymentDate: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            referenceId: true,
            externalUrl: true,
            sfInvoiceId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const rows: UnifiedPaymentRow[] = [
    ...stripePayments.map((p) => ({
      id: p.id,
      source: "stripe" as const,
      paymentDate: p.stripeCreated,
      amount: p.amountReceived / 100,
      amountCents: p.amountReceived,
      currency: p.currency,
      status: p.status,
      paymentMethod:
        p.cardBrand && p.cardLast4 ? `${p.cardBrand} ····${p.cardLast4}` : null,
      invoiceId: p.invoiceId,
      receiptUrl: p.receiptUrl,
      referenceId: p.id,
    })),
    ...sfPayments.map((p) => ({
      id: p.id,
      source: "salesforce" as const,
      paymentDate: p.paymentDate ?? new Date(0),
      amount: p.amount ?? 0,
      amountCents: Math.round((p.amount ?? 0) * 100),
      currency: p.currency ?? "usd",
      status: p.status ?? "unknown",
      paymentMethod: p.paymentMethod,
      invoiceId: p.sfInvoiceId,
      receiptUrl: p.externalUrl,
      referenceId: p.referenceId ?? p.sfId,
    })),
  ];

  return rows
    .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
    .slice(0, limit);
}
