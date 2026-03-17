"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { SF_ACCOUNT_BASE_WHERE, computeDaysToExpiry } from "@/lib/repo";
import type { CustomerView } from "./types";

/**
 * Fetch a CustomerView for a single customer by CustomerIndex ID.
 *
 * Composes: CustomerIndex + SfAccount + StripeCustomer + active SfContract +
 *           active StripeSubscription
 *
 * Guardrails enforced:
 * - SfAccount: isStub=false (via SF_ACCOUNT_BASE_WHERE)
 * - SfContract.daysTillExpiry: replaced by computed daysToExpiry
 * - SfContract.stripeStatus: not surfaced — use activeSubscription.status
 */
export async function getCustomerView(customerIndexId: string): Promise<CustomerView | null> {
  await requireSession();

  const index = await prisma.customerIndex.findUnique({
    where: { id: customerIndexId },
  });
  if (!index) return null;

  // Parallel fetch: all sources at once
  const [sfAccount, stripeCustomer, activeContract, activeSubscription] = await Promise.all([
    index.sfAccountId
      ? prisma.sfAccount.findFirst({
          where: { id: index.sfAccountId, ...SF_ACCOUNT_BASE_WHERE },
          select: {
            id: true,
            name: true,
            domain: true,
            ownerId: true,
            ownerName: true,
            csmId: true,
            csmName: true,
            accountType: true,
            status: true,
            syncedAt: true,
          },
        })
      : null,

    index.stripeCustomerId
      ? prisma.stripeCustomer.findUnique({
          where: { id: index.stripeCustomerId },
          select: {
            email: true,
            delinquent: true,
            balance: true,
            currency: true,
            syncedAt: true,
          },
        })
      : null,

    index.sfAccountId
      ? prisma.sfContract.findFirst({
          where: {
            accountId: index.sfAccountId,
            status: "Activated",
          },
          orderBy: { endDate: "desc" },
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
            syncedAt: true,
            // daysTillExpiry intentionally excluded — computed below
            // stripeStatus intentionally excluded — use StripeSubscription
          },
        })
      : null,

    index.stripeCustomerId
      ? prisma.stripeSubscription.findFirst({
          where: {
            customerId: index.stripeCustomerId,
            status: { in: ["active", "trialing", "past_due"] },
          },
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            status: true,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: true,
            syncedAt: true,
          },
        })
      : null,
  ]);

  return {
    // Identity
    id: index.id,
    sfAccountId: index.sfAccountId,
    stripeCustomerId: index.stripeCustomerId,

    // Account (SfAccount)
    name: sfAccount?.name ?? index.sfAccountName ?? "Unknown",
    domain: sfAccount?.domain ?? index.domain,
    ownerId: sfAccount?.ownerId ?? null,
    ownerName: sfAccount?.ownerName ?? null,
    csmId: sfAccount?.csmId ?? null,
    csmName: sfAccount?.csmName ?? null,
    accountType: sfAccount?.accountType ?? null,
    accountStatus: sfAccount?.status ?? null,
    sfAccountSyncedAt: sfAccount?.syncedAt ?? null,

    // Billing (StripeCustomer)
    billingEmail: stripeCustomer?.email ?? null,
    delinquent: stripeCustomer?.delinquent ?? false,
    balanceCents: stripeCustomer?.balance ?? 0,
    currency: stripeCustomer?.currency ?? null,
    stripeCustomerSyncedAt: stripeCustomer?.syncedAt ?? null,

    // Active contract
    activeContract: activeContract
      ? {
          id: activeContract.id,
          contractNumber: activeContract.contractNumber,
          status: activeContract.status,
          startDate: activeContract.startDate,
          endDate: activeContract.endDate,
          // Computed — never from SfContract.daysTillExpiry
          daysToExpiry: computeDaysToExpiry(activeContract.endDate),
          contractTerm: activeContract.contractTerm,
          doNotRenew: activeContract.doNotRenew,
          evergreen: activeContract.evergreen,
          renewalTerm: activeContract.renewalTerm,
          mrrApprox: activeContract.mrr,
          arrApprox: activeContract.arr,
          syncedAt: activeContract.syncedAt,
        }
      : null,

    // Active subscription (billing state — never from SfContract.stripeStatus)
    activeSubscription: activeSubscription
      ? {
          id: activeSubscription.id,
          status: activeSubscription.status,
          cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
          currentPeriodEnd: activeSubscription.currentPeriodEnd,
          syncedAt: activeSubscription.syncedAt,
        }
      : null,
  };
}

/**
 * Fetch CustomerViews for a list of CustomerIndex IDs.
 * Used for customer list/table surfaces.
 */
export async function getCustomerViewList(ids: string[]): Promise<CustomerView[]> {
  const views = await Promise.all(ids.map(getCustomerView));
  return views.filter((v): v is CustomerView => v !== null);
}
