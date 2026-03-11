import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { MRR_CASE } from "./mrr-sql";

export type RenewalStatus =
  | "cancelling"
  | "scheduled_end"
  | "period_ending";

export interface RenewalCandidate {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  renewalStatus: RenewalStatus;
  mrr: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasSchedule: boolean;
  collectionMethod: string;
  items: RenewalCandidateItem[];
  metadata: Record<string, string>;
}

export interface RenewalCandidateItem {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number;
}

export interface RenewalsSummary {
  total: number;
  totalMrr: number;
  cancellingCount: number;
  cancellingMrr: number;
  scheduledEndCount: number;
  scheduledEndMrr: number;
  periodEndingCount: number;
  periodEndingMrr: number;
}

export interface RenewalsDashboardData {
  summary: RenewalsSummary;
  candidates: RenewalCandidate[];
}

interface SubRow {
  id: string;
  customer_id: string;
  customer_name: string;
  status: string;
  collection_method: string;
  currency: string;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancel_at: Date | null;
  has_schedule: boolean;
  metadata: Record<string, string> | null;
  sub_mrr: number;
}

function classifyRenewalStatus(row: SubRow): RenewalStatus {
  if (row.cancel_at_period_end || row.cancel_at) return "cancelling";
  if (row.has_schedule) return "scheduled_end";
  return "period_ending";
}

function parseMonth(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return { start, end };
}

/**
 * Get renewal candidates for a given month (format: "YYYY-MM").
 *
 * A subscription qualifies when:
 * - It is not already canceled
 * - AND one of:
 *   1. cancel_at_period_end = true and current_period_end in the month
 *   2. cancel_at falls within the month
 *   3. has_schedule = true and current_period_end in the month
 *   4. status is active/past_due and current_period_end in the month
 */
export async function getRenewalCandidates(
  month: string,
): Promise<RenewalsDashboardData> {
  const { start, end } = parseMonth(month);

  const subs = await prisma.$queryRaw<SubRow[]>`
    SELECT
      sub.id,
      sub.customer_id,
      sub.customer_name,
      sub.status,
      sub.collection_method,
      sub.currency,
      sub.current_period_end,
      sub.cancel_at_period_end,
      sub.cancel_at,
      sub.has_schedule,
      sub.metadata,
      ROUND(COALESCE(SUM(
        CASE WHEN si.usage_type = 'licensed' THEN ${MRR_CASE} ELSE 0 END
      ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
    FROM stripe_subscriptions sub
    LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
    WHERE sub.status NOT IN ('canceled', 'incomplete_expired', 'incomplete')
      AND (
        (sub.current_period_end >= ${start} AND sub.current_period_end < ${end})
        OR (sub.cancel_at IS NOT NULL AND sub.cancel_at >= ${start} AND sub.cancel_at < ${end})
      )
    GROUP BY sub.id
    ORDER BY sub_mrr DESC
  `;

  if (subs.length === 0) {
    return {
      summary: {
        total: 0,
        totalMrr: 0,
        cancellingCount: 0,
        cancellingMrr: 0,
        scheduledEndCount: 0,
        scheduledEndMrr: 0,
        periodEndingCount: 0,
        periodEndingMrr: 0,
      },
      candidates: [],
    };
  }

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

  let cancellingCount = 0,
    cancellingMrr = 0,
    scheduledEndCount = 0,
    scheduledEndMrr = 0,
    periodEndingCount = 0,
    periodEndingMrr = 0;

  const candidates: RenewalCandidate[] = subs.map((s) => {
    const renewalStatus = classifyRenewalStatus(s);
    const mrrCents = Math.round(s.sub_mrr * 100);

    switch (renewalStatus) {
      case "cancelling":
        cancellingCount++;
        cancellingMrr += mrrCents;
        break;
      case "scheduled_end":
        scheduledEndCount++;
        scheduledEndMrr += mrrCents;
        break;
      case "period_ending":
        periodEndingCount++;
        periodEndingMrr += mrrCents;
        break;
    }

    const subItems = itemsBySubId.get(s.id) ?? [];

    return {
      id: s.id,
      customerId: s.customer_id,
      customerName: s.customer_name,
      status: s.status,
      renewalStatus,
      mrr: mrrCents,
      currency: s.currency,
      currentPeriodEnd: s.current_period_end.toISOString(),
      cancelAt: s.cancel_at?.toISOString() ?? null,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      hasSchedule: s.has_schedule,
      collectionMethod: s.collection_method,
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

  const totalMrr = cancellingMrr + scheduledEndMrr + periodEndingMrr;

  return {
    summary: {
      total: candidates.length,
      totalMrr,
      cancellingCount,
      cancellingMrr,
      scheduledEndCount,
      scheduledEndMrr,
      periodEndingCount,
      periodEndingMrr,
    },
    candidates,
  };
}
