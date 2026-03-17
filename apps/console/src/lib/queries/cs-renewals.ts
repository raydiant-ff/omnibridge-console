// ⚠️  QUARANTINE — do not extend this file.
// Uses $queryRawUnsafe. Any new renewal reads must go through lib/projections/renewal-view.ts.
// Parameterization has been verified but the raw SQL surface should not grow.

import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { computeDaysToExpiry } from "@/lib/repo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Signal = "upcoming" | "due_soon" | "past_due";

export type RenewalStatus =
  | "cancelling"
  | "scheduled_end"
  | "period_ending";

export interface LinkedContract {
  id: string;
  accountId: string;
  accountName: string | null;
  contractNumber: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  contractTerm: number | null;
  ownerName: string | null;
  mrr: number | null;
  arr: number | null;
  evergreen: boolean;
  doNotRenew: boolean;
  daysTillExpiry: number | null;
  collectionMethod: string | null;
  lineCount: number;
}

export interface RenewalCandidate {
  id: string; // subscription ID (or contract ID if no linked sub)
  candidateId: string; // stable composite key: sub:{subId} or contract:{contractId}
  customerId: string;
  customerName: string;
  csmName: string | null;
  status: string;
  renewalStatus: RenewalStatus;
  signal: Signal;
  mrr: number; // cents
  currency: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasSchedule: boolean;
  collectionMethod: string;
  items: RenewalCandidateItem[];
  metadata: Record<string, string>;
  // Enrichment
  contract: LinkedContract | null;
  dueDate: string; // always contract end_date
  dueBasis: "contract" | "subscription";
  // Subscription status for table display
  subscriptionStatus: string | null;
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
  total: number; // actionable only (Activated)
  totalMrr: number; // actionable only
  allCount: number; // total rows in table (incl. canceled)
  autoRenewCount: number;
  reviewNeededCount: number;
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
  overdue: RenewalCandidate[]; // Activated contracts past end_date
  csmList: string[]; // distinct CSM names for filter dropdown
}

// ---------------------------------------------------------------------------
// Internal row types
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
  line_mrr: number; // SUM of sf_contract_lines.mrr
  csm_name: string | null;
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

function parseMonth(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return { start, end };
}

function computeSignal(endDateStr: string): Signal {
  if (!endDateStr) return "past_due";
  const end = new Date(endDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "past_due";
  if (diffDays <= 7) return "due_soon";
  return "upcoming";
}

function classifyRenewalStatus(sub: SubRow): RenewalStatus {
  if (sub.cancel_at_period_end || sub.cancel_at) return "cancelling";
  if (sub.has_schedule) return "scheduled_end";
  return "period_ending";
}

// ---------------------------------------------------------------------------
// CSM list query (distinct CSM names across accounts)
// ---------------------------------------------------------------------------

const EXCLUDED_CSMS = new Set([
  "Blake Reeves",
  "Franc Nebeolisah",
  "Stephanie Chow",
]);

export async function getDistinctCsmNames(): Promise<string[]> {
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
// Shared contract query builder
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
    sa.csm_name
  FROM sf_contracts c
  LEFT JOIN sf_accounts sa ON sa.id = c.account_id
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
    sub.metadata,
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
    ) / 100.0, 0)::numeric, 2)::float AS sub_mrr
  FROM stripe_subscriptions sub
  LEFT JOIN stripe_subscription_items si ON si.subscription_id = sub.id
  WHERE sub.id = ANY($1::text[])
  GROUP BY sub.id
`;

// ---------------------------------------------------------------------------
// Build candidates from contract rows + linked subs
// ---------------------------------------------------------------------------

async function buildCandidatesFromContracts(
  contracts: ContractRow[],
): Promise<{
  candidates: RenewalCandidate[];
  actionableSummary: {
    total: number; totalMrr: number; autoRenewCount: number; reviewNeededCount: number;
    cancellingCount: number; cancellingMrr: number;
    scheduledEndCount: number; scheduledEndMrr: number;
    periodEndingCount: number; periodEndingMrr: number;
  };
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

  // Summary accumulators — actionable (Activated) only
  let cancellingCount = 0, cancellingMrr = 0,
    scheduledEndCount = 0, scheduledEndMrr = 0,
    periodEndingCount = 0, periodEndingMrr = 0,
    autoRenewCount = 0, reviewNeededCount = 0;

  function mapContract(c: ContractRow): LinkedContract {
    return {
      id: c.id,
      accountId: c.account_id,
      accountName: c.account_name,
      contractNumber: c.contract_number,
      status: c.status,
      startDate: c.start_date?.toISOString().slice(0, 10) ?? null,
      endDate: c.end_date?.toISOString().slice(0, 10) ?? null,
      contractTerm: c.contract_term,
      ownerName: c.owner_name,
      mrr: c.mrr,
      arr: c.arr,
      evergreen: c.evergreen,
      doNotRenew: c.do_not_renew,
      daysTillExpiry: computeDaysToExpiry(c.end_date),
      collectionMethod: c.collection_method,
      lineCount: Number(c.line_count) || 0,
    };
  }

  const candidates: RenewalCandidate[] = contracts.map((c) => {
    const linkedSub = c.stripe_subscription_id ? subMap.get(c.stripe_subscription_id) : undefined;
    const dueDate = c.end_date?.toISOString().slice(0, 10) ?? "";
    const signal = computeSignal(dueDate);

    // MRR precedence: subscription MRR → contract line MRR → zero
    const mrrCents = linkedSub && linkedSub.sub_mrr > 0
      ? Math.round(linkedSub.sub_mrr * 100)
      : c.line_mrr > 0
        ? Math.round(c.line_mrr * 100)
        : 0;

    // Renewal status from subscription signals
    let renewalStatus: RenewalStatus = "period_ending";
    if (linkedSub) {
      renewalStatus = classifyRenewalStatus(linkedSub);
    }

    // KPI tallies — only for actionable (Activated) contracts
    const isActionable = c.status === "Activated";
    if (isActionable) {
      switch (renewalStatus) {
        case "cancelling":
          cancellingCount++; cancellingMrr += mrrCents; break;
        case "scheduled_end":
          scheduledEndCount++; scheduledEndMrr += mrrCents; break;
        case "period_ending":
          periodEndingCount++; periodEndingMrr += mrrCents; break;
      }

      const isAutoRenew = c.evergreen
        || (linkedSub && !linkedSub.cancel_at_period_end && !linkedSub.cancel_at && !linkedSub.has_schedule);
      if (isAutoRenew) autoRenewCount++;

      const needsReview = renewalStatus === "cancelling"
        || (linkedSub && linkedSub.status === "past_due");
      if (needsReview) reviewNeededCount++;
    }

    const subItems = linkedSub ? (itemsBySubId.get(linkedSub.id) ?? []) : [];

    return {
      id: linkedSub?.id ?? c.id,
      candidateId: linkedSub ? `sub:${linkedSub.id}` : `contract:${c.id}`,
      customerId: linkedSub?.customer_id ?? c.stripe_customer_id ?? c.account_id,
      customerName: linkedSub?.customer_name ?? c.account_name ?? "Unknown",
      csmName: c.csm_name,
      status: linkedSub?.status ?? c.status,
      renewalStatus,
      signal,
      mrr: mrrCents,
      currency: linkedSub?.currency ?? "usd",
      currentPeriodEnd: linkedSub?.current_period_end.toISOString() ?? c.end_date?.toISOString() ?? "",
      cancelAt: linkedSub?.cancel_at?.toISOString() ?? null,
      cancelAtPeriodEnd: linkedSub?.cancel_at_period_end ?? false,
      hasSchedule: linkedSub?.has_schedule ?? false,
      collectionMethod: linkedSub?.collection_method ?? c.collection_method ?? "charge_automatically",
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
      metadata: (linkedSub?.metadata as Record<string, string>) ?? {},
      contract: mapContract(c),
      dueDate,
      dueBasis: "contract" as const,
      subscriptionStatus: linkedSub?.status ?? null,
    };
  });

  candidates.sort((a, b) => b.mrr - a.mrr);

  const actionableTotal = cancellingCount + scheduledEndCount + periodEndingCount;
  const actionableMrr = cancellingMrr + scheduledEndMrr + periodEndingMrr;

  return {
    candidates,
    actionableSummary: {
      total: actionableTotal,
      totalMrr: actionableMrr,
      autoRenewCount,
      reviewNeededCount,
      cancellingCount, cancellingMrr,
      scheduledEndCount, scheduledEndMrr,
      periodEndingCount, periodEndingMrr,
    },
  };
}

// ---------------------------------------------------------------------------
// Main query — contract-led
// ---------------------------------------------------------------------------

export async function getRenewalCandidates(
  month: string,
  csmFilter: string | null = null,
): Promise<RenewalsDashboardData> {
  const { start, end } = parseMonth(month);

  // Fetch CSM list in parallel
  const csmListPromise = getDistinctCsmNames();

  // Build CSM WHERE clause
  const csmWhere = csmFilter
    ? csmFilter === "__unassigned__"
      ? `AND (sa.csm_name IS NULL OR sa.csm_name = '')`
      : `AND sa.csm_name = $3`
    : "";

  // 1. Month contracts — all non-DNR contracts ending in selected month (incl. canceled)
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

  // 2. Overdue contracts — Activated with end_date < today (separate section)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueParams: unknown[] = [today];
  const overdueCsmWhere = csmFilter
    ? csmFilter === "__unassigned__"
      ? `AND (sa.csm_name IS NULL OR sa.csm_name = '')`
      : `AND sa.csm_name = $2`
    : "";
  if (csmFilter && csmFilter !== "__unassigned__") overdueParams.push(csmFilter);

  const overdueContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
    ${CONTRACT_SELECT}
    WHERE c.status = 'Activated'
      AND c.do_not_renew = false
      AND c.end_date < $1
      ${overdueCsmWhere}
    ORDER BY c.end_date ASC
  `, ...overdueParams);

  // 3. Build candidates for both sets
  const [monthResult, overdueResult] = await Promise.all([
    buildCandidatesFromContracts(monthContracts),
    buildCandidatesFromContracts(overdueContracts),
  ]);

  const csmList = await csmListPromise;

  return {
    summary: {
      ...monthResult.actionableSummary,
      allCount: monthResult.candidates.length,
    },
    candidates: monthResult.candidates,
    overdue: overdueResult.candidates,
    csmList,
  };
}

// ---------------------------------------------------------------------------
// All renewals query (for reports — no month filter)
// ---------------------------------------------------------------------------

export async function getAllRenewalCandidates(): Promise<RenewalCandidate[]> {
  const allContracts = await prisma.$queryRawUnsafe<ContractRow[]>(`
    ${CONTRACT_SELECT}
    WHERE c.do_not_renew = false
      AND c.status IN ('Activated', 'Draft')
    ORDER BY c.end_date ASC
  `);

  const result = await buildCandidatesFromContracts(allContracts);
  return result.candidates;
}

// ---------------------------------------------------------------------------
// Detail query: load a single renewal candidate by candidateId
// ---------------------------------------------------------------------------

export interface RenewalDetailData {
  candidate: RenewalCandidate;
  contractLines: ContractLineRow[];
  account: AccountRow | null;
}

interface ContractLineRow {
  id: string;
  productName: string | null;
  quantity: number | null;
  listPrice: number | null;
  netPrice: number | null;
  mrr: number | null;
  billingFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  stripePriceId: string | null;
  stripeSubItemId: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  ownerName: string | null;
  csmName: string | null;
  accountType: string | null;
  industry: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  stripeCustomerId: string | null;
}

export async function getRenewalDetail(
  candidateId: string,
): Promise<RenewalDetailData | null> {
  const [type, ...rest] = candidateId.split(":");
  const rawId = rest.join(":");
  if (!rawId) return null;

  if (type === "sub") {
    const sub = await prisma.stripeSubscription.findUnique({
      where: { id: rawId },
      include: { items: true },
    });
    if (!sub) return null;

    const contract = await prisma.sfContract.findFirst({
      where: { stripeSubscriptionId: rawId },
      include: {
        lines: { orderBy: { productName: "asc" } },
        account: {
          select: {
            id: true, name: true, domain: true, ownerName: true,
            csmName: true, accountType: true, industry: true,
            billingCity: true, billingState: true, billingCountry: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    const renewalStatus: RenewalStatus =
      sub.cancelAtPeriodEnd || sub.cancelAt ? "cancelling"
      : sub.hasSchedule ? "scheduled_end"
      : "period_ending";

    const dueDate = contract?.endDate
      ? contract.endDate.toISOString().slice(0, 10)
      : sub.currentPeriodEnd.toISOString().slice(0, 10);

    // MRR: subscription items first, then contract lines, then zero
    const subMrr = sub.items.reduce((sum, si) =>
      sum + computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity), 0);
    const lineMrr = contract?.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0) ?? 0;
    const mrr = subMrr > 0 ? subMrr : lineMrr > 0 ? Math.round(lineMrr * 100) : 0;

    const candidate: RenewalCandidate = {
      id: sub.id,
      candidateId,
      customerId: sub.customerId,
      customerName: sub.customerName,
      csmName: contract?.account?.csmName ?? null,
      status: sub.status,
      renewalStatus,
      signal: computeSignal(dueDate),
      mrr,
      currency: sub.currency,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAt: sub.cancelAt?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      hasSchedule: sub.hasSchedule,
      collectionMethod: sub.collectionMethod,
      items: sub.items.map((si) => ({
        id: si.id,
        productName: si.productName,
        unitAmount: si.unitAmount,
        currency: si.currency,
        interval: si.billingInterval,
        intervalCount: si.intervalCount,
        quantity: si.quantity,
        mrr: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
      })),
      metadata: (sub.metadata as Record<string, string>) ?? {},
      contract: contract ? {
        id: contract.id,
        accountId: contract.accountId,
        accountName: contract.accountName,
        contractNumber: contract.contractNumber,
        status: contract.status,
        startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
        contractTerm: contract.contractTerm,
        ownerName: contract.ownerName,
        mrr: contract.mrr,
        arr: contract.arr,
        evergreen: contract.evergreen,
        doNotRenew: contract.doNotRenew,
        daysTillExpiry: computeDaysToExpiry(contract.endDate),
        collectionMethod: contract.collectionMethod,
        lineCount: contract.lines.length,
      } : null,
      dueDate,
      dueBasis: contract?.endDate ? "contract" : "subscription",
      subscriptionStatus: sub.status,
    };

    const contractLines: ContractLineRow[] = (contract?.lines ?? []).map((l) => ({
      id: l.id,
      productName: l.productName,
      quantity: l.quantity,
      listPrice: l.listPrice,
      netPrice: l.netPrice,
      mrr: l.mrr,
      billingFrequency: l.billingFrequency,
      startDate: l.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: l.endDate?.toISOString().slice(0, 10) ?? null,
      status: l.status,
      stripePriceId: l.stripePriceId,
      stripeSubItemId: l.stripeSubItemId,
    }));

    return {
      candidate,
      contractLines,
      account: contract?.account ?? null,
    };
  }

  if (type === "contract") {
    const contract = await prisma.sfContract.findUnique({
      where: { id: rawId },
      include: {
        lines: { orderBy: { productName: "asc" } },
        account: {
          select: {
            id: true, name: true, domain: true, ownerName: true,
            csmName: true, accountType: true, industry: true,
            billingCity: true, billingState: true, billingCountry: true,
            stripeCustomerId: true,
          },
        },
      },
    });
    if (!contract) return null;

    let subItems: RenewalCandidateItem[] = [];
    let subStatus = contract.status;
    let subCollectionMethod = contract.collectionMethod ?? "charge_automatically";
    let subCurrentPeriodEnd = contract.endDate?.toISOString() ?? "";
    let subCustomerId = contract.stripeCustomerId ?? contract.accountId;
    let subMrr = 0;

    if (contract.stripeSubscriptionId) {
      const sub = await prisma.stripeSubscription.findUnique({
        where: { id: contract.stripeSubscriptionId },
        include: { items: true },
      });
      if (sub) {
        subStatus = sub.status;
        subCollectionMethod = sub.collectionMethod;
        subCurrentPeriodEnd = sub.currentPeriodEnd.toISOString();
        subCustomerId = sub.customerId;
        subItems = sub.items.map((si) => ({
          id: si.id,
          productName: si.productName,
          unitAmount: si.unitAmount,
          currency: si.currency,
          interval: si.billingInterval,
          intervalCount: si.intervalCount,
          quantity: si.quantity,
          mrr: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
        }));
        subMrr = subItems.reduce((sum, si) => sum + si.mrr, 0);
      }
    }

    // MRR: subscription → contract lines → zero
    const lineMrr = contract.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
    const mrr = subMrr > 0 ? subMrr : lineMrr > 0 ? Math.round(lineMrr * 100) : 0;

    const dueDate = contract.endDate?.toISOString().slice(0, 10) ?? "";

    const candidate: RenewalCandidate = {
      id: contract.stripeSubscriptionId ?? contract.id,
      candidateId,
      customerId: subCustomerId,
      customerName: contract.accountName ?? "Unknown",
      csmName: contract.account?.csmName ?? null,
      status: subStatus,
      renewalStatus: "period_ending",
      signal: computeSignal(dueDate),
      mrr,
      currency: "usd",
      currentPeriodEnd: subCurrentPeriodEnd,
      cancelAt: null,
      cancelAtPeriodEnd: false,
      hasSchedule: false,
      collectionMethod: subCollectionMethod,
      items: subItems,
      metadata: {},
      contract: {
        id: contract.id,
        accountId: contract.accountId,
        accountName: contract.accountName,
        contractNumber: contract.contractNumber,
        status: contract.status,
        startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
        contractTerm: contract.contractTerm,
        ownerName: contract.ownerName,
        mrr: contract.mrr,
        arr: contract.arr,
        evergreen: contract.evergreen,
        doNotRenew: contract.doNotRenew,
        daysTillExpiry: computeDaysToExpiry(contract.endDate),
        collectionMethod: contract.collectionMethod,
        lineCount: contract.lines.length,
      },
      dueDate,
      dueBasis: "contract",
      subscriptionStatus: subStatus !== contract.status ? subStatus : null,
    };

    const contractLines: ContractLineRow[] = contract.lines.map((l) => ({
      id: l.id,
      productName: l.productName,
      quantity: l.quantity,
      listPrice: l.listPrice,
      netPrice: l.netPrice,
      mrr: l.mrr,
      billingFrequency: l.billingFrequency,
      startDate: l.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: l.endDate?.toISOString().slice(0, 10) ?? null,
      status: l.status,
      stripePriceId: l.stripePriceId,
      stripeSubItemId: l.stripeSubItemId,
    }));

    return {
      candidate,
      contractLines,
      account: contract.account ?? null,
    };
  }

  return null;
}
