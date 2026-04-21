/**
 * Builder: Omni Account Spine
 *
 * Queries CustomerIndex + SfAccount + StripeCustomer + StripeSubscription + StripeInvoice
 * and composes into the canonical OmniAccountSpine shape.
 */

import { prisma } from "@omnibridge/db";
import { computeMrrCents } from "@/lib/repo";
import { computeFreshness } from "../contracts/shared-types";
import type { OmniAccountSpine } from "../contracts/omni-account-spine";
import type { ConfidenceFlagEntry } from "../contracts/shared-types";
import { ensureCustomerIndexCoverage } from "../utils/ensure-customer-index-coverage";

export async function buildOmniAccountSpines(
  customerIndexIds?: string[],
): Promise<OmniAccountSpine[]> {
  // ensureCustomerIndexCoverage() removed from hot read path — it runs
  // hundreds of sequential UPDATE queries and blocks page loads for minutes.
  // Now runs in the SF sync cron (/api/cron/sf-sync) instead.

  const whereClause = customerIndexIds?.length
    ? { id: { in: customerIndexIds } }
    : {};

  const ciRows = await prisma.customerIndex.findMany({
    where: whereClause,
    select: {
      id: true,
      sfAccountId: true,
      sfAccountName: true,
      stripeCustomerId: true,
      domain: true,
    },
  });

  if (ciRows.length === 0) return [];

  // Batch fetch SF accounts
  const sfIds = ciRows.map((r) => r.sfAccountId).filter((id): id is string => id != null);
  const sfAccounts = sfIds.length > 0
    ? await prisma.sfAccount.findMany({
        where: { id: { in: sfIds }, isStub: false },
        select: {
          id: true, name: true, ownerName: true, csmName: true,
          status: true, domain: true, syncedAt: true,
        },
      })
    : [];
  const sfMap = new Map(sfAccounts.map((a) => [a.id, a]));

  // Batch fetch Stripe customers
  const stripeIds = ciRows.map((r) => r.stripeCustomerId).filter((id): id is string => id != null);
  const stripeCustomers = stripeIds.length > 0
    ? await prisma.stripeCustomer.findMany({
        where: { id: { in: stripeIds } },
        select: { id: true, name: true, syncedAt: true },
      })
    : [];
  const stripeMap = new Map(stripeCustomers.map((c) => [c.id, c]));

  // Batch fetch active subscriptions with items
  const activeSubs = stripeIds.length > 0
    ? await prisma.stripeSubscription.findMany({
        where: {
          customerId: { in: stripeIds },
          status: { in: ["active", "trialing", "past_due"] },
        },
        include: {
          items: {
            select: {
              unitAmount: true, quantity: true,
              billingInterval: true, intervalCount: true,
              usageType: true,
            },
          },
        },
      })
    : [];

  const subsByCustomer = new Map<string, typeof activeSubs>();
  for (const sub of activeSubs) {
    const list = subsByCustomer.get(sub.customerId) ?? [];
    list.push(sub);
    subsByCustomer.set(sub.customerId, list);
  }

  // Batch fetch invoice counts
  const invoiceAggs = stripeIds.length > 0
    ? await prisma.$queryRawUnsafe<{
        customer_id: string;
        past_due_count: number;
        open_count: number;
        last_invoice_date: Date | null;
        last_payment_date: Date | null;
      }[]>(
        `
        SELECT
          i.customer_id,
          COUNT(*) FILTER (WHERE i.status = 'open' AND i.due_date < NOW()) AS past_due_count,
          COUNT(*) FILTER (WHERE i.status = 'open') AS open_count,
          MAX(i.stripe_created) AS last_invoice_date,
          MAX(i.paid_at) FILTER (WHERE i.status = 'paid') AS last_payment_date
        FROM stripe_invoices i
        WHERE i.customer_id = ANY($1)
        GROUP BY i.customer_id
        `,
        stripeIds,
      )
    : [];
  const invoiceMap = new Map(invoiceAggs.map((r) => [r.customer_id, r]));

  return ciRows.map((ci) => {
    const sf = ci.sfAccountId ? sfMap.get(ci.sfAccountId) : undefined;
    const stripe = ci.stripeCustomerId ? stripeMap.get(ci.stripeCustomerId) : undefined;
    const custSubs = ci.stripeCustomerId ? (subsByCustomer.get(ci.stripeCustomerId) ?? []) : [];
    const invoiceAgg = ci.stripeCustomerId ? invoiceMap.get(ci.stripeCustomerId) : undefined;

    // Per-account freshness: conservative rollup from account-scoped sources
    const accountSyncTimes: Date[] = [];
    if (sf?.syncedAt) accountSyncTimes.push(sf.syncedAt);
    if (stripe?.syncedAt) accountSyncTimes.push(stripe.syncedAt);
    for (const sub of custSubs) if (sub.syncedAt) accountSyncTimes.push(sub.syncedAt);
    // Use the OLDEST sync time (most conservative) — if any source is stale, the account is stale
    const oldestSync = accountSyncTimes.length > 0
      ? new Date(Math.min(...accountSyncTimes.map((d) => d.getTime())))
      : null;
    const freshness = computeFreshness(oldestSync);

    // MRR from all active subscription items (licensed only)
    const allItems = custSubs.flatMap((s) =>
      s.items.filter((i) => i.usageType === "licensed"),
    );
    const mrrCents = computeMrrCents(allItems);
    const arrCents = mrrCents * 12;

    // Display name precedence: SF → CI snapshot → Stripe → "Unknown"
    const displayName = sf?.name ?? ci.sfAccountName ?? stripe?.name ?? "Unknown";

    // Confidence flags
    const flags: ConfidenceFlagEntry[] = [];
    if (!ci.stripeCustomerId) flags.push({ flag: "no_stripe_customer", detail: "No Stripe customer linked in CustomerIndex" });
    if (!ci.sfAccountId) flags.push({ flag: "no_sf_account", detail: "No Salesforce account linked in CustomerIndex" });
    if (ci.sfAccountId && !sf) flags.push({ flag: "sf_account_is_stub", detail: "SF account exists but is a stub record" });
    if (custSubs.length === 0 && ci.stripeCustomerId) flags.push({ flag: "no_active_subscription", detail: "No active subscriptions for this customer" });
    if (custSubs.some((s) => s.status === "past_due")) flags.push({ flag: "subscription_past_due", detail: "At least one subscription is past due" });
    if (mrrCents === 0 && custSubs.length > 0) flags.push({ flag: "mrr_is_zero", detail: "Active subscriptions exist but computed MRR is zero" });
    if (freshness.state === "degraded") flags.push({ flag: "stale_mirror_data", detail: freshness.label });

    return {
      omniAccountId: ci.id,
      displayName,
      sfAccountId: ci.sfAccountId,
      stripeCustomerId: ci.stripeCustomerId,
      domain: sf?.domain ?? ci.domain ?? null,
      accountOwnerName: sf?.ownerName ?? null,
      csmName: sf?.csmName ?? null,
      accountStatus: sf?.status ?? null,
      activeSubscriptionCount: custSubs.length,
      activeMrrCents: mrrCents,
      activeArrCents: arrCents,
      pastDueInvoiceCount: Number(invoiceAgg?.past_due_count ?? 0),
      openInvoiceCount: Number(invoiceAgg?.open_count ?? 0),
      lastInvoiceDate: invoiceAgg?.last_invoice_date?.toISOString().slice(0, 10) ?? null,
      lastPaymentDate: invoiceAgg?.last_payment_date?.toISOString().slice(0, 10) ?? null,
      freshness,
      confidenceFlags: flags,
    };
  });
}
