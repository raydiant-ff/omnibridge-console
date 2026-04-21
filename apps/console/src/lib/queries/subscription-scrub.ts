/**
 * @deprecated
 * Superseded by canonical Omni contracts in `lib/omni/*`.
 * Route consumers should import from `lib/omni/adapters/scrub` instead.
 * Kept temporarily for parity comparison scripts only.
 */
"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { getSnapshotDate, computeFreshness } from "@/lib/scrub-helpers";
import type { FreshnessInfo } from "@/lib/scrub-helpers";

// ── MRR CASE (same formula used in subscriptions-dashboard.ts) ──
const MRR_SQL = `
  CASE si.billing_interval
    WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
    WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
    WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
    WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
    ELSE 0
  END
`;

// ── Types ──

export interface ScrubSubscription {
  id: string;
  status: string;
  customerName: string;
  canceledAt: string | null;
  createdAt: string;
  mrrCents: number;
  isNew?: boolean;
}

export interface ScrubRow {
  customerName: string;
  stripeCustomerId: string;
  sfAccountId: string | null;
  canceledSubs: ScrubSubscription[];
  canceledArrDollars: number;
  /** Subs contributing ARR on the snapshot date (last day of prev month) */
  snapshotSubs: ScrubSubscription[];
  snapshotArrDollars: number;
  /** Active subs created during or after the scrub month (potential replacements) */
  newSubs: ScrubSubscription[];
  newArrDollars: number;
  netArrDollars: number;
  totalActiveArrDollars: number;
  classification: "churned" | "contracted" | "offset" | "expanded";
}

export interface ScrubSummary {
  month: string;
  snapshotDate: string; // ISO — last day of prev month
  totalAccounts: number;
  churned: number;
  contracted: number;
  offset: number;
  expanded: number;
  totalCanceledArr: number;
  totalNewArr: number;
  totalNetArr: number;
  freshness: FreshnessInfo;
}

export interface ScrubData {
  rows: ScrubRow[];
  summary: ScrubSummary;
}

// ── Internal raw types ──

interface CanceledSubRow {
  sub_id: string;
  customer_id: string;
  customer_name: string;
  canceled_at: Date;
  sub_mrr: number;
}

interface SnapshotSubRow {
  sub_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  created: Date;
  sub_mrr: number;
}

interface ActiveSubRow {
  sub_id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  created: Date;
  sub_mrr: number;
}

// ── Query ──

export async function getSubscriptionScrub(month: string): Promise<ScrubData> {
  await requireSession();

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 1));
  const snapshotDate = getSnapshotDate(month);

  // Freshness: most recent synced_at across subscription mirror
  const freshnessRows = await prisma.$queryRawUnsafe<{ max_synced: Date | null }[]>(
    `SELECT MAX(synced_at) AS max_synced FROM stripe_subscriptions`,
  );
  const freshness = computeFreshness(freshnessRows[0]?.max_synced ?? null);

  const emptySummary: ScrubSummary = {
    month,
    snapshotDate: snapshotDate.toISOString(),
    totalAccounts: 0,
    churned: 0,
    contracted: 0,
    offset: 0,
    expanded: 0,
    totalCanceledArr: 0,
    totalNewArr: 0,
    totalNetArr: 0,
    freshness,
  };

  // 1. Subscriptions canceled in the scrub month with MRR > 0
  const canceledSubs = await prisma.$queryRawUnsafe<CanceledSubRow[]>(
    `
    SELECT
      sub.id AS sub_id,
      sub.customer_id,
      sub.customer_name,
      sub.canceled_at,
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

  // 2. Point-in-time snapshot: subs that were active on the snapshot date
  //    This captures what ARR the customer had at end of previous month,
  //    including subs that have since been canceled.
  const snapshotSubs = await prisma.$queryRawUnsafe<SnapshotSubRow[]>(
    `
    SELECT
      sub.id AS sub_id,
      sub.customer_id,
      sub.customer_name,
      sub.status,
      sub.created,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.customer_id = ANY($1)
      AND sub.start_date <= $2
      AND (sub.canceled_at IS NULL OR sub.canceled_at > $2)
      AND sub.status NOT IN ('incomplete', 'incomplete_expired')
    GROUP BY sub.id
    HAVING SUM(CASE WHEN si.usage_type = 'licensed' AND si.unit_amount > 0 THEN si.unit_amount ELSE 0 END) > 0
    ORDER BY sub_mrr DESC
    `,
    customerIds,
    snapshotDate,
  );

  // 3. Currently active subs created during/after scrub month (new/replacement)
  const newActiveSubs = await prisma.$queryRawUnsafe<ActiveSubRow[]>(
    `
    SELECT
      sub.id AS sub_id,
      sub.customer_id,
      sub.customer_name,
      sub.status,
      sub.created,
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

  // 4. Resolve SF Account IDs
  const customerIndexRows = await prisma.customerIndex.findMany({
    where: { stripeCustomerId: { in: customerIds } },
    select: { stripeCustomerId: true, sfAccountId: true },
  });
  const sfMap = new Map(
    customerIndexRows.map((r) => [r.stripeCustomerId, r.sfAccountId]),
  );

  // 5. Group by customer
  const canceledByCustomer = new Map<string, CanceledSubRow[]>();
  for (const sub of canceledSubs) {
    const list = canceledByCustomer.get(sub.customer_id) ?? [];
    list.push(sub);
    canceledByCustomer.set(sub.customer_id, list);
  }

  const snapshotByCustomer = new Map<string, SnapshotSubRow[]>();
  for (const sub of snapshotSubs) {
    const list = snapshotByCustomer.get(sub.customer_id) ?? [];
    list.push(sub);
    snapshotByCustomer.set(sub.customer_id, list);
  }

  const newByCustomer = new Map<string, ActiveSubRow[]>();
  for (const sub of newActiveSubs) {
    const list = newByCustomer.get(sub.customer_id) ?? [];
    list.push(sub);
    newByCustomer.set(sub.customer_id, list);
  }

  // 6. Build rows
  const rows: ScrubRow[] = [];

  for (const cusId of customerIds) {
    const canceled = canceledByCustomer.get(cusId) ?? [];
    const snapshot = snapshotByCustomer.get(cusId) ?? [];
    const newSubs = newByCustomer.get(cusId) ?? [];

    const canceledMrr = canceled.reduce((s, r) => s + r.sub_mrr, 0);
    const snapshotMrr = snapshot.reduce((s, r) => s + r.sub_mrr, 0);
    const newMrr = newSubs.reduce((s, r) => s + r.sub_mrr, 0);

    const canceledArr = Math.round(canceledMrr * 12 * 100) / 100;
    const snapshotArr = Math.round(snapshotMrr * 12 * 100) / 100;
    const newArr = Math.round(newMrr * 12 * 100) / 100;
    const totalActiveArr = Math.round((snapshotMrr + newMrr) * 12 * 100) / 100;
    const netArr = Math.round((newArr - canceledArr) * 100) / 100;

    let classification: ScrubRow["classification"];
    if (snapshotMrr + newMrr === 0 && canceledMrr > 0) {
      classification = "churned";
    } else if (newMrr === 0) {
      classification = "contracted";
    } else if (newArr >= canceledArr) {
      classification = newArr > canceledArr ? "expanded" : "offset";
    } else {
      classification = "contracted";
    }

    const customerName =
      canceled[0]?.customer_name ?? snapshot[0]?.customer_name ?? cusId;

    rows.push({
      customerName,
      stripeCustomerId: cusId,
      sfAccountId: sfMap.get(cusId) ?? null,
      canceledSubs: canceled.map((s) => ({
        id: s.sub_id,
        status: "canceled",
        customerName: s.customer_name,
        canceledAt: s.canceled_at.toISOString(),
        createdAt: "",
        mrrCents: Math.round(s.sub_mrr * 100),
      })),
      canceledArrDollars: canceledArr,
      snapshotSubs: snapshot.map((s) => ({
        id: s.sub_id,
        status: s.status,
        customerName: s.customer_name,
        canceledAt: null,
        createdAt: s.created.toISOString(),
        mrrCents: Math.round(s.sub_mrr * 100),
      })),
      snapshotArrDollars: snapshotArr,
      newSubs: newSubs.map((s) => ({
        id: s.sub_id,
        status: s.status,
        customerName: s.customer_name,
        canceledAt: null,
        createdAt: s.created.toISOString(),
        mrrCents: Math.round(s.sub_mrr * 100),
        isNew: true,
      })),
      newArrDollars: newArr,
      netArrDollars: netArr,
      totalActiveArrDollars: totalActiveArr,
      classification,
    });
  }

  rows.sort((a, b) => b.canceledArrDollars - a.canceledArrDollars);

  const summary: ScrubSummary = {
    month,
    snapshotDate: snapshotDate.toISOString(),
    totalAccounts: rows.length,
    churned: rows.filter((r) => r.classification === "churned").length,
    contracted: rows.filter((r) => r.classification === "contracted").length,
    offset: rows.filter((r) => r.classification === "offset").length,
    expanded: rows.filter((r) => r.classification === "expanded").length,
    totalCanceledArr: Math.round(rows.reduce((s, r) => s + r.canceledArrDollars, 0) * 100) / 100,
    totalNewArr: Math.round(rows.reduce((s, r) => s + r.newArrDollars, 0) * 100) / 100,
    totalNetArr: Math.round(rows.reduce((s, r) => s + r.netArrDollars, 0) * 100) / 100,
    freshness,
  };

  return { rows, summary };
}
