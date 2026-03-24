/**
 * Builder: Omni Scrub Monthly Accounts
 *
 * Queries StripeSubscription + StripeSubscriptionItem + CustomerIndex
 * for a given month and composes the canonical OmniScrubMonthlyAccount shape.
 *
 * Preserves the three-query pattern from subscription-scrub.ts:
 * 1. Canceled subs in the month
 * 2. Point-in-time snapshot subs (ARR baseline)
 * 3. New/replacement subs
 */

import { prisma } from "@omnibridge/db";
import { computeFreshness, computeCompositeFreshness } from "../contracts/shared-types";
import type { CompositeFreshnessInfo } from "../contracts/shared-types";
import { historicalActiveWhere } from "../utils/historical-active-state";
import type {
  OmniScrubMonthlyAccount,
  OmniScrubMonthlyData,
  OmniScrubMonthlySummary,
  ScrubClassification,
  ScrubSubscriptionRef,
} from "../contracts/omni-scrub-monthly-accounts";
import type { ConfidenceFlagEntry } from "../contracts/shared-types";

// ---------------------------------------------------------------------------
// MRR SQL (same formula used across the codebase)
// ---------------------------------------------------------------------------

const MRR_SQL = `
  CASE si.billing_interval
    WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
    WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
    WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
    WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
    ELSE 0
  END
`;

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface SubMrrRow {
  sub_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  canceled_at: Date | null;
  created: Date | null;
  sub_mrr: number; // dollars
}

// ---------------------------------------------------------------------------
// Snapshot date helper
// ---------------------------------------------------------------------------

function getSnapshotDate(month: string): Date {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 0, 23, 59, 59, 999));
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOmniScrubMonthlyAccounts(
  month: string,
): Promise<OmniScrubMonthlyData> {
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 1));
  const snapshotDate = getSnapshotDate(month);

  // Freshness: composite across all sources Scrub depends on
  const freshnessRows = await prisma.$queryRawUnsafe<{
    source_table: string;
    max_synced: Date | null;
  }[]>(
    `SELECT 'stripe_subscriptions' AS source_table, MAX(synced_at) AS max_synced FROM stripe_subscriptions
     UNION ALL
     SELECT 'stripe_invoices', MAX(synced_at) FROM stripe_invoices
     UNION ALL
     SELECT 'sf_contracts', MAX(synced_at) FROM sf_contracts`,
  );

  const sourceMap = new Map(freshnessRows.map((r) => [r.source_table, r.max_synced]));
  const compositeFreshness = computeCompositeFreshness([
    { source: "stripe_subscriptions", syncedAt: sourceMap.get("stripe_subscriptions") ?? null },
    { source: "stripe_invoices", syncedAt: sourceMap.get("stripe_invoices") ?? null },
    { source: "sf_contracts", syncedAt: sourceMap.get("sf_contracts") ?? null },
  ]);
  const freshness = compositeFreshness.overall;

  const emptySummary: OmniScrubMonthlySummary = {
    month,
    snapshotDate: snapshotDate.toISOString(),
    totalAccounts: 0,
    churned: 0,
    contracted: 0,
    offset: 0,
    expanded: 0,
    totalCanceledArrCents: 0,
    totalReplacementArrCents: 0,
    totalNetArrImpactCents: 0,
    freshness,
    compositeFreshness,
  };

  // 1. Canceled subs in the month with MRR > 0
  const canceledSubs = await prisma.$queryRawUnsafe<SubMrrRow[]>(
    `
    SELECT
      sub.id AS sub_id, sub.customer_id, sub.customer_name,
      'canceled' AS status, sub.canceled_at, sub.created,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.status = 'canceled'
      AND sub.canceled_at >= $1
      AND sub.canceled_at < $2
    GROUP BY sub.id
    HAVING SUM(CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN si.unit_amount ELSE 0 END) > 0
    ORDER BY sub_mrr DESC
    `,
    monthStart,
    monthEnd,
  );

  if (canceledSubs.length === 0) {
    return { rows: [], summary: emptySummary };
  }

  const customerIds = [...new Set(canceledSubs.map((s) => s.customer_id))];

  // 2. Snapshot subs (active on snapshot date)
  const snapshotSubs = await prisma.$queryRawUnsafe<SubMrrRow[]>(
    `
    SELECT
      sub.id AS sub_id, sub.customer_id, sub.customer_name,
      sub.status, sub.canceled_at, sub.created,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.customer_id = ANY($1)
      AND ${historicalActiveWhere("sub", "$2")}
    GROUP BY sub.id
    HAVING SUM(CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN si.unit_amount ELSE 0 END) > 0
    ORDER BY sub_mrr DESC
    `,
    customerIds,
    snapshotDate,
  );

  // 3. New active subs created during/after the month
  const newActiveSubs = await prisma.$queryRawUnsafe<SubMrrRow[]>(
    `
    SELECT
      sub.id AS sub_id, sub.customer_id, sub.customer_name,
      sub.status, sub.canceled_at, sub.created,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.customer_id = ANY($1)
      AND sub.status IN ('active', 'trialing', 'past_due')
      AND sub.created >= $2
    GROUP BY sub.id
    HAVING SUM(CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN si.unit_amount ELSE 0 END) > 0
    ORDER BY sub_mrr DESC
    `,
    customerIds,
    monthStart,
  );

  // 4. Resolve omniAccountId via CustomerIndex
  const ciRows = await prisma.customerIndex.findMany({
    where: { stripeCustomerId: { in: customerIds } },
    select: { id: true, stripeCustomerId: true, sfAccountId: true },
  });
  const ciMap = new Map(ciRows.map((r) => [r.stripeCustomerId, r]));

  // 5. Check SF correlation for active subs
  const activeSubIds = newActiveSubs.map((s) => s.sub_id);
  const sfLinks = activeSubIds.length > 0
    ? await prisma.sfContract.findMany({
        where: { stripeSubscriptionId: { in: activeSubIds } },
        select: { stripeSubscriptionId: true },
      })
    : [];
  const sfLinkedSubIds = new Set(sfLinks.map((l) => l.stripeSubscriptionId).filter(Boolean));

  function toRef(sub: SubMrrRow): ScrubSubscriptionRef {
    return {
      id: sub.sub_id,
      status: sub.status,
      mrrCents: Math.round(sub.sub_mrr * 100),
      canceledAt: sub.canceled_at?.toISOString() ?? null,
      createdAt: sub.created?.toISOString() ?? null,
    };
  }

  // Group by customer
  function groupByCustomer(subs: SubMrrRow[]): Map<string, SubMrrRow[]> {
    const map = new Map<string, SubMrrRow[]>();
    for (const sub of subs) {
      const list = map.get(sub.customer_id) ?? [];
      list.push(sub);
      map.set(sub.customer_id, list);
    }
    return map;
  }

  const canceledByCustomer = groupByCustomer(canceledSubs);
  const snapshotByCustomer = groupByCustomer(snapshotSubs);
  const newByCustomer = groupByCustomer(newActiveSubs);

  // 6. Build rows
  const rows: OmniScrubMonthlyAccount[] = [];

  for (const cusId of customerIds) {
    const canceled = canceledByCustomer.get(cusId) ?? [];
    const snapshot = snapshotByCustomer.get(cusId) ?? [];
    const newSubs = newByCustomer.get(cusId) ?? [];

    const canceledMrr = canceled.reduce((s, r) => s + r.sub_mrr, 0);
    const snapshotMrr = snapshot.reduce((s, r) => s + r.sub_mrr, 0);
    const newMrr = newSubs.reduce((s, r) => s + r.sub_mrr, 0);

    // Convert to cents (MRR is in dollars from SQL)
    const canceledArrCents = Math.round(canceledMrr * 12 * 100);
    const snapshotArrCents = Math.round(snapshotMrr * 12 * 100);
    const replacementArrCents = Math.round(newMrr * 12 * 100);
    const netArrImpactCents = replacementArrCents - canceledArrCents;

    // Classification
    let classification: ScrubClassification;
    if (snapshotMrr + newMrr === 0 && canceledMrr > 0) {
      classification = "churned";
    } else if (newMrr === 0) {
      classification = "contracted";
    } else if (replacementArrCents >= canceledArrCents) {
      classification = replacementArrCents > canceledArrCents ? "expanded" : "offset";
    } else {
      classification = "contracted";
    }

    const ci = ciMap.get(cusId);
    const omniAccountId = ci?.id ?? cusId;
    const customerName = canceled[0]?.customer_name ?? snapshot[0]?.customer_name ?? cusId;

    // Risk flags
    const hasSfCorrelationRisk = newSubs.some((s) => !sfLinkedSubIds.has(s.sub_id));

    // Confidence flags
    const flags: ConfidenceFlagEntry[] = [];
    if (!ci) flags.push({ flag: "no_stripe_customer", detail: "No CustomerIndex entry for this Stripe customer" });
    if (hasSfCorrelationRisk) flags.push({ flag: "sf_correlation_missing", detail: "Some active subs have no SF contract link" });
    if (freshness.state === "degraded") flags.push({ flag: "stale_mirror_data", detail: freshness.label });

    rows.push({
      omniAccountId,
      stripeCustomerId: cusId,
      month,
      displayName: customerName,
      snapshotDate: snapshotDate.toISOString(),
      snapshotArrCents,
      canceledArrCents,
      replacementArrCents,
      netArrImpactCents,
      classification,
      canceledSubscriptionCount: canceled.length,
      activeSubscriptionCountNow: newSubs.length,
      canceledSubs: canceled.map(toRef),
      snapshotSubs: snapshot.map(toRef),
      newSubs: newSubs.map(toRef),
      hasCoverageRisk: false, // set by detail builder
      hasSfCorrelationRisk,
      freshness,
      confidenceFlags: flags,
    });
  }

  rows.sort((a, b) => b.canceledArrCents - a.canceledArrCents);

  const summary: OmniScrubMonthlySummary = {
    month,
    snapshotDate: snapshotDate.toISOString(),
    totalAccounts: rows.length,
    churned: rows.filter((r) => r.classification === "churned").length,
    contracted: rows.filter((r) => r.classification === "contracted").length,
    offset: rows.filter((r) => r.classification === "offset").length,
    expanded: rows.filter((r) => r.classification === "expanded").length,
    totalCanceledArrCents: rows.reduce((s, r) => s + r.canceledArrCents, 0),
    totalReplacementArrCents: rows.reduce((s, r) => s + r.replacementArrCents, 0),
    totalNetArrImpactCents: rows.reduce((s, r) => s + r.netArrImpactCents, 0),
    freshness,
    compositeFreshness,
  };

  return { rows, summary };
}
