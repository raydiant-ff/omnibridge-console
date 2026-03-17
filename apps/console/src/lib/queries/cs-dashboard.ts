// ⚠️  LEGACY — pre-projection CS dashboard queries. Do not extend.
// New CS dashboard reads belong in lib/projections/ once the CS workspace is wired.

import { prisma } from "@omnibridge/db";

export interface CsDashboardKpis {
  activeAccounts: number;
  activeSubscriptions: number;
  activeMrr: number;
  pastDueCount: number;
  pastDueRevenue: number;
  churningCount: number;
  churningRevenue: number;
  expiringThisMonth: number;
  expiringThisMonthRevenue: number;
  expiringNextMonth: number;
  expiringNextMonthRevenue: number;
}

interface MrrRow {
  mrr: number;
}
interface CountRow {
  cnt: bigint;
}
interface CountMrrRow {
  cnt: bigint;
  mrr: number;
}

function monthRange(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

async function queryActiveAccounts(): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(DISTINCT customer_id) AS cnt
    FROM stripe_subscriptions
    WHERE status IN ('active', 'trialing')
  `;
  return Number(rows[0]?.cnt ?? 0);
}

async function queryActiveSubscriptions(): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*) AS cnt
    FROM stripe_subscriptions
    WHERE status IN ('active', 'trialing')
  `;
  return Number(rows[0]?.cnt ?? 0);
}

async function queryActiveMrr(): Promise<number> {
  const rows = await prisma.$queryRaw<MrrRow[]>`
    SELECT ROUND(COALESCE(SUM(
      CASE si.billing_interval
        WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
        WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
        WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
        WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
        ELSE 0
      END
    ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscription_items si
    JOIN stripe_subscriptions sub ON sub.id = si.subscription_id
    WHERE sub.status IN ('active', 'past_due')
      AND si.usage_type = 'licensed'
      AND sub.start_date <= NOW()
  `;
  return Math.round((rows[0]?.mrr ?? 0) * 100);
}

async function queryPastDue(): Promise<{ cnt: number; mrr: number }> {
  const rows = await prisma.$queryRaw<CountMrrRow[]>`
    SELECT
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN
          CASE si.billing_interval
            WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
            WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
            WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
            WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
            ELSE 0
          END
        ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.status = 'past_due'
  `;
  const r = rows[0];
  return { cnt: Number(r?.cnt ?? 0), mrr: Math.round((r?.mrr ?? 0) * 100) };
}

async function queryChurning(): Promise<{ cnt: number; mrr: number }> {
  const rows = await prisma.$queryRaw<CountMrrRow[]>`
    SELECT
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN
          CASE si.billing_interval
            WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
            WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
            WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
            WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
            ELSE 0
          END
        ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE (sub.cancel_at_period_end = true OR sub.cancel_at IS NOT NULL)
      AND sub.status NOT IN ('canceled', 'incomplete_expired')
  `;
  const r = rows[0];
  return { cnt: Number(r?.cnt ?? 0), mrr: Math.round((r?.mrr ?? 0) * 100) };
}

async function queryExpiringInMonth(
  monthStart: Date,
  monthEnd: Date,
): Promise<{ cnt: number; mrr: number }> {
  const rows = await prisma.$queryRaw<CountMrrRow[]>`
    SELECT
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN
          CASE si.billing_interval
            WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
            WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
            WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
            WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
            ELSE 0
          END
        ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.status NOT IN ('canceled', 'incomplete_expired')
      AND (
        (sub.cancel_at_period_end = true AND sub.current_period_end >= ${monthStart} AND sub.current_period_end < ${monthEnd})
        OR (sub.cancel_at IS NOT NULL AND sub.cancel_at >= ${monthStart} AND sub.cancel_at < ${monthEnd})
        OR (sub.has_schedule = true AND sub.current_period_end >= ${monthStart} AND sub.current_period_end < ${monthEnd})
      )
  `;
  const r = rows[0];
  return { cnt: Number(r?.cnt ?? 0), mrr: Math.round((r?.mrr ?? 0) * 100) };
}

export async function getCsDashboardKpis(): Promise<CsDashboardKpis> {
  const thisMonth = monthRange(0);
  const nextMonth = monthRange(1);

  const [
    activeAccounts,
    activeSubscriptions,
    activeMrr,
    pastDue,
    churning,
    expiringThis,
    expiringNext,
  ] = await Promise.all([
    queryActiveAccounts(),
    queryActiveSubscriptions(),
    queryActiveMrr(),
    queryPastDue(),
    queryChurning(),
    queryExpiringInMonth(thisMonth.start, thisMonth.end),
    queryExpiringInMonth(nextMonth.start, nextMonth.end),
  ]);

  return {
    activeAccounts,
    activeSubscriptions,
    activeMrr,
    pastDueCount: pastDue.cnt,
    pastDueRevenue: pastDue.mrr,
    churningCount: churning.cnt,
    churningRevenue: churning.mrr,
    expiringThisMonth: expiringThis.cnt,
    expiringThisMonthRevenue: expiringThis.mrr,
    expiringNextMonth: expiringNext.cnt,
    expiringNextMonthRevenue: expiringNext.mrr,
  };
}
