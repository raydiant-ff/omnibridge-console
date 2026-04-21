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
import { computeItemMrr } from "@/lib/billing-utils";

// ── Types ──

export type CoverageAssessment =
  | "covered_past_cancellation"
  | "covered_to_term_end"
  | "potential_uncovered_interval"
  | "no_mirrored_paid_invoice"
  | "historical_coverage_incomplete";

export type CoverageConfidence = "high" | "medium" | "low";

export interface SubItemDetail {
  id: string;
  productName: string;
  quantity: number;
  unitAmountCents: number;
  billingInterval: string | null;
  intervalCount: number;
  arrDollars: number;
  sfContractLineId: string | null;
  correlationStatus: string | null;
}

export interface CoverageInfo {
  coveredThrough: string | null;
  cancellationDate: string;
  assessment: CoverageAssessment;
  confidence: CoverageConfidence;
  evidenceSource: string;
  notes: string;
  lastInvoiceId: string | null;
  lastInvoiceNumber: string | null;
  lastInvoiceAmountCents: number;
  lastInvoicePeriodStart: string | null;
  lastInvoicePeriodEnd: string | null;
}

export interface CanceledSubDetail {
  subId: string;
  canceledAt: string;
  startDate: string;
  items: SubItemDetail[];
  arrDollars: number;
  coverage: CoverageInfo;
}

export interface ActiveSubDetail {
  subId: string;
  status: string;
  startDate: string;
  currentPeriodEnd: string;
  arrDollars: number;
  sfContractId: string | null;
  sfContractStatus: string | null;
  sfMatchStatus: "matched" | "no_contract" | "partial";
  items: SubItemDetail[];
}

export interface ScrubDetailData {
  customerName: string;
  stripeCustomerId: string;
  scrubMonth: string;
  snapshotDate: string;
  freshness: FreshnessInfo;
  canceledSubscriptions: CanceledSubDetail[];
  activeSubscriptions: ActiveSubDetail[];
}

// ── Internal types ──

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

// ── Query ──

export async function getScrubDetail(
  customerId: string,
  month: string,
): Promise<ScrubDetailData> {
  await requireSession();

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 1));
  const snapshotDate = getSnapshotDate(month);

  // Freshness
  const freshnessRows = await prisma.$queryRawUnsafe<{ max_synced: Date | null }[]>(
    `SELECT MAX(synced_at) AS max_synced FROM stripe_subscriptions WHERE customer_id = $1`,
    customerId,
  );
  const freshness = computeFreshness(freshnessRows[0]?.max_synced ?? null);

  // 1. Canceled subs in scrub month
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
    customerId,
    monthStart,
    monthEnd,
  );

  const canceledSubIds = canceledSubs.map((s) => s.sub_id);

  // 2. Items for canceled subs (batch)
  const canceledItems =
    canceledSubIds.length > 0
      ? await prisma.$queryRawUnsafe<ItemRow[]>(
          `
      SELECT
        si.id, si.subscription_id, si.product_name,
        si.quantity, si.unit_amount, si.billing_interval, si.interval_count,
        si.sf_contract_line_id, si.correlation_status
      FROM stripe_subscription_items si
      WHERE si.subscription_id = ANY($1)
      ORDER BY si.unit_amount DESC
      `,
          canceledSubIds,
        )
      : [];

  // 3. Last paid invoice per canceled sub (batch, pick latest period_end per sub)
  const lastInvoices =
    canceledSubIds.length > 0
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

  // Build canceled sub details with coverage assessment
  const canceledSubscriptions: CanceledSubDetail[] = canceledSubs.map((sub) => {
    const items = itemsBySubId.get(sub.sub_id) ?? [];
    const invoice = invoiceBySubId.get(sub.sub_id);

    const subItems: SubItemDetail[] = items.map((i) => ({
      id: i.id,
      productName: i.product_name,
      quantity: i.quantity,
      unitAmountCents: i.unit_amount,
      billingInterval: i.billing_interval,
      intervalCount: i.interval_count,
      arrDollars: Math.round((computeItemMrr(i.unit_amount, i.billing_interval, i.interval_count, i.quantity) / 100) * 12 * 100) / 100,
      sfContractLineId: i.sf_contract_line_id,
      correlationStatus: i.correlation_status,
    }));

    const subArr = subItems.reduce((s, i) => s + i.arrDollars, 0);

    const coverage = deriveCoverage(sub, invoice);

    return {
      subId: sub.sub_id,
      canceledAt: sub.canceled_at.toISOString(),
      startDate: sub.start_date.toISOString(),
      items: subItems,
      arrDollars: Math.round(subArr * 100) / 100,
      coverage,
    };
  });

  // 4. Active subs with SF contract join
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
    customerId,
  );

  const activeSubIds = activeSubs.map((s) => s.sub_id);

  // 5. Items for active subs with SF line correlation
  const activeItems =
    activeSubIds.length > 0
      ? await prisma.$queryRawUnsafe<ItemRow[]>(
          `
      SELECT
        si.id, si.subscription_id, si.product_name,
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

  const activeSubscriptions: ActiveSubDetail[] = activeSubs.map((sub) => {
    const items = activeItemsBySubId.get(sub.sub_id) ?? [];
    const subItems: SubItemDetail[] = items.map((i) => ({
      id: i.id,
      productName: i.product_name,
      quantity: i.quantity,
      unitAmountCents: i.unit_amount,
      billingInterval: i.billing_interval,
      intervalCount: i.interval_count,
      arrDollars: Math.round((computeItemMrr(i.unit_amount, i.billing_interval, i.interval_count, i.quantity) / 100) * 12 * 100) / 100,
      sfContractLineId: i.sf_contract_line_id,
      correlationStatus: i.correlation_status,
    }));

    const hasSfContract = !!sub.sf_contract_id;
    const matchedItemCount = items.filter((i) => i.sf_contract_line_id).length;
    let sfMatchStatus: ActiveSubDetail["sfMatchStatus"];
    if (!hasSfContract) {
      sfMatchStatus = "no_contract";
    } else if (matchedItemCount === items.length && items.length > 0) {
      sfMatchStatus = "matched";
    } else {
      sfMatchStatus = "partial";
    }

    const subArr = subItems.reduce((s, i) => s + i.arrDollars, 0);

    return {
      subId: sub.sub_id,
      status: sub.status,
      startDate: sub.start_date.toISOString(),
      currentPeriodEnd: sub.current_period_end.toISOString(),
      arrDollars: Math.round(subArr * 100) / 100,
      sfContractId: sub.sf_contract_id,
      sfContractStatus: sub.sf_contract_status,
      sfMatchStatus,
      items: subItems,
    };
  });

  const customerName =
    canceledSubs[0]?.customer_name ??
    activeSubs[0]?.customer_name ??
    customerId;

  return {
    customerName,
    stripeCustomerId: customerId,
    scrubMonth: month,
    snapshotDate: snapshotDate.toISOString(),
    freshness,
    canceledSubscriptions,
    activeSubscriptions,
  };
}

// ── Coverage derivation ──

function deriveCoverage(
  sub: CanceledSubRow,
  invoice: InvoiceRow | undefined,
): CoverageInfo {
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
