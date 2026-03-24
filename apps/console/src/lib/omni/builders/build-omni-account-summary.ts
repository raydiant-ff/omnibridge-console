/**
 * Builder: Omni Account Summary
 *
 * Composes account spine + renewal candidates + DQ issues
 * into a single reusable account-level summary.
 *
 * This is the canonical cross-surface account signal builder.
 * Routes should consume this instead of assembling signals ad hoc.
 */

import { prisma } from "@omnibridge/db";
import { buildOmniAccountSpines } from "./build-omni-account-spine";
import { buildAllOmniRenewalCandidates } from "./build-omni-renewal-candidates";
import { buildOmniDataQualityIssues } from "./build-omni-data-quality-issues";
import type { OmniAccountSpine } from "../contracts/omni-account-spine";
import type {
  OmniAccountSummary,
  OmniAccountSummaryReport,
  AccountRenewalSummary,
  AccountDqSummary,
  AccountSignalCategory,
  AccountReviewState,
} from "../contracts/omni-account-summary";
import type { IssueSeverity } from "../contracts/omni-data-quality-issues";
import type { OmniRenewalCandidate } from "../contracts/omni-renewal-candidates";

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ---------------------------------------------------------------------------
// Sub-summary builders
// ---------------------------------------------------------------------------

function buildRenewalSummary(
  candidates: OmniRenewalCandidate[],
): AccountRenewalSummary {
  if (candidates.length === 0) {
    return {
      candidateCount: 0,
      nearestRenewalDate: null,
      daysToNearestRenewal: null,
      worstRenewalStatus: null,
      renewalMrrCents: 0,
      hasOverdue: false,
      hasDueSoon: false,
      hasCancelling: false,
    };
  }

  let nearestDate: string | null = null;
  let nearestDays: number | null = null;
  let worstStatus: OmniRenewalCandidate["status"] | null = null;
  const STATUS_ORDER = { cancelling: 3, scheduled_end: 2, period_ending: 1 };
  let worstStatusSeverity = 0;

  let totalMrr = 0;
  let hasOverdue = false;
  let hasDueSoon = false;
  let hasCancelling = false;

  for (const c of candidates) {
    totalMrr += c.mrrCents;

    if (c.renewalDate && (!nearestDate || c.renewalDate < nearestDate)) {
      nearestDate = c.renewalDate;
      nearestDays = c.daysToRenewal;
    }

    const statusSev = STATUS_ORDER[c.status] ?? 0;
    if (statusSev > worstStatusSeverity) {
      worstStatusSeverity = statusSev;
      worstStatus = c.status;
    }

    if (c.daysToRenewal !== null && c.daysToRenewal < 0) hasOverdue = true;
    if (c.daysToRenewal !== null && c.daysToRenewal >= 0 && c.daysToRenewal <= 7) hasDueSoon = true;
    if (c.status === "cancelling") hasCancelling = true;
  }

  return {
    candidateCount: candidates.length,
    nearestRenewalDate: nearestDate,
    daysToNearestRenewal: nearestDays,
    worstRenewalStatus: worstStatus,
    renewalMrrCents: totalMrr,
    hasOverdue,
    hasDueSoon,
    hasCancelling,
  };
}

function buildDqSummary(
  issues: { severity: IssueSeverity; issueType: string }[],
): AccountDqSummary {
  if (issues.length === 0) {
    return { issueCount: 0, worstSeverity: null, issueTypes: [] };
  }

  let worstSeverity: IssueSeverity = issues[0].severity;
  const typeSet = new Set<string>();

  for (const issue of issues) {
    if (SEVERITY_ORDER[issue.severity] > SEVERITY_ORDER[worstSeverity]) {
      worstSeverity = issue.severity;
    }
    typeSet.add(issue.issueType);
  }

  return {
    issueCount: issues.length,
    worstSeverity,
    issueTypes: [...typeSet].sort(),
  };
}

function deriveCategories(
  spine: OmniAccountSpine,
  renewalSummary: AccountRenewalSummary,
  dqSummary: AccountDqSummary,
): AccountSignalCategory[] {
  const cats: AccountSignalCategory[] = [];

  if (!spine.sfAccountId || !spine.stripeCustomerId) cats.push("missing_linkage");
  if (spine.activeSubscriptionCount === 0 && spine.stripeCustomerId) cats.push("no_active_subscription");
  if (spine.pastDueInvoiceCount > 0) cats.push("invoice_risk");
  if (renewalSummary.hasOverdue || renewalSummary.hasDueSoon || renewalSummary.hasCancelling) {
    cats.push("renewal_risk");
  }
  if (dqSummary.issueCount > 0) cats.push("data_quality");
  if (spine.confidenceFlags.some((f) =>
    f.flag === "sf_correlation_partial" || f.flag === "sf_correlation_missing",
  )) {
    cats.push("correlation_issue");
  }
  if (spine.freshness.state === "stale" || spine.freshness.state === "degraded") {
    cats.push("stale_data");
  }

  return cats;
}

// ---------------------------------------------------------------------------
// Review state from AuditLog
// ---------------------------------------------------------------------------

interface FlagRow {
  customerId: string;
  createdAt: Date;
  payloadJson: unknown;
  actorName: string | null;
}

async function fetchReviewFlags(
  customerIndexIds?: string[],
): Promise<Map<string, AccountReviewState>> {
  // Get the most recent flag_for_review per customer
  const whereClause: Record<string, unknown> = { action: "flag_for_review", customerId: { not: null } };
  if (customerIndexIds?.length) {
    whereClause.customerId = { in: customerIndexIds };
  }

  const flags = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    select: {
      customerId: true,
      createdAt: true,
      payloadJson: true,
      actor: { select: { name: true } },
    },
  });

  const map = new Map<string, AccountReviewState>();
  for (const flag of flags) {
    if (!flag.customerId || map.has(flag.customerId)) continue; // keep only most recent
    const payload = flag.payloadJson as { reason?: string } | null;
    map.set(flag.customerId, {
      isFlagged: true,
      lastFlaggedAt: flag.createdAt.toISOString(),
      lastFlagReason: payload?.reason ?? null,
      lastFlaggedBy: flag.actor?.name ?? null,
    });
  }

  return map;
}

const EMPTY_REVIEW_STATE: AccountReviewState = {
  isFlagged: false,
  lastFlaggedAt: null,
  lastFlagReason: null,
  lastFlaggedBy: null,
};

// ---------------------------------------------------------------------------
// Dev-only in-memory cache (30s TTL, unscoped reads only)
// ---------------------------------------------------------------------------

const DEV_CACHE_TTL = process.env.NODE_ENV === "development" ? 30_000 : 0;
let devCache: { data: OmniAccountSummaryReport; ts: number } | null = null;

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildOmniAccountSummaries(
  customerIndexIds?: string[],
): Promise<OmniAccountSummaryReport> {
  // Dev cache: return cached result for unscoped reads within TTL
  if (DEV_CACHE_TTL && !customerIndexIds && devCache && Date.now() - devCache.ts < DEV_CACHE_TTL) {
    return devCache.data;
  }

  // Fetch all data sources in parallel — scoped when IDs provided
  const [spines, allCandidates, dqReport, reviewFlags] = await Promise.all([
    buildOmniAccountSpines(customerIndexIds),
    buildAllOmniRenewalCandidates(customerIndexIds),
    buildOmniDataQualityIssues(customerIndexIds),
    fetchReviewFlags(customerIndexIds),
  ]);

  // Index renewal candidates by omniAccountId
  const renewalsByAccount = new Map<string, OmniRenewalCandidate[]>();
  for (const c of allCandidates) {
    const list = renewalsByAccount.get(c.omniAccountId) ?? [];
    list.push(c);
    renewalsByAccount.set(c.omniAccountId, list);
  }

  // Index DQ issues by omniAccountId
  const dqByAccount = new Map<string, { severity: IssueSeverity; issueType: string }[]>();
  for (const issue of dqReport.issues) {
    if (!issue.omniAccountId) continue;
    const list = dqByAccount.get(issue.omniAccountId) ?? [];
    list.push({ severity: issue.severity, issueType: issue.issueType });
    dqByAccount.set(issue.omniAccountId, list);
  }

  // Build summaries
  const accounts: OmniAccountSummary[] = spines.map((spine) => {
    const renewalCandidates = renewalsByAccount.get(spine.omniAccountId) ?? [];
    const dqIssues = dqByAccount.get(spine.omniAccountId) ?? [];

    const renewalSummary = buildRenewalSummary(renewalCandidates);
    const dqSummary = buildDqSummary(dqIssues);
    const signalCategories = deriveCategories(spine, renewalSummary, dqSummary);

    return {
      omniAccountId: spine.omniAccountId,
      displayName: spine.displayName,
      sfAccountId: spine.sfAccountId,
      stripeCustomerId: spine.stripeCustomerId,
      domain: spine.domain,
      csmName: spine.csmName,
      accountOwnerName: spine.accountOwnerName,
      accountStatus: spine.accountStatus,
      hasSalesforce: spine.sfAccountId != null,
      hasStripe: spine.stripeCustomerId != null,
      activeSubscriptionCount: spine.activeSubscriptionCount,
      activeMrrCents: spine.activeMrrCents,
      activeArrCents: spine.activeArrCents,
      pastDueInvoiceCount: spine.pastDueInvoiceCount,
      openInvoiceCount: spine.openInvoiceCount,
      renewalSummary,
      dqSummary,
      signalCategories,
      reviewState: reviewFlags.get(spine.omniAccountId) ?? EMPTY_REVIEW_STATE,
      freshness: spine.freshness,
      confidenceFlags: spine.confidenceFlags,
    };
  });

  // Sort: accounts with more signals first, then by MRR descending
  accounts.sort((a, b) => {
    if (a.signalCategories.length !== b.signalCategories.length) {
      return b.signalCategories.length - a.signalCategories.length;
    }
    return b.activeMrrCents - a.activeMrrCents;
  });

  const result: OmniAccountSummaryReport = {
    accounts,
    totalAccounts: accounts.length,
    accountsWithSignals: accounts.filter((a) => a.signalCategories.length > 0).length,
    totalMrrCents: accounts.reduce((s, a) => s + a.activeMrrCents, 0),
  };

  // Populate dev cache for unscoped reads
  if (DEV_CACHE_TTL && !customerIndexIds) {
    devCache = { data: result, ts: Date.now() };
  }

  return result;
}
