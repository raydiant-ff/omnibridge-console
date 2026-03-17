"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { SF_ACCOUNT_BASE_WHERE, computeDaysToExpiry, computeMrrCents } from "@/lib/repo";
import type { CustomerDirectoryRow, CustomerDirectoryTotals } from "./types";

export interface CustomerDirectoryResult {
  rows: CustomerDirectoryRow[];
  totals: CustomerDirectoryTotals;
}

/**
 * Fetch all CustomerDirectoryRows plus aggregate totals.
 *
 * Composes:
 *   CustomerIndex (all)
 *   + SfAccount (non-stub, with active SfContracts)
 *   + StripeSubscription (active/trialing/past_due, with items)
 *
 * Guardrails:
 *   - SfAccount: isStub=false (via SF_ACCOUNT_BASE_WHERE)
 *   - MRR: computed from items — never from SfContract.mrr
 *   - daysToNearestRenewal: computed from contract endDate — never from SfContract.daysTillExpiry
 *   - Subscription status: from StripeSubscription — never from SfContract.stripeStatus
 */
export async function getCustomerDirectory(): Promise<CustomerDirectoryResult> {
  await requireSession();

  const [allIndexEntries, sfAccountsWithContracts, activeSubscriptions] = await Promise.all([
    // All CustomerIndex entries
    prisma.customerIndex.findMany({
      select: {
        id: true,
        sfAccountId: true,
        stripeCustomerId: true,
        sfAccountName: true,
        domain: true,
      },
      orderBy: { sfAccountName: "asc" },
    }),

    // All non-stub SfAccounts with their active contracts
    prisma.sfAccount.findMany({
      where: SF_ACCOUNT_BASE_WHERE,
      select: {
        id: true,
        name: true,
        domain: true,
        ownerName: true,
        csmName: true,
        accountType: true,
        status: true,
        dateOfFirstClosedWon: true,
        contracts: {
          where: { status: "Activated" },
          select: {
            id: true,
            contractNumber: true,
            endDate: true,
            arr: true,
          },
          orderBy: { endDate: "asc" },
        },
      },
    }),

    // All active StripeSubscriptions with items (for MRR computation)
    prisma.stripeSubscription.findMany({
      where: { status: { in: ["active", "trialing", "past_due"] } },
      select: {
        id: true,
        customerId: true,
        status: true,
        items: {
          select: {
            unitAmount: true,
            quantity: true,
            billingInterval: true,
            intervalCount: true,
          },
        },
      },
    }),
  ]);

  // Build lookup maps
  const sfAccountMap = new Map(sfAccountsWithContracts.map((a) => [a.id, a]));

  // Group subscriptions by Stripe customer ID
  const subsByCustomerId = new Map<string, typeof activeSubscriptions>();
  for (const sub of activeSubscriptions) {
    const existing = subsByCustomerId.get(sub.customerId) ?? [];
    existing.push(sub);
    subsByCustomerId.set(sub.customerId, existing);
  }

  // Build rows
  const rows: CustomerDirectoryRow[] = allIndexEntries.map((index) => {
    const sfAccount = index.sfAccountId ? sfAccountMap.get(index.sfAccountId) : undefined;
    const subs = index.stripeCustomerId ? (subsByCustomerId.get(index.stripeCustomerId) ?? []) : [];
    const activeContracts = sfAccount?.contracts ?? [];

    // MRR: computed from subscription items
    const mrrCents = subs.reduce(
      (sum, sub) =>
        sum +
        computeMrrCents(
          sub.items.map((i) => ({
            unitAmount: i.unitAmount,
            quantity: i.quantity,
            billingInterval: i.billingInterval,
            intervalCount: i.intervalCount,
          })),
        ),
      0,
    );

    // Nearest contract end (contracts are ordered by endDate asc)
    const nearestContract = activeContracts[0] ?? null;
    const nearestContractEnd = nearestContract?.endDate ?? null;
    const nearestContractNumber = nearestContract?.contractNumber ?? null;
    const daysToNearestRenewal = computeDaysToExpiry(nearestContractEnd);

    // ARR from nearest active contract
    const arrApprox = nearestContract?.arr ?? null;

    return {
      id: index.id,
      sfAccountId: index.sfAccountId,
      stripeCustomerId: index.stripeCustomerId,
      name: sfAccount?.name ?? index.sfAccountName ?? "Unknown",
      domain: sfAccount?.domain ?? index.domain,
      aeName: sfAccount?.ownerName ?? null,
      csmName: sfAccount?.csmName ?? null,
      accountStatus: sfAccount?.status ?? null,
      accountType: sfAccount?.accountType ?? null,
      firstClosedWon: sfAccount?.dateOfFirstClosedWon ?? null,
      hasSalesforce: !!index.sfAccountId && !!sfAccount,
      hasStripe: !!index.stripeCustomerId && subs.length > 0,
      activeSubscriptionCount: subs.length,
      activeContractCount: activeContracts.length,
      mrrCents,
      arrApprox,
      nearestContractEnd,
      nearestContractNumber,
      daysToNearestRenewal,
      subscriptionIds: subs.map((s) => s.id),
      contractNumbers: activeContracts
        .map((c) => c.contractNumber)
        .filter((n): n is string => n !== null),
    };
  });

  const totals = buildTotals(rows);
  return { rows, totals };
}

function buildTotals(rows: CustomerDirectoryRow[]): CustomerDirectoryTotals {
  let activeCustomers = 0;
  let sfAccountCount = 0;
  let stripeCustomerCount = 0;
  let activeSubscriptionCount = 0;
  let activeContractCount = 0;
  let totalMrrCents = 0;
  let totalArrApprox = 0;
  let renewingIn30d = 0;
  let renewingIn90d = 0;

  for (const row of rows) {
    if (row.activeSubscriptionCount > 0 || row.activeContractCount > 0) activeCustomers++;
    if (row.hasSalesforce) sfAccountCount++;
    if (row.hasStripe) stripeCustomerCount++;
    activeSubscriptionCount += row.activeSubscriptionCount;
    activeContractCount += row.activeContractCount;
    totalMrrCents += row.mrrCents;
    if (row.arrApprox) totalArrApprox += row.arrApprox;
    if (row.daysToNearestRenewal !== null && row.daysToNearestRenewal <= 30) renewingIn30d++;
    if (row.daysToNearestRenewal !== null && row.daysToNearestRenewal <= 90) renewingIn90d++;
  }

  return {
    totalCustomers: rows.length,
    activeCustomers,
    sfAccountCount,
    stripeCustomerCount,
    activeSubscriptionCount,
    activeContractCount,
    totalMrrCents,
    totalArrApprox,
    renewingIn30d,
    renewingIn90d,
  };
}
