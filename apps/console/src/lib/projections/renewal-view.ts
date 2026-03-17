"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import {
  SF_ACCOUNT_BASE_WHERE,
  computeDaysToExpiry,
  classifyRenewalUrgency,
} from "@/lib/repo";
import type { RenewalView } from "./types";

/**
 * Fetch a RenewalView for a single SF contract.
 *
 * Composes: SfContract (timing + flags) + SfAccount (customer identity) +
 *           StripeSubscription (billing state) + Renewal (workflow, if exists) +
 *           CustomerIndex (for cross-system ID)
 *
 * Guardrails:
 * - SfAccount: isStub=false enforced (via SF_ACCOUNT_BASE_WHERE)
 * - daysToExpiry: computed from endDate — NEVER from SfContract.daysTillExpiry
 * - subscriptionStatus: from StripeSubscription — NEVER from SfContract.stripeStatus
 */
export async function getRenewalView(sfContractId: string): Promise<RenewalView | null> {
  await requireSession();

  const contract = await prisma.sfContract.findUnique({
    where: { id: sfContractId },
    select: {
      id: true,
      contractNumber: true,
      accountId: true,
      accountName: true,
      status: true,
      startDate: true,
      endDate: true,
      contractTerm: true,
      renewalTerm: true,
      doNotRenew: true,
      evergreen: true,
      mrr: true,
      arr: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      ownerId: true,
      ownerName: true,
      // daysTillExpiry intentionally excluded — computed below
      // stripeStatus intentionally excluded — use StripeSubscription
    },
  });
  if (!contract) return null;

  const [sfAccount, stripeSubscription, customerIndex, renewal] = await Promise.all([
    prisma.sfAccount.findFirst({
      where: { id: contract.accountId, ...SF_ACCOUNT_BASE_WHERE },
      select: { name: true, csmName: true, ownerName: true },
    }),

    contract.stripeSubscriptionId
      ? prisma.stripeSubscription.findUnique({
          where: { id: contract.stripeSubscriptionId },
          select: { status: true },
        })
      : null,

    contract.stripeCustomerId
      ? prisma.customerIndex.findFirst({
          where: { stripeCustomerId: contract.stripeCustomerId },
          select: { id: true },
        })
      : prisma.customerIndex.findFirst({
          where: { sfAccountId: contract.accountId },
          select: { id: true },
        }),

    prisma.renewal.findFirst({
      where: { sfContractId },
      select: { id: true, status: true, ownerUserId: true, targetRenewalDate: true, atRisk: true, notesSummary: true },
    }),
  ]);

  // Compute daysToExpiry from endDate — never from SfContract.daysTillExpiry
  const daysToExpiry = computeDaysToExpiry(contract.endDate);

  return {
    sfContractId: contract.id,
    contractNumber: contract.contractNumber,
    sfAccountId: contract.accountId,
    // SF is authoritative for account name; fall back to snapshot
    accountName: sfAccount?.name ?? contract.accountName ?? "Unknown",
    stripeCustomerId: contract.stripeCustomerId,
    customerIndexId: customerIndex?.id ?? null,
    ownerName: sfAccount?.ownerName ?? contract.ownerName ?? null,
    csmName: sfAccount?.csmName ?? null,
    contractStartDate: contract.startDate,
    contractEndDate: contract.endDate,
    contractTerm: contract.contractTerm,
    renewalTerm: contract.renewalTerm,
    daysToExpiry,
    // Classify urgency from computed daysToExpiry
    renewalUrgency: classifyRenewalUrgency(daysToExpiry),
    doNotRenew: contract.doNotRenew,
    evergreen: contract.evergreen,
    mrrApprox: contract.mrr,
    arrApprox: contract.arr,
    stripeSubscriptionId: contract.stripeSubscriptionId,
    // Billing status from StripeSubscription — never from SfContract.stripeStatus
    subscriptionStatus: stripeSubscription?.status ?? null,
    renewal,
  };
}

/**
 * Fetch RenewalViews for contracts expiring within a window.
 *
 * Used for the renewals workspace list view.
 * daysWindow=90 means: expiring in the next 90 days (or already expired).
 */
export async function getRenewalViewsForWindow(
  daysWindow = 90,
): Promise<RenewalView[]> {
  await requireSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysWindow);

  const contracts = await prisma.sfContract.findMany({
    where: {
      status: "Activated",
      endDate: { lte: cutoff },
      evergreen: false,
    },
    orderBy: { endDate: "asc" },
    select: { id: true },
    take: 200,
  });

  const views = await Promise.all(contracts.map((c) => getRenewalView(c.id)));
  return views.filter((v): v is RenewalView => v !== null);
}
