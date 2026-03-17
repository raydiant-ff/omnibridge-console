import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";

const TABLE_DISPLAY_LIMIT = 200;

// ── Inline MRR CASE (avoids Prisma.sql fragment interpolation issues) ──
// Converts unit_amount * quantity to monthly rate based on billing interval.
// Result is in raw currency units (cents). Divide by 100 for dollars.
const MRR_SQL = `
  CASE si.billing_interval
    WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
    WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
    WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
    WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
    ELSE 0
  END
`;

// ── Types (unchanged, still used by the dashboard UI) ──

export interface DashboardSubscriptionItem {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number;
}

export interface DashboardSubscription {
  id: string;
  status: string;
  customerName: string;
  customerId: string;
  mrr: number;
  currency: string;
  collectionMethod: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  cancellationFeedback: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  created: string;
  startDate: string;
  billingCycleAnchor: string;
  hasSchedule: boolean;
  hasDiscount: boolean;
  hasPaymentMethod: boolean;
  items: DashboardSubscriptionItem[];
  metadata: Record<string, string>;
}

export interface SubscriptionKpis {
  activeMrr: number;
  activeCount: number;
  pastDueCount: number;
  pastDueRevenue: number;
  churningCount: number;
  churningRevenue: number;
  trialingCount: number;
  avgTrialDaysRemaining: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export interface CollectionBreakdown {
  method: string;
  count: number;
  mrr: number;
}

export interface SubscriptionDashboardData {
  kpis: SubscriptionKpis;
  statusBreakdown: StatusBreakdown[];
  collectionBreakdown: CollectionBreakdown[];
  subscriptions: DashboardSubscription[];
  totalSubscriptionCount: number;
  source: "local";
}

// ── KPI queries ──

interface MrrRow { mrr: number }
interface CountRow { cnt: bigint }

async function queryActiveMrr(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<MrrRow[]>(`
    SELECT ROUND(COALESCE(SUM(${MRR_SQL}) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscription_items si
    JOIN stripe_subscriptions sub ON sub.id = si.subscription_id
    WHERE sub.status IN ('active', 'past_due')
      AND si.usage_type = 'licensed'
      AND sub.start_date <= NOW()
  `);
  return Math.round((rows[0]?.mrr ?? 0) * 100);
}

async function queryStatusCounts(): Promise<{ status: string; cnt: number; mrr: number }[]> {
  const rows = await prisma.$queryRawUnsafe<{ status: string; cnt: bigint; mrr: number }[]>(`
    SELECT
      sub.status,
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    GROUP BY sub.status
  `);
  return rows.map((r) => ({ status: r.status, cnt: Number(r.cnt), mrr: Math.round(r.mrr * 100) }));
}

async function queryChurning(): Promise<{ cnt: number; mrr: number }> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: bigint; mrr: number }[]>(`
    SELECT
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE (sub.cancel_at_period_end = true OR sub.cancel_at IS NOT NULL)
      AND sub.status NOT IN ('canceled', 'incomplete_expired')
  `);
  const r = rows[0];
  return { cnt: Number(r?.cnt ?? 0), mrr: Math.round((r?.mrr ?? 0) * 100) };
}

async function queryTrialing(): Promise<{ cnt: number; avgDays: number }> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: bigint; avg_days: number | null }[]>(`
    SELECT
      COUNT(*) AS cnt,
      AVG(GREATEST(EXTRACT(EPOCH FROM (trial_end - NOW())) / 86400.0, 0))::float AS avg_days
    FROM stripe_subscriptions
    WHERE status = 'trialing'
      AND trial_end IS NOT NULL
  `);
  const r = rows[0];
  return { cnt: Number(r?.cnt ?? 0), avgDays: Math.round(r?.avg_days ?? 0) };
}

async function queryCollectionBreakdown(): Promise<CollectionBreakdown[]> {
  const rows = await prisma.$queryRawUnsafe<{ method: string; cnt: bigint; mrr: number }[]>(`
    SELECT
      sub.collection_method AS method,
      COUNT(DISTINCT sub.id) AS cnt,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.status NOT IN ('canceled', 'incomplete_expired')
    GROUP BY sub.collection_method
  `);
  return rows.map((r) => ({
    method: r.method,
    count: Number(r.cnt),
    mrr: Math.round(r.mrr * 100),
  }));
}

async function queryTotalCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*) AS cnt FROM stripe_subscriptions
  `);
  return Number(rows[0]?.cnt ?? 0);
}

// ── Top subscriptions with items ──

interface SubRow {
  id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  collection_method: string;
  currency: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancel_at: Date | null;
  canceled_at: Date | null;
  trial_start: Date | null;
  trial_end: Date | null;
  start_date: Date;
  created: Date;
  billing_cycle_anchor: Date;
  has_schedule: boolean;
  has_discount: boolean;
  has_payment_method: boolean;
  metadata: Record<string, string> | null;
  sub_mrr: number;
}

async function queryTopSubscriptions(): Promise<DashboardSubscription[]> {
  const subs = await prisma.$queryRawUnsafe<SubRow[]>(`
    SELECT
      sub.id,
      sub.customer_id,
      sub.customer_name,
      sub.status,
      sub.collection_method,
      sub.currency,
      sub.current_period_start,
      sub.current_period_end,
      sub.cancel_at_period_end,
      sub.cancel_at,
      sub.canceled_at,
      sub.trial_start,
      sub.trial_end,
      sub.start_date,
      sub.created,
      sub.billing_cycle_anchor,
      sub.has_schedule,
      sub.has_discount,
      sub.has_payment_method,
      sub.metadata,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN ${MRR_SQL} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    GROUP BY sub.id
    ORDER BY sub_mrr DESC
    LIMIT ${TABLE_DISPLAY_LIMIT}
  `);

  if (subs.length === 0) return [];

  const subIds = subs.map((s) => s.id);
  const items = await prisma.stripeSubscriptionItem.findMany({
    where: { subscriptionId: { in: subIds } },
  });

  const itemsBySubId = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsBySubId.get(item.subscriptionId) ?? [];
    list.push(item);
    itemsBySubId.set(item.subscriptionId, list);
  }

  return subs.map((s) => {
    const subItems = itemsBySubId.get(s.id) ?? [];
    return {
      id: s.id,
      status: s.status,
      customerName: s.customer_name,
      customerId: s.customer_id,
      mrr: Math.round(s.sub_mrr * 100),
      currency: s.currency,
      collectionMethod: s.collection_method,
      currentPeriodStart: s.current_period_start.toISOString(),
      currentPeriodEnd: s.current_period_end.toISOString(),
      cancelAtPeriodEnd: s.cancel_at_period_end,
      cancelAt: s.cancel_at?.toISOString() ?? null,
      canceledAt: s.canceled_at?.toISOString() ?? null,
      cancellationReason: null,
      cancellationFeedback: null,
      trialStart: s.trial_start?.toISOString() ?? null,
      trialEnd: s.trial_end?.toISOString() ?? null,
      created: s.created.toISOString(),
      startDate: s.start_date.toISOString(),
      billingCycleAnchor: s.billing_cycle_anchor.toISOString(),
      hasSchedule: s.has_schedule,
      hasDiscount: s.has_discount,
      hasPaymentMethod: s.has_payment_method,
      items: subItems.map((si) => ({
        id: si.id,
        productName: si.productName,
        unitAmount: si.unitAmount,
        currency: si.currency,
        interval: si.billingInterval,
        intervalCount: si.intervalCount,
        quantity: si.quantity,
        mrr: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
      })),
      metadata: (s.metadata as Record<string, string>) ?? {},
    };
  });
}

// ── Public API ──

export async function getSubscriptionsDashboardData(): Promise<SubscriptionDashboardData> {
  const [
    activeMrr,
    statusRows,
    churning,
    trialing,
    collectionBreakdown,
    totalSubscriptionCount,
    subscriptions,
  ] = await Promise.all([
    queryActiveMrr(),
    queryStatusCounts(),
    queryChurning(),
    queryTrialing(),
    queryCollectionBreakdown(),
    queryTotalCount(),
    queryTopSubscriptions(),
  ]);

  const activeRow = statusRows.find((r) => r.status === "active");
  const pastDueRow = statusRows.find((r) => r.status === "past_due");

  return {
    kpis: {
      activeMrr,
      activeCount: activeRow?.cnt ?? 0,
      pastDueCount: pastDueRow?.cnt ?? 0,
      pastDueRevenue: pastDueRow?.mrr ?? 0,
      churningCount: churning.cnt,
      churningRevenue: churning.mrr,
      trialingCount: trialing.cnt,
      avgTrialDaysRemaining: trialing.avgDays,
    },
    statusBreakdown: statusRows.map((r) => ({ status: r.status, count: r.cnt })),
    collectionBreakdown,
    subscriptions,
    totalSubscriptionCount,
    source: "local",
  };
}
