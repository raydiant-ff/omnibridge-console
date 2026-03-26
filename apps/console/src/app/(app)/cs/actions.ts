"use server";

/**
 * CS Dashboard actions — object-first model.
 *
 * SFDC-first commercial workflow. Stripe billing engine.
 * Opportunities not mirrored locally — derived from contract/quote references.
 */

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { getOmniAccountSummaries, getWorkspaceTrustSummary } from "@/lib/omni/repo";
import type { OmniAccountSummary } from "@/lib/omni/contracts";
import type {
  CsDashboardData,
  BannerMetrics,
  PriorityAccountRow,
  QuotesContainer,
  FlagReason,
  AccountSnapshot,
} from "./types";

async function fetchSalesforceQuoteContainer(
  yearStart: Date,
): Promise<{
  quotes: QuotesContainer;
  oppNoContract: number;
}> {
  try {
    const [statusGroups, acceptedYtdAgg, acceptedQuoteRows, contractLinks] = await Promise.all([
      prisma.sfQuote.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.sfQuote.aggregate({
        where: { status: "Accepted", sfCreatedDate: { gte: yearStart } },
        _count: { id: true },
        _sum: { netAmount: true },
      }),
      prisma.sfQuote.findMany({
        where: { status: "Accepted", opportunityId: { not: null } },
        select: { id: true, opportunityId: true },
      }),
      prisma.sfContract.findMany({
        where: { opportunityId: { not: null } },
        select: { opportunityId: true, stripeSubscriptionId: true },
      }),
    ]);

    const byStatus = statusGroups.map((row) => ({
      status: row.status ?? "unknown",
      count: row._count.id,
    }));

    const acceptedYtd = acceptedYtdAgg._count.id;
    const acceptedYtdAmountCents = Math.round(
      (acceptedYtdAgg._sum.netAmount ?? 0) * 100,
    );

    const contractByOpportunity = new Map<
      string,
      { hasContract: boolean; hasStripeSub: boolean }
    >();
    for (const contract of contractLinks) {
      if (!contract.opportunityId) continue;
      const current = contractByOpportunity.get(contract.opportunityId) ?? {
        hasContract: false,
        hasStripeSub: false,
      };
      current.hasContract = true;
      current.hasStripeSub = current.hasStripeSub || !!contract.stripeSubscriptionId;
      contractByOpportunity.set(contract.opportunityId, current);
    }

    let acceptedNoContract = 0;
    let acceptedNoSub = 0;
    const oppIdsWithoutContract = new Set<string>();
    for (const quote of acceptedQuoteRows) {
      const opportunityId = quote.opportunityId;
      if (!opportunityId) continue;
      const linkage = contractByOpportunity.get(opportunityId);
      if (!linkage?.hasContract) {
        acceptedNoContract += 1;
        oppIdsWithoutContract.add(opportunityId);
      }
      if (!linkage?.hasStripeSub) {
        acceptedNoSub += 1;
      }
    }

    return {
      quotes: {
        total: byStatus.reduce((sum, item) => sum + item.count, 0),
        byStatus,
        acceptedYtd,
        acceptedYtdAmountCents,
        acceptedNoSub,
        acceptedNoContract,
        expiredOpen: 0,
        source: "mirror",
      },
      oppNoContract: oppIdsWithoutContract.size,
    };
  } catch {
    return {
      quotes: {
        total: 0,
        byStatus: [],
        acceptedYtd: 0,
        acceptedYtdAmountCents: 0,
        acceptedNoSub: 0,
        acceptedNoContract: 0,
        expiredOpen: 0,
        source: "salesforce_unavailable",
      },
      oppNoContract: 0,
    };
  }
}

export async function fetchCsDashboardData(): Promise<CsDashboardData> {
  await requireSession();

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Phase 1: Heavy canonical data (account summaries flood the DB connection pool)
  const [report, trust] = await Promise.all([
    getOmniAccountSummaries(),
    getWorkspaceTrustSummary(),
  ]);

  const salesforceQuotes = await fetchSalesforceQuoteContainer(yearStart);

  // Phase 2: Lighter container queries (run after account summaries complete)
  const [
    activeContractAccountRows,
    // Reconciliation counts for banner
    activeSubNoContract, activeContractNoSub, contractLinkedToInactiveSub,
    // Subscriptions
    subTotal, subActive, subTrialing, subPastDue, subCanceled,
    subActiveMrr, subCanceling,
    // Invoices
    invTotal, invOpen, invOpenAmt, invPastDue, invPastDueAmt,
    invPaid, invPaidAmt, invUncollectible, invUncollectibleAmt,
    // Contracts
    contractTotal, contractActivated, contractNoStripeSub, contractEndingMonth, contractEndingMrr,
    // Payments
    payYtdTotal, payYtdAmt, paySucceeded, paySucceededAmt, payFailed, payFailedAmt, payNeedingAction,
    // Opportunities
    oppsDistinct,
    // Billing risk for banner
    delinquentCustomers,
  ] = await Promise.all([
    prisma.sfContract.findMany({
      where: { status: "Activated", accountId: { not: "" } },
      select: { accountId: true },
      distinct: ["accountId"],
    }),
    // Reconciliation
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(*) as cnt FROM stripe_subscriptions s WHERE s.status IN ('active','trialing') AND NOT EXISTS (SELECT 1 FROM sf_contracts c WHERE c.stripe_subscription_id = s.id AND c.status = 'Activated')`.then(r => Number(r[0]?.cnt ?? 0)),
    prisma.sfContract.count({ where: { status: "Activated", stripeSubscriptionId: null } }),
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(*) as cnt FROM sf_contracts c WHERE c.status = 'Activated' AND c.stripe_subscription_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stripe_subscriptions s WHERE s.id = c.stripe_subscription_id AND s.status IN ('active','trialing','past_due'))`.then(r => Number(r[0]?.cnt ?? 0)),
    // Subscriptions
    prisma.stripeSubscription.count(),
    prisma.stripeSubscription.count({ where: { status: "active" } }),
    prisma.stripeSubscription.count({ where: { status: "trialing" } }),
    prisma.stripeSubscription.count({ where: { status: "past_due" } }),
    prisma.stripeSubscription.count({ where: { status: "canceled" } }),
    prisma.$queryRaw<[{mrr:number}]>`SELECT COALESCE(SUM(CASE si.billing_interval WHEN 'year' THEN si.unit_amount * si.quantity / (12.0 * si.interval_count) WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count ELSE 0 END), 0)::float as mrr FROM stripe_subscription_items si JOIN stripe_subscriptions sub ON sub.id = si.subscription_id WHERE sub.status IN ('active','past_due') AND si.usage_type = 'licensed'`.then(r => Math.round(r[0]?.mrr ?? 0)),
    prisma.stripeSubscription.count({ where: { cancelAtPeriodEnd: true, status: { not: "canceled" } } }),
    // Invoices
    prisma.stripeInvoice.count(),
    prisma.stripeInvoice.count({ where: { status: "open" } }),
    prisma.stripeInvoice.aggregate({ where: { status: "open" }, _sum: { amountRemaining: true } }).then(r => r._sum.amountRemaining ?? 0),
    prisma.stripeInvoice.count({ where: { status: "open", dueDate: { lt: now } } }),
    prisma.stripeInvoice.aggregate({ where: { status: "open", dueDate: { lt: now } }, _sum: { amountRemaining: true } }).then(r => r._sum.amountRemaining ?? 0),
    prisma.stripeInvoice.count({ where: { status: "paid" } }),
    prisma.stripeInvoice.aggregate({ where: { status: "paid" }, _sum: { amountPaid: true } }).then(r => r._sum.amountPaid ?? 0),
    prisma.stripeInvoice.count({ where: { status: "uncollectible" } }),
    prisma.stripeInvoice.aggregate({ where: { status: "uncollectible" }, _sum: { amountDue: true } }).then(r => r._sum.amountDue ?? 0),
    // Contracts
    prisma.sfContract.count(),
    prisma.sfContract.count({ where: { status: "Activated" } }),
    prisma.sfContract.count({ where: { status: "Activated", stripeSubscriptionId: null } }),
    prisma.sfContract.count({ where: { status: "Activated", endDate: { gte: monthStart, lt: monthEnd } } }),
    prisma.$queryRaw<[{mrr:number}]>`SELECT COALESCE(SUM(mrr), 0)::float as mrr FROM sf_contracts WHERE status = 'Activated' AND end_date >= ${monthStart} AND end_date < ${monthEnd}`.then(r => Math.round((r[0]?.mrr ?? 0) * 100)),
    // Payments (YTD)
    prisma.stripePayment.count({ where: { stripeCreated: { gte: yearStart } } }),
    prisma.stripePayment.aggregate({ where: { stripeCreated: { gte: yearStart } }, _sum: { amount: true } }).then(r => r._sum.amount ?? 0),
    prisma.stripePayment.count({ where: { stripeCreated: { gte: yearStart }, status: "succeeded" } }),
    prisma.stripePayment.aggregate({ where: { stripeCreated: { gte: yearStart }, status: "succeeded" }, _sum: { amountReceived: true } }).then(r => r._sum.amountReceived ?? 0),
    prisma.stripePayment.count({ where: { stripeCreated: { gte: yearStart }, status: { in: ["requires_payment_method", "canceled"] } } }),
    prisma.stripePayment.aggregate({ where: { stripeCreated: { gte: yearStart }, status: { in: ["requires_payment_method", "canceled"] } }, _sum: { amount: true } }).then(r => r._sum.amount ?? 0),
    prisma.stripePayment.count({ where: { status: { in: ["requires_payment_method", "requires_action"] } } }),
    // Opportunities
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(DISTINCT opportunity_id) as cnt FROM sf_contracts WHERE opportunity_id IS NOT NULL`.then(r => Number(r[0]?.cnt ?? 0)),
    // Billing risk
    prisma.stripeCustomer.count({ where: { delinquent: true } }),
  ]);

  const { accounts } = report;
  const activeContractAccountIds = new Set(
    activeContractAccountRows.map((row) => row.accountId).filter(Boolean),
  );
  const activeAccounts = accounts.filter((a) => {
    const normalizedStatus = (a.accountStatus ?? "").trim().toLowerCase();
    const hasActiveStatus = normalizedStatus === "active customer";
    const hasActivatedContract = !!a.sfAccountId && activeContractAccountIds.has(a.sfAccountId);
    return hasActiveStatus || hasActivatedContract;
  });
  const activeSalesforceAccounts = activeAccounts.length;
  const activeStripeCustomers = activeAccounts.filter(
    (a) => a.activeSubscriptionCount > 0 || !!a.stripeCustomerId,
  ).length;
  const accountMismatchCount = activeAccounts.filter(
    (a) => !a.stripeCustomerId || a.activeSubscriptionCount === 0,
  ).length;
  const accountMismatchPct = activeAccounts.length > 0
    ? Math.round((accountMismatchCount / activeAccounts.length) * 1000) / 10
    : 0;

  const hasBillingIssue = (account: OmniAccountSummary) =>
    account.pastDueInvoiceCount > 0 ||
    account.signalCategories.includes("invoice_risk");
  const hasLinkageIssue = (account: OmniAccountSummary) =>
    account.signalCategories.includes("missing_linkage") ||
    account.signalCategories.includes("correlation_issue") ||
    account.signalCategories.includes("no_active_subscription");
  const hasDataQualityIssue = (account: OmniAccountSummary) =>
    account.dqSummary.issueCount > 0 ||
    account.signalCategories.includes("data_quality");

  const attentionAccounts = activeAccounts.filter(
    (account) =>
      hasBillingIssue(account) ||
      hasLinkageIssue(account) ||
      hasDataQualityIssue(account),
  );

  const topConcerns = [
    {
      label: "Billing issues",
      count: activeAccounts.filter(hasBillingIssue).length,
    },
    {
      label: "Linkage gaps",
      count: activeAccounts.filter(hasLinkageIssue).length,
    },
    {
      label: "Data quality",
      count: activeAccounts.filter(hasDataQualityIssue).length,
    },
  ].filter((item) => item.count > 0);

  // Banner
  let atRiskMrrCents = 0;
  let billingRiskAccounts = 0;
  for (const a of activeAccounts) {
    if (hasBillingIssue(a) || hasLinkageIssue(a)) {
      atRiskMrrCents += a.activeMrrCents;
    }
    if (hasBillingIssue(a)) {
      billingRiskAccounts++;
    }
  }

  const lifecycleBreaks = activeSubNoContract + activeContractNoSub + contractLinkedToInactiveSub;
  const totalMrrCents = subActiveMrr;
  const totalArrCents = totalMrrCents * 12;
  const atRiskArrCents = atRiskMrrCents * 12;

  const banner: BannerMetrics = {
    accounts: activeAccounts.length,
    activeSalesforceAccounts,
    activeStripeCustomers,
    accountMismatchCount,
    accountMismatchPct,
    needAttention: attentionAccounts.length,
    topConcerns,
    totalMrrCents,
    totalArrCents,
    atRiskArrCents,
    atRiskLabel: "ARR across active accounts with billing or linkage risk",
    billingRisk: billingRiskAccounts + delinquentCustomers,
    lifecycleBreaks,
  };

  // Priority lanes + rows — active account queue for CSM actionability
  const renewalsThisMonth = activeAccounts
    .filter((account) => {
      if (!account.renewalSummary.nearestRenewalDate) return false;
      const nearestRenewal = new Date(account.renewalSummary.nearestRenewalDate);
      if (Number.isNaN(nearestRenewal.getTime())) return false;
      return nearestRenewal < monthEnd;
    })
    .sort((a, b) => {
      const aDays = a.renewalSummary.daysToNearestRenewal ?? Number.POSITIVE_INFINITY;
      const bDays = b.renewalSummary.daysToNearestRenewal ?? Number.POSITIVE_INFINITY;
      return aDays - bDays || b.activeMrrCents - a.activeMrrCents;
    })
    .slice(0, 10);
  const dataQuality = activeAccounts.filter(a => a.dqSummary.issueCount > 0).sort((a, b) => {
    const r: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (r[b.dqSummary.worstSeverity ?? ""] ?? 0) - (r[a.dqSummary.worstSeverity ?? ""] ?? 0) || b.dqSummary.issueCount - a.dqSummary.issueCount;
  }).slice(0, 10);
  const missingLinkage = activeAccounts
    .filter(
      (a) =>
        a.signalCategories.includes("missing_linkage") ||
        a.signalCategories.includes("correlation_issue") ||
        a.signalCategories.includes("no_active_subscription"),
    )
    .sort((a, b) => b.activeMrrCents - a.activeMrrCents)
    .slice(0, 10);
  const invoiceRisk = activeAccounts
    .filter((a) => a.pastDueInvoiceCount > 0)
    .sort((a, b) => b.pastDueInvoiceCount - a.pastDueInvoiceCount || b.activeMrrCents - a.activeMrrCents)
    .slice(0, 10);
  const unmanagedAccounts = activeAccounts
    .filter((a) => !a.csmName)
    .sort((a, b) => b.activeMrrCents - a.activeMrrCents)
    .slice(0, 10);

  const seen = new Set<string>();
  const priorityRows: PriorityAccountRow[] = [];
  function addRow(a: OmniAccountSummary, bl: string, rr: string, sev: "critical"|"high"|"medium", href: string) {
    if (seen.has(a.omniAccountId)) return;
    seen.add(a.omniAccountId);
    priorityRows.push({ omniAccountId: a.omniAccountId, displayName: a.displayName, csmName: a.csmName, activeMrrCents: a.activeMrrCents, breakLocation: bl, riskReason: rr, severity: sev, isFlagged: a.reviewState.isFlagged, href });
  }
  for (const a of invoiceRisk) {
    addRow(
      a,
      "Invoice → Payment",
      `${a.pastDueInvoiceCount} past due`,
      "critical",
      `/customers/${encodeURIComponent(a.omniAccountId)}`,
    );
  }
  for (const a of renewalsThisMonth) {
    const days = a.renewalSummary.daysToNearestRenewal;
    const reason =
      days == null
        ? "Renews this month"
        : days < 0
          ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
          : days === 0
            ? "Expires today"
            : `${days} day${days === 1 ? "" : "s"} until expiry`;
    const severity = days != null && days <= 0 ? "critical" : days != null && days <= 7 ? "high" : "medium";
    addRow(
      a,
      "Renewal This Month",
      reason,
      severity,
      `/cs/renewals?account=${encodeURIComponent(a.omniAccountId)}`,
    );
  }
  for (const a of unmanagedAccounts) {
    addRow(
      a,
      "CSM Coverage",
      "No assigned CSM",
      "high",
      `/customers/${encodeURIComponent(a.omniAccountId)}`,
    );
  }
  for (const a of missingLinkage) {
    const issues = [];
    if (!a.hasSalesforce) issues.push("No SF");
    if (!a.hasStripe) issues.push("No Stripe");
    if (a.signalCategories.includes("no_active_subscription")) issues.push("No active sub");
    addRow(
      a,
      "Contract ↔ Sub",
      issues.join(", "),
      "medium",
      `/customers/${encodeURIComponent(a.omniAccountId)}`,
    );
  }
  for (const a of dataQuality) {
    addRow(
      a,
      "Data Quality",
      `${a.dqSummary.issueCount} issues`,
      a.dqSummary.worstSeverity === "critical" ? "critical" : "high",
      `/cs/data-quality?account=${encodeURIComponent(a.omniAccountId)}`,
    );
  }
  priorityRows.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity]) - ({ critical: 0, high: 1, medium: 2 }[b.severity]));

  return {
    trust,
    banner,
    priorityRows: priorityRows.slice(0, 15),
    opportunities: {
      trackedTotal: oppsDistinct,
      noContractFromQuote: salesforceQuotes.oppNoContract,
      isPartial: true,
    },
    quotes: salesforceQuotes.quotes,
    subscriptions: {
      total: subTotal,
      active: subActive,
      trialing: subTrialing,
      pastDue: subPastDue,
      canceled: subCanceled,
      activeMrrCents: subActiveMrr,
      cancelingCount: subCanceling,
    },
    invoices: {
      stripeTotal: invTotal,
      open: invOpen,
      openAmountCents: invOpenAmt,
      pastDue: invPastDue,
      pastDueAmountCents: invPastDueAmt,
      paid: invPaid,
      paidAmountCents: invPaidAmt,
      uncollectible: invUncollectible,
      uncollectibleAmountCents: invUncollectibleAmt,
      mirrorEmpty: invTotal === 0,
    },
    contracts: {
      total: contractTotal,
      activated: contractActivated,
      noStripeSub: contractNoStripeSub,
      endingThisMonth: contractEndingMonth,
      endingThisMonthMrr: contractEndingMrr,
    },
    payments: {
      totalYtd: payYtdTotal,
      totalYtdAmountCents: payYtdAmt,
      succeeded: paySucceeded,
      succeededAmountCents: paySucceededAmt,
      failed: payFailed,
      failedAmountCents: payFailedAmt,
      needingAction: payNeedingAction,
    },
    lanes: { renewalRisk: renewalsThisMonth, dataQuality, missingLinkage, invoiceRisk },
  };
}

// ---------------------------------------------------------------------------
// Safe action — Flag for Review
// ---------------------------------------------------------------------------

const FLAG_LABEL: Record<FlagReason, string> = { missing_linkage: "Missing system linkage", data_quality: "Data quality issue", correlation_issue: "Correlation mismatch" };

export async function flagAccountForReview(omniAccountId: string, reason: FlagReason, note?: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();
  const userId = (session.user as { id?: string } | undefined)?.id ?? null;
  try {
    await prisma.auditLog.create({ data: { actorUserId: userId, action: "flag_for_review", targetType: "customer_index", targetId: omniAccountId, customerId: omniAccountId, payloadJson: { reason, reasonLabel: FLAG_LABEL[reason], note: note ?? null, flaggedAt: new Date().toISOString() } } });
    return { success: true };
  } catch (err) { return { success: false, error: err instanceof Error ? err.message : "Failed to flag." }; }
}

// ---------------------------------------------------------------------------
// Per-account snapshot for Customer 360 drawer
// ---------------------------------------------------------------------------

export async function fetchAccountSnapshot(omniAccountId: string): Promise<AccountSnapshot | null> {
  await requireSession();

  // Get CustomerIndex to find stripe/sf IDs
  const ci = await prisma.customerIndex.findUnique({
    where: { id: omniAccountId },
    select: { stripeCustomerId: true, sfAccountId: true },
  });
  if (!ci) return null;

  const [subs, invoices, contracts, quotes, payments, customer] = await Promise.all([
    // Subscriptions for this customer
    ci.stripeCustomerId
      ? prisma.stripeSubscription.findMany({
          where: { customerId: ci.stripeCustomerId },
          select: { id: true, status: true, collectionMethod: true, cancelAtPeriodEnd: true },
          orderBy: { startDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Invoices
    ci.stripeCustomerId
      ? prisma.stripeInvoice.findMany({
          where: { customerId: ci.stripeCustomerId },
          select: { id: true, number: true, status: true, amountDue: true, amountRemaining: true, dueDate: true },
          orderBy: { stripeCreated: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Contracts
    ci.sfAccountId
      ? prisma.sfContract.findMany({
          where: { accountId: ci.sfAccountId },
          select: { id: true, contractNumber: true, status: true, startDate: true, endDate: true, stripeSubscriptionId: true, opportunityId: true, mrr: true },
          orderBy: { startDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Quotes (from mirror)
    ci.sfAccountId
      ? prisma.sfQuote.findMany({
          where: { accountId: ci.sfAccountId },
          select: { id: true, name: true, status: true, netAmount: true, opportunityId: true },
          orderBy: { sfCreatedDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Payments
    ci.stripeCustomerId
      ? prisma.stripePayment.findMany({
          where: { customerId: ci.stripeCustomerId },
          select: { id: true, status: true, amount: true, cardLast4: true },
          orderBy: { stripeCreated: "desc" },
          take: 3,
        })
      : Promise.resolve([]),
    // Customer delinquent + PM
    ci.stripeCustomerId
      ? prisma.stripeCustomer.findUnique({
          where: { id: ci.stripeCustomerId },
          select: { delinquent: true, defaultPaymentMethod: true },
        })
      : Promise.resolve(null),
  ]);

  // Compute MRR per subscription (simplified — count items)
  const subRows = subs.map(s => ({
    id: s.id,
    status: s.status,
    collectionMethod: s.collectionMethod ?? "charge_automatically",
    mrrCents: 0, // would need sub items for precise MRR
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  }));

  const invoiceRows = invoices.map(i => ({
    id: i.id,
    number: i.number,
    status: i.status ?? "unknown",
    amountDue: i.amountDue,
    amountRemaining: i.amountRemaining,
    dueDate: i.dueDate?.toISOString() ?? null,
  }));

  const contractRows = contracts.map(c => ({
    id: c.id,
    contractNumber: c.contractNumber,
    status: c.status,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    stripeSubId: c.stripeSubscriptionId,
    opportunityId: c.opportunityId,
    mrr: c.mrr,
  }));

  const quoteRows = quotes.map(q => ({
    id: q.id,
    name: q.name ?? "Untitled",
    status: q.status ?? "Unknown",
    totalAmount: q.netAmount == null ? null : Math.round(q.netAmount * 100),
    opportunityId: q.opportunityId,
  }));

  const paymentRows = payments.map(p => ({
    id: p.id,
    status: p.status,
    amount: p.amount,
    cardLast4: p.cardLast4,
  }));

  const isDelinquent = customer?.delinquent ?? false;
  const hasDefaultPm = !!customer?.defaultPaymentMethod;

  // Derive lifecycle truth from real objects
  const hasOpportunity = quoteRows.some(q => q.opportunityId) || contractRows.some(c => c.status === "Activated");
  const hasQuote = quoteRows.length > 0;
  const hasActiveSubscription = subRows.some(s => s.status === "active" || s.status === "trialing");
  const activeContracts = contractRows.filter(c => c.status === "Activated");
  const hasActiveContract = activeContracts.length > 0;
  const pastDueInvoices = invoiceRows.filter(i => i.status === "open" && i.dueDate && new Date(i.dueDate) < new Date());
  const hasCurrentInvoice = pastDueInvoices.length === 0 && invoiceRows.filter(i => i.status === "open").length === 0;
  const failedPayments = paymentRows.filter(p => p.status === "requires_payment_method" || p.status === "requires_action");
  const hasHealthyPayment = failedPayments.length === 0 && !isDelinquent;

  const breaks: string[] = [];
  if (hasActiveContract && !hasActiveSubscription) breaks.push("Active contract → no active Stripe subscription");
  if (hasActiveSubscription && !hasActiveContract) breaks.push("Active subscription → no active SF contract");
  if (quoteRows.some(q => q.status.toLowerCase() === "accepted" && q.opportunityId && !contractRows.some(c => c.opportunityId === q.opportunityId))) breaks.push("Accepted quote → no SF contract");
  if (quoteRows.some(q => q.status.toLowerCase() === "accepted" && q.opportunityId && !contractRows.some(c => c.opportunityId === q.opportunityId && c.stripeSubId))) breaks.push("Accepted quote → no subscription created");
  if (pastDueInvoices.length > 0) breaks.push(`${pastDueInvoices.length} past due invoice${pastDueInvoices.length > 1 ? "s" : ""}`);
  if (isDelinquent) breaks.push("Customer is delinquent");
  if (failedPayments.length > 0) breaks.push(`${failedPayments.length} payment${failedPayments.length > 1 ? "s" : ""} needing action`);

  return {
    subscriptions: subRows,
    invoices: invoiceRows,
    contracts: contractRows,
    quotes: quoteRows,
    payments: paymentRows,
    isDelinquent,
    hasDefaultPm,
    lifecycle: {
      hasOpportunity,
      hasQuote,
      hasActiveSubscription,
      hasCurrentInvoice,
      hasActiveContract,
      hasHealthyPayment,
      breaks,
    },
  };
}
