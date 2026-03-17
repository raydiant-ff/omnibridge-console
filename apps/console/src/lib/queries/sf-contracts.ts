"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { computeDaysToExpiry } from "@/lib/repo";

export async function getContracts(filters?: {
  status?: string;
  accountId?: string;
  search?: string;
}) {
  await requireSession();

  const where: Record<string, unknown> = {};
  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }
  if (filters?.search) {
    where.OR = [
      { accountName: { contains: filters.search, mode: "insensitive" } },
      { contractNumber: { contains: filters.search, mode: "insensitive" } },
      { stripeSubscriptionId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const contracts = await prisma.sfContract.findMany({
    where,
    orderBy: { sfLastModified: "desc" },
    include: {
      _count: { select: { lines: true } },
      lines: { select: { mrr: true, arr: true } },
    },
  });

  return contracts.map((c) => {
    // Contract-level MRR/ARR is always 0 in SF.
    // Compute from contract lines (SBQQ Subscriptions) which have Monthly_Value__c → mrr.
    const lineMrr = c.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
    const lineArr = c.lines.reduce((sum, l) => sum + (l.arr ?? 0), 0);
    const mrr = (c.mrr && c.mrr > 0) ? c.mrr : lineMrr > 0 ? lineMrr : null;
    const arr = (c.arr && c.arr > 0) ? c.arr : lineArr > 0 ? lineArr : null;

    return {
      id: c.id,
      accountId: c.accountId,
      accountName: c.accountName,
      status: c.status,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      contractTerm: c.contractTerm,
      contractNumber: c.contractNumber,
      ownerName: c.ownerName,
      stripeSubscriptionId: c.stripeSubscriptionId,
      stripeCustomerId: c.stripeCustomerId,
      // stripeStatus intentionally omitted — stale mirror. Use StripeSubscription.status.
      collectionMethod: c.collectionMethod,
      mrr,
      arr,
      evergreen: c.evergreen,
      doNotRenew: c.doNotRenew,
      daysTillExpiry: computeDaysToExpiry(c.endDate),
      lineCount: c._count.lines,
      sfLastModified: c.sfLastModified?.toISOString() ?? null,
    };
  });
}

export async function getContractCounts() {
  await requireSession();

  const [total, activated, canceled, pending, draft] = await Promise.all([
    prisma.sfContract.count(),
    prisma.sfContract.count({ where: { status: "Activated" } }),
    prisma.sfContract.count({ where: { status: "canceled" } }),
    prisma.sfContract.count({ where: { status: "Pending" } }),
    prisma.sfContract.count({ where: { status: "Draft" } }),
  ]);

  return { total, activated, canceled, pending, draft };
}

export async function getContractDetail(contractId: string) {
  await requireSession();

  const contract = await prisma.sfContract.findUnique({
    where: { id: contractId },
    include: {
      lines: {
        orderBy: { productName: "asc" },
      },
      account: {
        select: { id: true, name: true, stripeCustomerId: true, ownerName: true, csmName: true },
      },
    },
  });

  if (!contract) return null;

  // Try to find linked Stripe subscription
  let stripeSubscription = null;
  if (contract.stripeSubscriptionId) {
    stripeSubscription = await prisma.stripeSubscription.findUnique({
      where: { id: contract.stripeSubscriptionId },
      include: { items: true },
    });
  }

  // Try to find linked QuoteRecord
  const quoteRecord = await prisma.quoteRecord.findFirst({
    where: { sfContractId: contractId },
    select: { id: true, status: true, quoteType: true, stripeQuoteId: true, createdAt: true },
  });

  // Compute MRR/ARR from lines (contract-level fields are always 0 in SF)
  const lineMrr = contract.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
  const lineArr = contract.lines.reduce((sum, l) => sum + (l.arr ?? 0), 0);
  const mrr = (contract.mrr && contract.mrr > 0) ? contract.mrr : lineMrr > 0 ? lineMrr : null;
  const arr = (contract.arr && contract.arr > 0) ? contract.arr : lineArr > 0 ? lineArr : null;

  return {
    ...contract,
    mrr,
    arr,
    daysTillExpiry: computeDaysToExpiry(contract.endDate),
    startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
    cancellationDate: contract.cancellationDate?.toISOString() ?? null,
    activatedDate: contract.activatedDate?.toISOString() ?? null,
    customerSignedDate: contract.customerSignedDate?.toISOString().slice(0, 10) ?? null,
    sfLastModified: contract.sfLastModified?.toISOString() ?? null,
    syncedAt: contract.syncedAt.toISOString(),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    lines: contract.lines.map((l) => ({
      ...l,
      startDate: l.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: l.endDate?.toISOString().slice(0, 10) ?? null,
      sfLastModified: l.sfLastModified?.toISOString() ?? null,
      syncedAt: l.syncedAt.toISOString(),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    stripeSubscription: stripeSubscription
      ? {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodEnd: stripeSubscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
          items: stripeSubscription.items.map((i) => ({
            id: i.id,
            productName: i.productName,
            priceId: i.priceId,
            unitAmount: i.unitAmount,
            currency: i.currency,
            billingInterval: i.billingInterval,
            quantity: i.quantity,
          })),
        }
      : null,
    quoteRecord: quoteRecord
      ? {
          ...quoteRecord,
          createdAt: quoteRecord.createdAt.toISOString(),
        }
      : null,
  };
}

export async function getExpiringContracts(withinDays: number = 90) {
  await requireSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  const contracts = await prisma.sfContract.findMany({
    where: {
      status: "Activated",
      endDate: { lte: cutoff, gte: new Date() },
      doNotRenew: false,
    },
    orderBy: { endDate: "asc" },
    include: {
      _count: { select: { lines: true } },
      lines: { select: { mrr: true, arr: true } },
    },
  });

  return contracts.map((c) => {
    const lineMrr = c.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
    const lineArr = c.lines.reduce((sum, l) => sum + (l.arr ?? 0), 0);
    return {
      id: c.id,
      accountName: c.accountName,
      contractNumber: c.contractNumber,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      daysTillExpiry: computeDaysToExpiry(c.endDate),
      mrr: (c.mrr && c.mrr > 0) ? c.mrr : lineMrr > 0 ? lineMrr : null,
      arr: (c.arr && c.arr > 0) ? c.arr : lineArr > 0 ? lineArr : null,
      stripeSubscriptionId: c.stripeSubscriptionId,
      lineCount: c._count.lines,
    };
  });
}
