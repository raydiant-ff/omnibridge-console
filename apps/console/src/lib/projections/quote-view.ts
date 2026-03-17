"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { SF_ACCOUNT_BASE_WHERE } from "@/lib/repo";
import type { QuoteView } from "./types";

function mapQuote(
  q: Awaited<ReturnType<typeof fetchQuoteRaw>>,
  sfAccountName: string | null,
  billToContact: QuoteView["billToContact"],
  createdByName: string | null,
): QuoteView {
  return {
    id: q.id,
    stripeQuoteId: q.stripeQuoteId,
    stripeQuoteNumber: q.stripeQuoteNumber,
    sfQuoteId: q.sfQuoteId,
    sfQuoteNumber: q.sfQuoteNumber,
    status: q.status,
    quoteType: q.quoteType,
    totalAmountCents: q.totalAmount,
    currency: q.currency,
    collectionMethod: q.collectionMethod,
    paymentTerms: q.paymentTerms,
    daysUntilDue: q.daysUntilDue,
    contractTerm: q.contractTerm,
    billingFrequency: q.billingFrequency,
    contractEndDate: q.contractEndDate,
    effectiveDate: q.effectiveDate,
    effectiveTiming: q.effectiveTiming,
    prorationAmountCents: q.prorationAmountCents,
    sfAccountId: q.sfAccountId,
    customerName: q.customerName,
    sfAccountName,
    stripeCustomerId: q.stripeCustomerId,
    billToContact,
    signerName: q.signerName,
    signerEmail: q.signerEmail,
    docusignEnvelopeId: q.docusignEnvelopeId,
    opportunityId: q.opportunityId,
    sfContractId: q.sfContractId,
    stripeSubscriptionId: q.stripeSubscriptionId,
    stripeScheduleId: q.stripeScheduleId,
    acceptedAt: q.acceptedAt,
    expiresAt: q.expiresAt,
    createdAt: q.createdAt,
    dryRun: q.dryRun,
    createdBy: q.createdBy,
    createdByName,
  };
}

async function fetchQuoteRaw(quoteId: string) {
  return prisma.quoteRecord.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      stripeQuoteId: true,
      stripeQuoteNumber: true,
      sfQuoteId: true,
      sfQuoteNumber: true,
      status: true,
      quoteType: true,
      totalAmount: true,
      currency: true,
      collectionMethod: true,
      paymentTerms: true,
      daysUntilDue: true,
      contractTerm: true,
      billingFrequency: true,
      contractEndDate: true,
      effectiveDate: true,
      effectiveTiming: true,
      prorationAmountCents: true,
      sfAccountId: true,
      customerName: true,
      stripeCustomerId: true,
      billToContactId: true,
      signerName: true,
      signerEmail: true,
      docusignEnvelopeId: true,
      opportunityId: true,
      sfContractId: true,
      stripeSubscriptionId: true,
      stripeScheduleId: true,
      acceptedAt: true,
      expiresAt: true,
      createdAt: true,
      dryRun: true,
      createdBy: true,
      // pandadocDocId intentionally excluded — dead field, pending removal
    },
  });
}

/**
 * Fetch a QuoteView for a single quote.
 *
 * Composes: QuoteRecord + SfAccount (current name) + SfContact (bill-to) + User (creator)
 *
 * Guardrails:
 * - SfAccount: isStub=false enforced
 * - pandadocDocId: never surfaced (dead field)
 */
export async function getQuoteView(quoteId: string): Promise<QuoteView | null> {
  await requireSession();

  const q = await fetchQuoteRaw(quoteId);
  if (!q) return null;

  const [sfAccount, billToContact, creator] = await Promise.all([
    q.sfAccountId
      ? prisma.sfAccount.findFirst({
          where: { id: q.sfAccountId, ...SF_ACCOUNT_BASE_WHERE },
          select: { name: true },
        })
      : null,

    q.billToContactId
      ? prisma.sfContact.findUnique({
          where: { id: q.billToContactId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            title: true,
          },
        })
      : null,

    prisma.user.findUnique({
      where: { id: q.createdBy },
      select: { name: true },
    }),
  ]);

  return mapQuote(q, sfAccount?.name ?? null, billToContact ?? null, creator?.name ?? null);
}

/**
 * Fetch QuoteViews for a list of quote IDs (e.g. for a customer's quote history).
 */
export async function getQuoteViewList(quoteIds: string[]): Promise<QuoteView[]> {
  const views = await Promise.all(quoteIds.map(getQuoteView));
  return views.filter((v): v is QuoteView => v !== null);
}

/**
 * Fetch QuoteViews for a Stripe customer.
 */
export async function getCustomerQuoteViews(
  stripeCustomerId: string,
  limit = 20,
): Promise<QuoteView[]> {
  await requireSession();

  const quotes = await prisma.quoteRecord.findMany({
    where: { stripeCustomerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  return getQuoteViewList(quotes.map((q) => q.id));
}
