/**
 * Builder: Omni Subscription Facts
 *
 * Queries StripeSubscription + StripeSubscriptionItem + SfContract + StripeInvoice
 * and composes into the canonical OmniSubscriptionFacts shape.
 */

import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { computeFreshness } from "../contracts/shared-types";
import type { OmniSubscriptionFacts } from "../contracts/omni-subscription-facts";
import type { ConfidenceFlagEntry } from "../contracts/shared-types";

export async function buildOmniSubscriptionFacts(opts: {
  subscriptionIds?: string[];
  stripeCustomerIds?: string[];
  statuses?: string[];
}): Promise<OmniSubscriptionFacts[]> {
  const where: Record<string, unknown> = {};
  if (opts.subscriptionIds?.length) where.id = { in: opts.subscriptionIds };
  if (opts.stripeCustomerIds?.length) where.customerId = { in: opts.stripeCustomerIds };
  if (opts.statuses?.length) where.status = { in: opts.statuses };

  const subs = await prisma.stripeSubscription.findMany({
    where,
    include: {
      items: {
        select: {
          id: true, unitAmount: true, quantity: true,
          billingInterval: true, intervalCount: true,
          usageType: true, sfContractLineId: true,
          correlationStatus: true,
        },
      },
    },
  });

  if (subs.length === 0) return [];

  // Resolve omniAccountId via CustomerIndex
  const customerIds = [...new Set(subs.map((s) => s.customerId))];
  const ciRows = await prisma.customerIndex.findMany({
    where: { stripeCustomerId: { in: customerIds } },
    select: { id: true, stripeCustomerId: true },
  });
  const ciMap = new Map(ciRows.map((r) => [r.stripeCustomerId, r.id]));

  // Batch fetch linked SF contracts
  const subIds = subs.map((s) => s.id);
  const sfContracts = await prisma.sfContract.findMany({
    where: { stripeSubscriptionId: { in: subIds } },
    select: { id: true, stripeSubscriptionId: true },
  });
  const sfContractMap = new Map(
    sfContracts.map((c) => [c.stripeSubscriptionId!, c.id]),
  );

  // Batch fetch last paid invoice per subscription
  const lastPaidInvoices = await prisma.$queryRawUnsafe<{
    subscription_id: string;
    paid_at: Date | null;
    period_end: Date | null;
  }[]>(
    `
    SELECT DISTINCT ON (inv.subscription_id)
      inv.subscription_id, inv.paid_at, inv.period_end
    FROM stripe_invoices inv
    WHERE inv.subscription_id = ANY($1)
      AND inv.status = 'paid'
    ORDER BY inv.subscription_id, inv.period_end DESC
    `,
    subIds,
  );
  const invoiceMap = new Map(
    lastPaidInvoices.map((i) => [i.subscription_id, i]),
  );

  // Compute freshness
  const syncTimes = subs.map((s) => s.syncedAt).filter((d): d is Date => d != null);
  const latestSync = syncTimes.length > 0
    ? new Date(Math.max(...syncTimes.map((d) => d.getTime())))
    : null;
  const freshness = computeFreshness(latestSync);

  return subs.map((sub) => {
    const omniAccountId = ciMap.get(sub.customerId) ?? sub.customerId;
    const sfContractId = sfContractMap.get(sub.id) ?? null;

    // MRR from licensed items
    const licensedItems = sub.items.filter((i) => i.usageType === "licensed");
    const mrrCents = licensedItems.reduce(
      (sum, i) => sum + computeItemMrr(i.unitAmount, i.billingInterval, i.intervalCount, i.quantity),
      0,
    );

    // SF correlation status
    const hasSfContract = sfContractId != null;
    const matchedCount = sub.items.filter((i) => i.sfContractLineId != null).length;
    const sfCorrelationStatus: OmniSubscriptionFacts["sfCorrelationStatus"] =
      !hasSfContract ? "no_contract"
      : matchedCount === sub.items.length && sub.items.length > 0 ? "matched"
      : "partial";

    // Invoice coverage
    const lastInvoice = invoiceMap.get(sub.id);

    // Confidence flags
    const flags: ConfidenceFlagEntry[] = [];
    if (mrrCents === 0 && licensedItems.length > 0) {
      flags.push({ flag: "mrr_is_zero", detail: "Licensed items exist but MRR computes to zero" });
    }
    if (!hasSfContract) {
      flags.push({ flag: "no_sf_contract", detail: "No SF contract linked to this subscription" });
    }
    if (hasSfContract && sfCorrelationStatus === "partial") {
      flags.push({ flag: "sf_correlation_partial", detail: `${matchedCount}/${sub.items.length} items have SF line correlation` });
    }
    if (!lastInvoice) {
      flags.push({ flag: "no_paid_invoices", detail: "No paid invoices found for this subscription" });
    }
    if (sub.status === "past_due") {
      flags.push({ flag: "subscription_past_due", detail: "Subscription is past due" });
    }

    return {
      subscriptionId: sub.id,
      omniAccountId,
      stripeCustomerId: sub.customerId,
      status: sub.status,
      startDate: sub.startDate.toISOString(),
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAt: sub.cancelAt?.toISOString() ?? null,
      canceledAt: sub.canceledAt?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      itemCount: sub.items.length,
      mrrCents,
      arrCents: mrrCents * 12,
      sfContractId,
      sfCorrelationStatus,
      hasAnyPaidInvoice: lastInvoice != null,
      lastPaidInvoiceDate: lastInvoice?.paid_at?.toISOString().slice(0, 10) ?? null,
      lastPaidCoverageEnd: lastInvoice?.period_end?.toISOString().slice(0, 10) ?? null,
      freshness,
      confidenceFlags: flags,
    };
  });
}
