"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { computeDaysToExpiry, computeMrrCents } from "@/lib/repo";
import type { SubscriptionView } from "./types";

/**
 * Fetch a SubscriptionView for a single Stripe subscription.
 *
 * Composes: StripeSubscription + StripeSubscriptionItem + SfContractLine (correlated)
 *           + SfContract (linked) + QuoteRecord (originating) + CustomerIndex
 *
 * Guardrails:
 * - SfContract.daysTillExpiry: replaced by computed daysToExpiry from endDate
 * - SfContract.stripeStatus: not surfaced — subscription.status is authoritative
 * - MRR: computed from items at query time, not from SfContract.mrr
 * - servicePeriodStart/End: from parent subscription, not from item (items inherit period)
 * - correlationStatus "candidate": heuristic match — not presented as authoritative
 */
export async function getSubscriptionView(subscriptionId: string): Promise<SubscriptionView | null> {
  await requireSession();

  const sub = await prisma.stripeSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      items: true,
    },
  });
  if (!sub) return null;

  // Batch-fetch SfContractLines for correlated items
  const sfContractLineIds = sub.items
    .map((i) => i.sfContractLineId)
    .filter((id): id is string => id !== null);

  const [sfContract, originatingQuote, customerIndex, contractLines] = await Promise.all([
    prisma.sfContract.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        endDate: true,
        doNotRenew: true,
        evergreen: true,
        // daysTillExpiry excluded — computed below
        // stripeStatus excluded — sub.status is authoritative
      },
    }),

    prisma.quoteRecord.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        stripeQuoteId: true,
        quoteType: true,
        sfAccountId: true,
      },
    }),

    prisma.customerIndex.findFirst({
      where: { stripeCustomerId: sub.customerId },
      select: { sfAccountId: true },
    }),

    sfContractLineIds.length > 0
      ? prisma.sfContractLine.findMany({
          where: { id: { in: sfContractLineIds } },
          select: {
            id: true,
            productName: true,
            contractId: true,
            contract: {
              select: { contractNumber: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const contractLineMap = new Map(contractLines.map((l) => [l.id, l]));

  const mrrCents = computeMrrCents(
    sub.items.map((i) => ({
      unitAmount: i.unitAmount,
      quantity: i.quantity,
      billingInterval: i.billingInterval,
      intervalCount: i.intervalCount,
    })),
  );

  return {
    id: sub.id,
    customerId: sub.customerId,
    customerName: sub.customerName,
    status: sub.status,
    collectionMethod: sub.collectionMethod,
    currency: sub.currency,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelAt: sub.cancelAt,
    canceledAt: sub.canceledAt,
    startDate: sub.startDate,
    hasSchedule: sub.hasSchedule,
    syncedAt: sub.syncedAt,

    items: sub.items.map((i) => {
      const cl = i.sfContractLineId ? contractLineMap.get(i.sfContractLineId) : undefined;
      return {
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        priceId: i.priceId,
        unitAmountCents: i.unitAmount,
        quantity: i.quantity,
        billingInterval: i.billingInterval,
        intervalCount: i.intervalCount,
        usageType: i.usageType,
        // Service period — items inherit from the parent subscription
        servicePeriodStart: sub.currentPeriodStart,
        servicePeriodEnd: sub.currentPeriodEnd,
        // SF correlation
        sfContractLineId: i.sfContractLineId,
        sfContractLineName: cl?.productName ?? null,
        contractId: cl?.contractId ?? null,
        contractNumber: cl?.contract?.contractNumber ?? null,
        correlationStatus: i.correlationStatus as "matched" | "candidate" | "unmatched",
        correlationMethod: i.correlationMethod as "exact_item_id" | "exact_price_id" | "heuristic" | null,
      };
    }),

    mrrCents,

    sfAccountId: customerIndex?.sfAccountId ?? null,

    sfContract: sfContract
      ? {
          id: sfContract.id,
          contractNumber: sfContract.contractNumber,
          status: sfContract.status,
          endDate: sfContract.endDate,
          // Computed — never from SfContract.daysTillExpiry
          daysToExpiry: computeDaysToExpiry(sfContract.endDate),
          doNotRenew: sfContract.doNotRenew,
          evergreen: sfContract.evergreen,
        }
      : null,

    originatingQuote: originatingQuote
      ? {
          id: originatingQuote.id,
          stripeQuoteId: originatingQuote.stripeQuoteId,
          quoteType: originatingQuote.quoteType,
          sfAccountId: originatingQuote.sfAccountId,
        }
      : null,
  };
}

/**
 * Fetch all active SubscriptionViews for a Stripe customer.
 */
export async function getCustomerSubscriptionViews(
  stripeCustomerId: string,
): Promise<SubscriptionView[]> {
  await requireSession();

  const subs = await prisma.stripeSubscription.findMany({
    where: {
      customerId: stripeCustomerId,
      status: { in: ["active", "trialing", "past_due"] },
    },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });

  const views = await Promise.all(subs.map((s) => getSubscriptionView(s.id)));
  return views.filter((v): v is SubscriptionView => v !== null);
}
