/**
 * Builder: Omni Renewal Candidates
 *
 * Queries SfContract + SfAccount + StripeSubscription + StripeSubscriptionItem
 * and composes into the canonical OmniRenewalCandidate shape.
 *
 * Preserves the contract-led approach from cs-renewals.ts:
 * - Contracts are the source of timing (end_date = renewal date)
 * - Stripe subscriptions provide billing state and MRR
 * - MRR precedence: subscription items → contract lines → zero
 */

import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { computeDaysToExpiry } from "@/lib/repo";
import { computeFreshness } from "../contracts/shared-types";
import type {
  OmniRenewalCandidate,
  OmniRenewalSummary,
  OmniRenewalDashboardData,
  RenewalCandidateStatus,
  RenewalPriorityBucket,
  RiskReason,
  RenewalCandidateItem,
  LinkedContractInfo,
  BillingMode,
} from "../contracts/omni-renewal-candidates";
import type { ConfidenceFlagEntry, FreshnessInfo } from "../contracts/shared-types";

// ---------------------------------------------------------------------------
// Internal row types (from raw SQL)
// ---------------------------------------------------------------------------

interface ContractRow {
  id: string;
  account_id: string;
  account_name: string | null;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  contract_term: number | null;
  contract_number: string | null;
  owner_name: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  collection_method: string | null;
  mrr: number | null;
  arr: number | null;
  evergreen: boolean;
  do_not_renew: boolean;
  line_count: number;
  line_mrr: number;
  csm_name: string | null;
  customer_index_id: string | null;
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
  synced_at: Date | null;
}

// ---------------------------------------------------------------------------
// SQL fragments
// ---------------------------------------------------------------------------

const CONTRACT_SELECT = `
  SELECT
    c.id,
    c.account_id,
    c.account_name,
    c.status,
    c.start_date,
    c.end_date,
    c.contract_term,
    c.contract_number,
    c.owner_name,
    c.stripe_subscription_id,
    c.stripe_customer_id,
    c.collection_method,
    c.mrr,
    c.arr,
    c.evergreen,
    c.do_not_renew,
    (SELECT COUNT(*)::int FROM sf_contract_lines cl WHERE cl.contract_id = c.id) AS line_count,
    COALESCE((SELECT SUM(cl.mrr) FROM sf_contract_lines cl WHERE cl.contract_id = c.id), 0)::float AS line_mrr,
    sa.csm_name,
    ci.id AS customer_index_id
  FROM sf_contracts c
  LEFT JOIN sf_accounts sa ON sa.id = c.account_id
  LEFT JOIN customer_index ci ON ci.sf_account_id = c.account_id
`;

const SUB_SELECT = `
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
    sub.synced_at
  FROM stripe_subscriptions sub
  WHERE sub.id = ANY($1::text[])
`;

// ---------------------------------------------------------------------------
// CSM list
// ---------------------------------------------------------------------------

const EXCLUDED_CSMS = new Set([
  "Blake Reeves",
  "Franc Nebeolisah",
  "Stephanie Chow",
]);

export async function buildDistinctCsmNames(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ csm_name: string }[]>`
    SELECT DISTINCT a.csm_name
    FROM sf_accounts a
    WHERE a.csm_name IS NOT NULL AND a.csm_name != ''
    ORDER BY a.csm_name ASC
  `;
  return rows
    .map((r) => r.csm_name)
    .filter((n) => !EXCLUDED_CSMS.has(n))
    .sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Priority / status helpers
// ---------------------------------------------------------------------------

function classifyStatus(sub: SubRow): RenewalCandidateStatus {
  if (sub.cancel_at_period_end || sub.cancel_at) return "cancelling";
  if (sub.has_schedule) return "scheduled_end";
  return "period_ending";
}

function computePriorityBucket(daysToRenewal: number | null): RenewalPriorityBucket {
  if (daysToRenewal === null) return "on_track";
  if (daysToRenewal < 0) return "overdue";
  if (daysToRenewal === 0) return "due_today";
  if (daysToRenewal <= 7) return "due_soon";
  return "on_track";
}

function computeWorstRisk(
  sub: SubRow | undefined,
  contract: ContractRow,
  flags: ConfidenceFlagEntry[],
): RiskReason | null {
  if (sub?.status === "past_due") return "past_due_subscription";
  if (sub && (sub.cancel_at_period_end || sub.cancel_at)) return "cancelling";
  if (contract.do_not_renew) return "do_not_renew";
  if (!contract.stripe_subscription_id) return "no_linked_subscription";
  if (flags.some((f) => f.flag === "sf_correlation_missing")) return "sf_correlation_missing";
  return null;
}

// ---------------------------------------------------------------------------
// Build candidates from contract rows
// ---------------------------------------------------------------------------

async function buildFromContracts(
  contracts: ContractRow[],
  freshness: FreshnessInfo,
): Promise<{
  candidates: OmniRenewalCandidate[];
  summary: OmniRenewalSummary;
}> {
  // Fetch linked subscriptions
  const subIds = contracts
    .map((c) => c.stripe_subscription_id)
    .filter((id): id is string => id != null);
  const uniqueSubIds = [...new Set(subIds)];

  let subs: SubRow[] = [];
  if (uniqueSubIds.length > 0) {
    subs = await prisma.$queryRawUnsafe<SubRow[]>(SUB_SELECT, uniqueSubIds);
  }
  const subMap = new Map(subs.map((s) => [s.id, s]));

  // Fetch subscription items
  const items = uniqueSubIds.length > 0
    ? await prisma.stripeSubscriptionItem.findMany({
        where: { subscriptionId: { in: uniqueSubIds } },
      })
    : [];
  const itemsBySubId = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsBySubId.get(item.subscriptionId) ?? [];
    list.push(item);
    itemsBySubId.set(item.subscriptionId, list);
  }

  // Summary accumulators (actionable = Activated only)
  let cancellingCount = 0, cancellingMrr = 0,
    scheduledEndCount = 0, scheduledEndMrr = 0,
    periodEndingCount = 0, periodEndingMrr = 0,
    autoRenewCount = 0, reviewNeededCount = 0;

  const candidates: OmniRenewalCandidate[] = contracts.map((c) => {
    const linkedSub = c.stripe_subscription_id ? subMap.get(c.stripe_subscription_id) : undefined;
    const dueDate = c.end_date?.toISOString().slice(0, 10) ?? "";
    const daysToRenewal = computeDaysToExpiry(c.end_date);

    // MRR precedence: subscription items → contract lines → zero
    const subItems = linkedSub ? (itemsBySubId.get(linkedSub.id) ?? []) : [];
    const subMrr = subItems.reduce(
      (sum, si) => sum + computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
      0,
    );
    const mrrCents = subMrr > 0
      ? subMrr
      : c.line_mrr > 0
        ? Math.round(c.line_mrr * 100)
        : 0;

    // Status from subscription signals
    let status: RenewalCandidateStatus = "period_ending";
    if (linkedSub) {
      status = classifyStatus(linkedSub);
    }

    // Build item list
    const candidateItems: RenewalCandidateItem[] = subItems.map((si) => ({
      id: si.id,
      productName: si.productName,
      unitAmountCents: si.unitAmount,
      currency: si.currency,
      billingInterval: si.billingInterval,
      intervalCount: si.intervalCount,
      quantity: si.quantity,
      mrrCents: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
    }));

    // Contract info
    const contract: LinkedContractInfo = {
      id: c.id,
      accountId: c.account_id,
      accountName: c.account_name,
      contractNumber: c.contract_number,
      status: c.status,
      startDate: c.start_date?.toISOString().slice(0, 10) ?? null,
      endDate: c.end_date?.toISOString().slice(0, 10) ?? null,
      contractTerm: c.contract_term,
      ownerName: c.owner_name,
      mrrApprox: c.mrr,
      arrApprox: c.arr,
      evergreen: c.evergreen,
      doNotRenew: c.do_not_renew,
      daysToExpiry: daysToRenewal,
      collectionMethod: c.collection_method,
      lineCount: Number(c.line_count) || 0,
    };

    // Confidence flags
    const flags: ConfidenceFlagEntry[] = [];
    if (!c.stripe_subscription_id) {
      flags.push({ flag: "no_sf_contract", detail: "No Stripe subscription linked to this contract" });
    }
    if (subMrr === 0 && c.line_mrr > 0) {
      flags.push({ flag: "mrr_from_contract_lines", detail: "MRR sourced from SF contract lines (not subscription items)" });
    }
    if (mrrCents === 0) {
      flags.push({ flag: "mrr_is_zero", detail: "Could not compute MRR from any source" });
    }
    if (freshness.state === "degraded") {
      flags.push({ flag: "stale_mirror_data", detail: freshness.label });
    }

    const priorityBucket = computePriorityBucket(daysToRenewal);
    const worstRiskReason = computeWorstRisk(linkedSub, c, flags);

    // KPI tallies — actionable (Activated) only
    const isActionable = c.status === "Activated";
    if (isActionable) {
      switch (status) {
        case "cancelling": cancellingCount++; cancellingMrr += mrrCents; break;
        case "scheduled_end": scheduledEndCount++; scheduledEndMrr += mrrCents; break;
        case "period_ending": periodEndingCount++; periodEndingMrr += mrrCents; break;
      }

      const isAutoRenew = c.evergreen
        || (linkedSub && !linkedSub.cancel_at_period_end && !linkedSub.cancel_at && !linkedSub.has_schedule);
      if (isAutoRenew) autoRenewCount++;

      const needsReview = status === "cancelling"
        || (linkedSub && linkedSub.status === "past_due");
      if (needsReview) reviewNeededCount++;
    }

    const omniAccountId = c.customer_index_id
      ?? linkedSub?.customer_id
      ?? c.stripe_customer_id
      ?? c.account_id;

    return {
      candidateId: linkedSub ? `sub:${linkedSub.id}` : `contract:${c.id}`,
      omniAccountId,
      customerName: linkedSub?.customer_name ?? c.account_name ?? "Unknown",
      csmName: c.csm_name,
      sfContractId: c.id,
      subscriptionId: linkedSub?.id ?? null,
      billingMode: (linkedSub?.collection_method ?? c.collection_method ?? "charge_automatically") as BillingMode,
      items: candidateItems,
      renewalDate: dueDate,
      daysToRenewal,
      mrrCents,
      arrCents: mrrCents * 12,
      status,
      subscriptionStatus: linkedSub?.status ?? null,
      worstRiskReason: worstRiskReason,
      priorityBucket,
      contract,
      freshness,
      confidenceFlags: flags,
    };
  });

  candidates.sort((a, b) => b.mrrCents - a.mrrCents);

  const actionableTotal = cancellingCount + scheduledEndCount + periodEndingCount;
  const actionableMrr = cancellingMrr + scheduledEndMrr + periodEndingMrr;

  return {
    candidates,
    summary: {
      total: actionableTotal,
      totalMrr: actionableMrr,
      allCount: candidates.length,
      autoRenewCount,
      reviewNeededCount,
      cancellingCount,
      cancellingMrr,
      scheduledEndCount,
      scheduledEndMrr,
      periodEndingCount,
      periodEndingMrr,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function parseMonth(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  return {
    start: new Date(year, m - 1, 1),
    end: new Date(year, m, 1),
  };
}

export async function buildOmniRenewalDashboard(
  month: string,
  csmFilter: string | null = null,
): Promise<OmniRenewalDashboardData> {
  const { start, end } = parseMonth(month);

  const csmListPromise = buildDistinctCsmNames();

  // CSM WHERE clause
  const csmWhere = csmFilter
    ? csmFilter === "__unassigned__"
      ? `AND (sa.csm_name IS NULL OR sa.csm_name = '')`
      : `AND sa.csm_name = $3`
    : "";

  // 1. Month contracts (non-DNR, ending in selected month)
  const monthParams: unknown[] = [start, end];
  if (csmFilter && csmFilter !== "__unassigned__") monthParams.push(csmFilter);

  const monthContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
    ${CONTRACT_SELECT}
    WHERE c.do_not_renew = false
      AND c.end_date >= $1
      AND c.end_date < $2
      ${csmWhere}
    ORDER BY c.end_date ASC
  `, ...monthParams);

  // 2. Overdue contracts (Activated, past end_date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCsmWhere = csmFilter
    ? csmFilter === "__unassigned__"
      ? `AND (sa.csm_name IS NULL OR sa.csm_name = '')`
      : `AND sa.csm_name = $2`
    : "";
  const overdueParams: unknown[] = [today];
  if (csmFilter && csmFilter !== "__unassigned__") overdueParams.push(csmFilter);

  const overdueContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
    ${CONTRACT_SELECT}
    WHERE c.status = 'Activated'
      AND c.do_not_renew = false
      AND c.end_date < $1
      ${overdueCsmWhere}
    ORDER BY c.end_date ASC
  `, ...overdueParams);

  // Compute freshness from subscription sync times
  const allSubIds = [
    ...monthContracts.map((c) => c.stripe_subscription_id),
    ...overdueContracts.map((c) => c.stripe_subscription_id),
  ].filter((id): id is string => id != null);

  let freshness = computeFreshness(null);
  if (allSubIds.length > 0) {
    const freshnessRows = await prisma.$queryRawUnsafe<{ max_synced: Date | null }[]>(
      `SELECT MAX(synced_at) AS max_synced FROM stripe_subscriptions WHERE id = ANY($1)`,
      [...new Set(allSubIds)],
    );
    freshness = computeFreshness(freshnessRows[0]?.max_synced ?? null);
  }

  // Build candidates
  const [monthResult, overdueResult] = await Promise.all([
    buildFromContracts(monthContracts, freshness),
    buildFromContracts(overdueContracts, freshness),
  ]);

  const csmList = await csmListPromise;

  return {
    summary: {
      ...monthResult.summary,
      allCount: monthResult.candidates.length,
    },
    candidates: monthResult.candidates,
    overdue: overdueResult.candidates,
    csmList,
    freshness,
  };
}

export async function buildAllOmniRenewalCandidates(
  omniAccountIds?: string[],
): Promise<OmniRenewalCandidate[]> {
  const freshness = computeFreshness(null);

  let allContracts: ContractRow[];

  if (omniAccountIds?.length) {
    // Scoped: only contracts for the given accounts (via customer_index join)
    allContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
      ${CONTRACT_SELECT}
      WHERE c.do_not_renew = false
        AND c.status IN ('Activated', 'Draft')
        AND ci.id = ANY($1)
      ORDER BY c.end_date ASC
    `, omniAccountIds);
  } else {
    allContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
      ${CONTRACT_SELECT}
      WHERE c.do_not_renew = false
        AND c.status IN ('Activated', 'Draft')
      ORDER BY c.end_date ASC
    `);
  }

  const result = await buildFromContracts(allContracts, freshness);
  return result.candidates;
}
