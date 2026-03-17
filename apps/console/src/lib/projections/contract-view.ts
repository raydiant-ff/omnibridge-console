"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { computeDaysToExpiry } from "@/lib/repo";
import type { ContractView } from "./types";

/**
 * Fetch all ContractViews for an SF account, newest first.
 *
 * Composes: SfContract (all statuses)
 *
 * Guardrails enforced:
 * - daysToExpiry computed from endDate — never from SfContract.daysTillExpiry
 * - stripeStatus intentionally excluded — use StripeSubscription.status
 */
export async function getCustomerContractViews(sfAccountId: string): Promise<ContractView[]> {
  await requireSession();

  const contracts = await prisma.sfContract.findMany({
    where: { accountId: sfAccountId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startDate: true,
      endDate: true,
      contractTerm: true,
      doNotRenew: true,
      evergreen: true,
      renewalTerm: true,
      mrr: true,
      arr: true,
      stripeSubscriptionId: true,
      syncedAt: true,
      // daysTillExpiry intentionally excluded — computed below
      // stripeStatus intentionally excluded — use StripeSubscription
    },
  });

  return contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    daysToExpiry: computeDaysToExpiry(c.endDate),
    contractTerm: c.contractTerm,
    doNotRenew: c.doNotRenew,
    evergreen: c.evergreen,
    renewalTerm: c.renewalTerm,
    mrrApprox: c.mrr,
    arrApprox: c.arr,
    stripeSubscriptionId: c.stripeSubscriptionId,
    syncedAt: c.syncedAt,
  }));
}
