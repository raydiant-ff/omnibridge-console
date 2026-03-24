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
  OpportunityContainer,
  QuotesContainer,
  SubscriptionsContainer,
  InvoicesContainer,
  ContractContainer,
  PaymentsContainer,
  FlagReason,
  AccountSnapshot,
} from "./types";

function pluralize(n: number, s: string, p?: string): string {
  return n === 1 ? s : (p ?? s + "s");
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

  // Phase 2: Lighter container queries (run after account summaries complete)
  const [
    // Reconciliation counts for banner
    activeSubNoContract, activeContractNoSub, contractLinkedToInactiveSub,
    // Quotes
    quoteTotal, quoteStatuses, quotesAcceptedNoSub, quotesAcceptedNoContract, quotesExpired,
    quotesAcceptedAmount,
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
    oppsDistinct, oppsNoContract,
    // Billing risk for banner
    delinquentCustomers,
  ] = await Promise.all([
    // Reconciliation
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(*) as cnt FROM stripe_subscriptions s WHERE s.status IN ('active','trialing') AND NOT EXISTS (SELECT 1 FROM sf_contracts c WHERE c.stripe_subscription_id = s.id AND c.status = 'Activated')`.then(r => Number(r[0]?.cnt ?? 0)),
    prisma.sfContract.count({ where: { status: "Activated", stripeSubscriptionId: null } }),
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(*) as cnt FROM sf_contracts c WHERE c.status = 'Activated' AND c.stripe_subscription_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stripe_subscriptions s WHERE s.id = c.stripe_subscription_id AND s.status IN ('active','trialing','past_due'))`.then(r => Number(r[0]?.cnt ?? 0)),
    // Quotes
    prisma.quoteRecord.count(),
    prisma.quoteRecord.groupBy({ by: ["status"], _count: true }),
    prisma.quoteRecord.count({ where: { status: "accepted", stripeSubscriptionId: null } }),
    prisma.quoteRecord.count({ where: { status: "accepted", sfContractId: null } }),
    prisma.quoteRecord.count({ where: { expiresAt: { lt: now }, status: { in: ["draft", "open"] } } }),
    prisma.quoteRecord.aggregate({ where: { status: "accepted" }, _sum: { totalAmount: true }, _count: true }),
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
    prisma.$queryRaw<[{cnt:bigint}]>`SELECT COUNT(DISTINCT q.opportunity_id) as cnt FROM quote_records q WHERE q.opportunity_id IS NOT NULL AND q.status = 'accepted' AND NOT EXISTS (SELECT 1 FROM sf_contracts c WHERE c.opportunity_id = q.opportunity_id)`.then(r => Number(r[0]?.cnt ?? 0)),
    // Billing risk
    prisma.stripeCustomer.count({ where: { delinquent: true } }),
  ]);

  const { accounts } = report;

  // Banner
  let mrrAtRiskCents = 0;
  let billingRiskAccounts = 0;
  for (const a of accounts) {
    if (a.renewalSummary.hasOverdue || a.renewalSummary.hasDueSoon || a.renewalSummary.hasCancelling) {
      mrrAtRiskCents += a.renewalSummary.renewalMrrCents;
    }
    if (a.pastDueInvoiceCount > 0 || a.signalCategories.includes("invoice_risk")) billingRiskAccounts++;
  }

  const lifecycleBreaks = activeSubNoContract + activeContractNoSub + contractLinkedToInactiveSub;
  const totalArrCents = report.totalMrrCents * 12;
  const atRiskArrCents = mrrAtRiskCents * 12;

  const banner: BannerMetrics = {
    accounts: report.totalAccounts,
    needAttention: report.accountsWithSignals,
    totalMrrCents: report.totalMrrCents,
    totalArrCents,
    atRiskArrCents,
    billingRisk: billingRiskAccounts + delinquentCustomers,
    lifecycleBreaks,
  };

  // Priority lanes + rows (same as before)
  const renewalRisk = accounts.filter(a => a.signalCategories.includes("renewal_risk")).sort((a, b) => {
    if (a.renewalSummary.hasOverdue !== b.renewalSummary.hasOverdue) return a.renewalSummary.hasOverdue ? -1 : 1;
    return (a.renewalSummary.daysToNearestRenewal ?? Infinity) - (b.renewalSummary.daysToNearestRenewal ?? Infinity);
  }).slice(0, 10);
  const dataQuality = accounts.filter(a => a.dqSummary.issueCount > 0).sort((a, b) => {
    const r: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (r[b.dqSummary.worstSeverity ?? ""] ?? 0) - (r[a.dqSummary.worstSeverity ?? ""] ?? 0) || b.dqSummary.issueCount - a.dqSummary.issueCount;
  }).slice(0, 10);
  const missingLinkage = accounts.filter(a => a.signalCategories.includes("missing_linkage") || a.signalCategories.includes("correlation_issue")).sort((a, b) => b.activeMrrCents - a.activeMrrCents).slice(0, 10);
  const invoiceRisk = accounts.filter(a => a.pastDueInvoiceCount > 0).sort((a, b) => b.pastDueInvoiceCount - a.pastDueInvoiceCount).slice(0, 10);

  const seen = new Set<string>();
  const priorityRows: PriorityAccountRow[] = [];
  function addRow(a: OmniAccountSummary, bl: string, rr: string, sev: "critical"|"high"|"medium", href: string) {
    if (seen.has(a.omniAccountId)) return;
    seen.add(a.omniAccountId);
    priorityRows.push({ omniAccountId: a.omniAccountId, displayName: a.displayName, csmName: a.csmName, activeMrrCents: a.activeMrrCents, breakLocation: bl, riskReason: rr, severity: sev, isFlagged: a.reviewState.isFlagged, href });
  }
  for (const a of renewalRisk) { const rs = a.renewalSummary; addRow(a, "Subscription → Renewal", rs.hasOverdue ? "Overdue" : rs.hasCancelling ? "Cancelling" : "Due soon", rs.hasOverdue || rs.hasCancelling ? "critical" : "high", `/cs/renewals?account=${encodeURIComponent(a.omniAccountId)}`); }
  for (const a of invoiceRisk) { addRow(a, "Invoice → Payment", `${a.pastDueInvoiceCount} past due`, "critical", `/customers/${encodeURIComponent(a.omniAccountId)}`); }
  for (const a of dataQuality) { addRow(a, "Data Quality", `${a.dqSummary.issueCount} issues`, a.dqSummary.worstSeverity === "critical" ? "critical" : "high", `/cs/data-quality?account=${encodeURIComponent(a.omniAccountId)}`); }
  for (const a of missingLinkage) { const p = []; if (!a.hasSalesforce) p.push("No SF"); if (!a.hasStripe) p.push("No Stripe"); addRow(a, "Contract ↔ Sub", p.join(", "), "medium", `/customers/${encodeURIComponent(a.omniAccountId)}`); }
  priorityRows.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity]) - ({ critical: 0, high: 1, medium: 2 }[b.severity]));

  return {
    trust,
    banner,
    priorityRows: priorityRows.slice(0, 15),
    opportunities: {
      trackedTotal: oppsDistinct,
      noContractFromQuote: oppsNoContract,
      isPartial: true,
    },
    quotes: {
      total: quoteTotal,
      byStatus: quoteStatuses.map(s => ({ status: s.status, count: s._count })),
      acceptedTotal: quotesAcceptedAmount._count,
      acceptedAmountCents: quotesAcceptedAmount._sum.totalAmount ?? 0,
      acceptedNoSub: quotesAcceptedNoSub,
      acceptedNoContract: quotesAcceptedNoContract,
      expiredOpen: quotesExpired,
    },
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
    lanes: { renewalRisk, dataQuality, missingLinkage, invoiceRisk },
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
          select: { id: true, contractNumber: true, status: true, startDate: true, endDate: true, stripeSubscriptionId: true, mrr: true },
          orderBy: { startDate: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    // Quotes
    prisma.quoteRecord.findMany({
      where: { customerId: omniAccountId },
      select: { id: true, status: true, quoteType: true, totalAmount: true, sfContractId: true, stripeSubscriptionId: true, opportunityId: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
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
    mrr: c.mrr,
  }));

  const quoteRows = quotes.map(q => ({
    id: q.id,
    status: q.status,
    quoteType: q.quoteType,
    totalAmount: q.totalAmount,
    sfContractId: q.sfContractId,
    stripeSubId: q.stripeSubscriptionId,
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
  if (quoteRows.some(q => q.status === "accepted" && !q.sfContractId)) breaks.push("Accepted quote → no SF contract");
  if (quoteRows.some(q => q.status === "accepted" && !q.stripeSubId)) breaks.push("Accepted quote → no subscription created");
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
