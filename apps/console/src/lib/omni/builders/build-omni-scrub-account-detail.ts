/**
 * Builder: Omni Scrub Account Detail
 *
 * Queries subscription items, invoices, and SF contracts for a single
 * customer in a scrub month. Produces the full detail payload needed
 * for the scrub detail panel.
 */

import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { computeFreshness, computeCompositeFreshness } from "../contracts/shared-types";
import type {
  OmniScrubAccountDetail,
  ScrubCanceledSubscription,
  ScrubActiveSubscription,
  ScrubSubItemDetail,
  CoverageInfo,
  CoverageAssessment,
  CoverageConfidence,
} from "../contracts/omni-scrub-account-detail";
import type { ConfidenceFlagEntry } from "../contracts/shared-types";

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface CanceledSubRow {
  sub_id: string;
  canceled_at: Date;
  start_date: Date;
  customer_name: string;
}

interface ItemRow {
  id: string;
  subscription_id: string;
  product_name: string;
  quantity: number;
  unit_amount: number;
  billing_interval: string | null;
  interval_count: number;
  sf_contract_line_id: string | null;
  correlation_status: string | null;
}

interface InvoiceRow {
  id: string;
  subscription_id: string;
  number: string | null;
  amount_paid: number;
  period_start: Date | null;
  period_end: Date | null;
}

interface ActiveSubWithSfRow {
  sub_id: string;
  status: string;
  start_date: Date;
  current_period_end: Date;
  customer_name: string;
  sf_contract_id: string | null;
  sf_contract_status: string | null;
}

// ---------------------------------------------------------------------------
// Snapshot date
// ---------------------------------------------------------------------------

function getSnapshotDate(month: string): Date {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 0, 23, 59, 59, 999));
}

// ---------------------------------------------------------------------------
// Coverage derivation
// ---------------------------------------------------------------------------

function deriveCoverage(sub: CanceledSubRow, invoice: InvoiceRow | undefined): CoverageInfo {
  const cancellationDate = sub.canceled_at.toISOString();

  if (!invoice) {
    return {
      coveredThrough: null,
      cancellationDate,
      assessment: "no_mirrored_paid_invoice",
      confidence: "low",
      evidenceSource: "Mirrored Stripe invoices",
      notes: "No paid invoice found in mirrored data for this subscription",
      lastInvoiceId: null,
      lastInvoiceNumber: null,
      lastInvoiceAmountCents: 0,
      lastInvoicePeriodStart: null,
      lastInvoicePeriodEnd: null,
    };
  }

  const periodEnd = invoice.period_end;
  const coveredThrough = periodEnd?.toISOString() ?? null;

  let assessment: CoverageAssessment;
  let confidence: CoverageConfidence;
  let notes: string;

  if (periodEnd && periodEnd > sub.canceled_at) {
    assessment = "covered_past_cancellation";
    confidence = "high";
    const remainingMs = periodEnd.getTime() - sub.canceled_at.getTime();
    const remainingDays = Math.round(remainingMs / (1000 * 60 * 60 * 24));
    notes = `Paid service extends ${remainingDays} day${remainingDays !== 1 ? "s" : ""} past cancellation date`;
  } else if (periodEnd) {
    assessment = "potential_uncovered_interval";
    confidence = "medium";
    const gapMs = sub.canceled_at.getTime() - periodEnd.getTime();
    const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24));
    notes = `Last paid period ended ${gapDays} day${gapDays !== 1 ? "s" : ""} before cancellation`;
  } else {
    assessment = "historical_coverage_incomplete";
    confidence = "low";
    notes = "Invoice found but service period dates are missing in mirrored data";
  }

  return {
    coveredThrough,
    cancellationDate,
    assessment,
    confidence,
    evidenceSource: "Mirrored Stripe invoices",
    notes,
    lastInvoiceId: invoice.id,
    lastInvoiceNumber: invoice.number,
    lastInvoiceAmountCents: invoice.amount_paid,
    lastInvoicePeriodStart: invoice.period_start?.toISOString() ?? null,
    lastInvoicePeriodEnd: invoice.period_end?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOmniScrubAccountDetail(
  stripeCustomerId: string,
  month: string,
): Promise<OmniScrubAccountDetail> {
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 1));
  const snapshotDate = getSnapshotDate(month);

  // Freshness: composite across all sources this detail depends on
  const freshnessRows = await prisma.$queryRawUnsafe<{
    source_table: string;
    max_synced: Date | null;
  }[]>(
    `SELECT 'stripe_subscriptions' AS source_table, MAX(synced_at) AS max_synced
     FROM stripe_subscriptions WHERE customer_id = $1
     UNION ALL
     SELECT 'stripe_invoices', MAX(synced_at)
     FROM stripe_invoices WHERE customer_id = $1
     UNION ALL
     SELECT 'sf_contracts', MAX(sf.synced_at)
     FROM sf_contracts sf
     WHERE sf.stripe_customer_id = $1`,
    stripeCustomerId,
  );

  const sourceMap = new Map(freshnessRows.map((r) => [r.source_table, r.max_synced]));
  const compositeFreshness = computeCompositeFreshness([
    { source: "stripe_subscriptions", syncedAt: sourceMap.get("stripe_subscriptions") ?? null },
    { source: "stripe_invoices", syncedAt: sourceMap.get("stripe_invoices") ?? null },
    { source: "sf_contracts", syncedAt: sourceMap.get("sf_contracts") ?? null },
  ]);
  const freshness = compositeFreshness.overall;

  // 1. Canceled subs in the month
  const canceledSubs = await prisma.$queryRawUnsafe<CanceledSubRow[]>(
    `
    SELECT sub.id AS sub_id, sub.canceled_at, sub.start_date, sub.customer_name
    FROM stripe_subscriptions sub
    WHERE sub.customer_id = $1
      AND sub.status = 'canceled'
      AND sub.canceled_at >= $2
      AND sub.canceled_at < $3
    ORDER BY sub.canceled_at
    `,
    stripeCustomerId,
    monthStart,
    monthEnd,
  );

  const canceledSubIds = canceledSubs.map((s) => s.sub_id);

  // 2. Items for canceled subs
  const canceledItems = canceledSubIds.length > 0
    ? await prisma.$queryRawUnsafe<ItemRow[]>(
        `
        SELECT si.id, si.subscription_id, si.product_name,
          si.quantity, si.unit_amount, si.billing_interval, si.interval_count,
          si.sf_contract_line_id, si.correlation_status
        FROM stripe_subscription_items si
        WHERE si.subscription_id = ANY($1)
        ORDER BY si.unit_amount DESC
        `,
        canceledSubIds,
      )
    : [];

  // 3. Last paid invoice per canceled sub
  const lastInvoices = canceledSubIds.length > 0
    ? await prisma.$queryRawUnsafe<InvoiceRow[]>(
        `
        SELECT DISTINCT ON (inv.subscription_id)
          inv.id, inv.subscription_id, inv.number,
          inv.amount_paid, inv.period_start, inv.period_end
        FROM stripe_invoices inv
        WHERE inv.subscription_id = ANY($1)
          AND inv.status = 'paid'
        ORDER BY inv.subscription_id, inv.period_end DESC
        `,
        canceledSubIds,
      )
    : [];

  const invoiceBySubId = new Map(lastInvoices.map((i) => [i.subscription_id, i]));
  const itemsBySubId = new Map<string, ItemRow[]>();
  for (const item of canceledItems) {
    const list = itemsBySubId.get(item.subscription_id) ?? [];
    list.push(item);
    itemsBySubId.set(item.subscription_id, list);
  }

  // Build canceled sub details
  function mapItemToDetail(i: ItemRow): ScrubSubItemDetail {
    const mrrCents = computeItemMrr(i.unit_amount, i.billing_interval, i.interval_count, i.quantity);
    return {
      id: i.id,
      productName: i.product_name,
      quantity: i.quantity,
      unitAmountCents: i.unit_amount,
      billingInterval: i.billing_interval,
      intervalCount: i.interval_count,
      arrCents: mrrCents * 12,
      sfContractLineId: i.sf_contract_line_id,
      correlationStatus: i.correlation_status,
    };
  }

  const canceledSubscriptions: ScrubCanceledSubscription[] = canceledSubs.map((sub) => {
    const items = (itemsBySubId.get(sub.sub_id) ?? []).map(mapItemToDetail);
    const arrCents = items.reduce((s, i) => s + i.arrCents, 0);
    const coverage = deriveCoverage(sub, invoiceBySubId.get(sub.sub_id));

    return {
      subId: sub.sub_id,
      canceledAt: sub.canceled_at.toISOString(),
      startDate: sub.start_date.toISOString(),
      items,
      arrCents,
      coverage,
    };
  });

  // 4. Active subs with SF contract
  const activeSubs = await prisma.$queryRawUnsafe<ActiveSubWithSfRow[]>(
    `
    SELECT
      sub.id AS sub_id, sub.status, sub.start_date, sub.current_period_end,
      sub.customer_name,
      sf.id AS sf_contract_id, sf.status AS sf_contract_status
    FROM stripe_subscriptions sub
    LEFT JOIN sf_contracts sf ON sf.stripe_subscription_id = sub.id
    WHERE sub.customer_id = $1
      AND sub.status IN ('active', 'trialing', 'past_due')
    ORDER BY sub.start_date DESC
    `,
    stripeCustomerId,
  );

  const activeSubIds = activeSubs.map((s) => s.sub_id);

  // 5. Items for active subs
  const activeItems = activeSubIds.length > 0
    ? await prisma.$queryRawUnsafe<ItemRow[]>(
        `
        SELECT si.id, si.subscription_id, si.product_name,
          si.quantity, si.unit_amount, si.billing_interval, si.interval_count,
          si.sf_contract_line_id, si.correlation_status
        FROM stripe_subscription_items si
        WHERE si.subscription_id = ANY($1)
        ORDER BY si.unit_amount DESC
        `,
        activeSubIds,
      )
    : [];

  const activeItemsBySubId = new Map<string, ItemRow[]>();
  for (const item of activeItems) {
    const list = activeItemsBySubId.get(item.subscription_id) ?? [];
    list.push(item);
    activeItemsBySubId.set(item.subscription_id, list);
  }

  const activeSubscriptions: ScrubActiveSubscription[] = activeSubs.map((sub) => {
    const items = (activeItemsBySubId.get(sub.sub_id) ?? []).map(mapItemToDetail);
    const arrCents = items.reduce((s, i) => s + i.arrCents, 0);

    const hasSfContract = !!sub.sf_contract_id;
    const matchedItemCount = (activeItemsBySubId.get(sub.sub_id) ?? [])
      .filter((i) => i.sf_contract_line_id).length;
    const totalItemCount = (activeItemsBySubId.get(sub.sub_id) ?? []).length;

    let sfMatchStatus: ScrubActiveSubscription["sfMatchStatus"];
    if (!hasSfContract) sfMatchStatus = "no_contract";
    else if (matchedItemCount === totalItemCount && totalItemCount > 0) sfMatchStatus = "matched";
    else sfMatchStatus = "partial";

    return {
      subId: sub.sub_id,
      status: sub.status,
      startDate: sub.start_date.toISOString(),
      currentPeriodEnd: sub.current_period_end.toISOString(),
      arrCents,
      sfContractId: sub.sf_contract_id,
      sfContractStatus: sub.sf_contract_status,
      sfMatchStatus,
      items,
    };
  });

  // Summary
  const customerName =
    canceledSubs[0]?.customer_name ??
    activeSubs[0]?.customer_name ??
    stripeCustomerId;

  const canceledArrCents = canceledSubscriptions.reduce((s, c) => s + c.arrCents, 0);
  const activeArrCents = activeSubscriptions.reduce((s, a) => s + a.arrCents, 0);

  // Coverage assessments
  const coverageAssessments = canceledSubscriptions.map((c) => c.coverage);

  // Confidence flags
  const flags: ConfidenceFlagEntry[] = [];
  if (coverageAssessments.some((c) => c.assessment === "potential_uncovered_interval")) {
    flags.push({ flag: "coverage_gap_detected", detail: "Gap between paid period and cancellation date" });
  }
  if (coverageAssessments.some((c) => c.assessment === "no_mirrored_paid_invoice")) {
    flags.push({ flag: "no_paid_invoices", detail: "Some canceled subs have no paid invoices in mirror" });
  }
  if (activeSubscriptions.some((a) => a.sfMatchStatus === "no_contract")) {
    flags.push({ flag: "sf_correlation_missing", detail: "Some active subs have no SF contract" });
  }
  if (activeSubscriptions.some((a) => a.sfMatchStatus === "partial")) {
    flags.push({ flag: "sf_correlation_partial", detail: "Some active subs have incomplete SF line correlation" });
  }
  if (freshness.state === "degraded") {
    flags.push({ flag: "stale_mirror_data", detail: freshness.label });
  }

  return {
    summary: {
      customerName,
      stripeCustomerId,
      scrubMonth: month,
      snapshotDate: snapshotDate.toISOString(),
      canceledArrCents,
      activeArrCents,
      netArrImpactCents: activeArrCents - canceledArrCents,
    },
    canceledSubscriptions,
    coverageAssessments,
    activeSubscriptions,
    freshness,
    compositeFreshness,
    confidenceFlags: flags,
  };
}
