/**
 * Builder: Omni Data Quality Issues
 *
 * Scans across CustomerIndex, StripeSubscription, StripeCustomer,
 * SfAccount, and SfContract to detect deterministic data quality problems.
 *
 * Issue types implemented:
 * - missing_stripe_customer
 * - missing_sf_account
 * - subscription_missing_sf_contract
 * - sub_item_missing_sf_line
 * - stale_sync
 * - suspicious_account_name
 * - orphaned_record
 */

import { prisma } from "@omnibridge/db";
import { computeFreshness } from "../contracts/shared-types";
import type {
  OmniDataQualityIssue,
  OmniDataQualityReport,
  IssueSeverity,
} from "../contracts/omni-data-quality-issues";

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function makeIssueId(
  issueType: string,
  entityType: string,
  entityId: string,
): string {
  return `${issueType}:${entityType}:${entityId}`;
}

// ---------------------------------------------------------------------------
// Suspicious name patterns
// ---------------------------------------------------------------------------

const SUSPICIOUS_PATTERNS = [
  /^\s*$/,                        // blank
  /^test/i,                       // starts with "test"
  /test account/i,                // contains "test account"
  /\b(internal|demo|sandbox)\b/i, // internal/demo/sandbox
  /_old$/i,                       // ends with "_old"
  /^delete/i,                     // starts with "delete"
  /^do not use/i,                 // "do not use"
  /^zzz/i,                        // often used for "sort to bottom"
];

function isSuspiciousName(name: string | null): boolean {
  if (!name || name.trim().length === 0) return true;
  return SUSPICIOUS_PATTERNS.some((p) => p.test(name));
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOmniDataQualityIssues(
  omniAccountIds?: string[],
): Promise<OmniDataQualityReport> {
  const now = new Date().toISOString();
  const issues: OmniDataQualityIssue[] = [];

  // Global freshness
  const freshnessRows = await prisma.$queryRawUnsafe<{ max_synced: Date | null }[]>(
    `SELECT MAX(synced_at) AS max_synced FROM stripe_subscriptions`,
  );
  const freshness = computeFreshness(freshnessRows[0]?.max_synced ?? null);

  // ---------------------------------------------------------------------------
  // 1. missing_stripe_customer
  //    CustomerIndex with no stripeCustomerId but has sfAccountId
  // ---------------------------------------------------------------------------
  const missingStripe = await prisma.customerIndex.findMany({
    where: {
      stripeCustomerId: null,
      sfAccountId: { not: null },
    },
    select: { id: true, sfAccountId: true, sfAccountName: true },
  });

  for (const ci of missingStripe) {
    issues.push({
      issueId: makeIssueId("missing_stripe_customer", "customer_index", ci.id),
      severity: "high",
      issueType: "missing_stripe_customer",
      entityType: "customer_index",
      entityId: ci.id,
      omniAccountId: ci.id,
      displayName: ci.sfAccountName,
      summary: "Account has no linked Stripe customer.",
      recommendedAction: "Verify Stripe customer mapping and backfill customer_index.stripe_customer_id.",
      sourceSystem: "omni",
      detectedAt: now,
      freshness,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. missing_sf_account
  //    CustomerIndex with no sfAccountId but has stripeCustomerId
  // ---------------------------------------------------------------------------
  const missingSf = await prisma.customerIndex.findMany({
    where: {
      sfAccountId: null,
      stripeCustomerId: { not: null },
    },
    select: { id: true, stripeCustomerId: true, sfAccountName: true },
  });

  // Check if these have active subscriptions (to gauge severity)
  const missingSfStripeIds = missingSf
    .map((ci) => ci.stripeCustomerId)
    .filter((id): id is string => id != null);
  const activeSubCounts = missingSfStripeIds.length > 0
    ? await prisma.$queryRawUnsafe<{ customer_id: string; cnt: number }[]>(
        `SELECT customer_id, COUNT(*)::int AS cnt
         FROM stripe_subscriptions
         WHERE customer_id = ANY($1)
           AND status IN ('active', 'trialing', 'past_due')
         GROUP BY customer_id`,
        missingSfStripeIds,
      )
    : [];
  const activeSubMap = new Map(activeSubCounts.map((r) => [r.customer_id, r.cnt]));

  for (const ci of missingSf) {
    const hasActiveSubs = (activeSubMap.get(ci.stripeCustomerId!) ?? 0) > 0;
    issues.push({
      issueId: makeIssueId("missing_sf_account", "customer_index", ci.id),
      severity: hasActiveSubs ? "high" : "medium",
      issueType: "missing_sf_account",
      entityType: "customer_index",
      entityId: ci.id,
      omniAccountId: ci.id,
      displayName: ci.sfAccountName,
      summary: hasActiveSubs
        ? "Account has active Stripe subscriptions but no linked Salesforce account."
        : "Account has Stripe data but no linked Salesforce account.",
      recommendedAction: "Verify Salesforce account mapping and backfill customer_index.sf_account_id.",
      sourceSystem: "omni",
      detectedAt: now,
      freshness,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. subscription_missing_sf_contract
  //    Active Stripe subscriptions with no linked SF contract
  // ---------------------------------------------------------------------------
  const subsNoContract = await prisma.$queryRawUnsafe<{
    sub_id: string;
    customer_id: string;
    customer_name: string;
    status: string;
  }[]>(
    `SELECT sub.id AS sub_id, sub.customer_id, sub.customer_name, sub.status
     FROM stripe_subscriptions sub
     LEFT JOIN sf_contracts sf ON sf.stripe_subscription_id = sub.id
     WHERE sub.status IN ('active', 'trialing', 'past_due')
       AND sf.id IS NULL
     ORDER BY sub.customer_name`,
  );

  // Resolve omniAccountIds
  const subCustomerIds = [...new Set(subsNoContract.map((s) => s.customer_id))];
  const ciForSubs = subCustomerIds.length > 0
    ? await prisma.customerIndex.findMany({
        where: { stripeCustomerId: { in: subCustomerIds } },
        select: { id: true, stripeCustomerId: true },
      })
    : [];
  const ciSubMap = new Map(ciForSubs.map((r) => [r.stripeCustomerId, r.id]));

  for (const sub of subsNoContract) {
    issues.push({
      issueId: makeIssueId("subscription_missing_sf_contract", "stripe_subscription", sub.sub_id),
      severity: sub.status === "active" ? "high" : "medium",
      issueType: "subscription_missing_sf_contract",
      entityType: "stripe_subscription",
      entityId: sub.sub_id,
      omniAccountId: ciSubMap.get(sub.customer_id) ?? null,
      displayName: sub.customer_name,
      summary: "Stripe subscription has no linked Salesforce contract.",
      recommendedAction: "Investigate contract sync and create or repair SF contract linkage.",
      sourceSystem: "stripe",
      detectedAt: now,
      freshness,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. sub_item_missing_sf_line
  //    Active sub items with no SF contract line correlation
  // ---------------------------------------------------------------------------
  const itemsNoLine = await prisma.$queryRawUnsafe<{
    item_id: string;
    subscription_id: string;
    customer_id: string;
    product_name: string;
    customer_name: string;
  }[]>(
    `SELECT si.id AS item_id, si.subscription_id, si.customer_id,
            si.product_name, sub.customer_name
     FROM stripe_subscription_items si
     JOIN stripe_subscriptions sub ON sub.id = si.subscription_id
     WHERE sub.status IN ('active', 'trialing', 'past_due')
       AND si.sf_contract_line_id IS NULL
       AND si.usage_type = 'licensed'
       AND si.unit_amount > 0
     ORDER BY sub.customer_name`,
  );

  for (const item of itemsNoLine) {
    issues.push({
      issueId: makeIssueId("sub_item_missing_sf_line", "stripe_subscription_item", item.item_id),
      severity: "medium",
      issueType: "sub_item_missing_sf_line",
      entityType: "stripe_subscription_item",
      entityId: item.item_id,
      omniAccountId: ciSubMap.get(item.customer_id) ?? null,
      displayName: `${item.customer_name} — ${item.product_name}`,
      summary: "Subscription item has no Salesforce contract line correlation.",
      recommendedAction: "Review product/price mapping and repair SF contract line linkage.",
      sourceSystem: "stripe",
      detectedAt: now,
      freshness,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. stale_sync
  //    Source tables with stale synced_at timestamps
  // ---------------------------------------------------------------------------
  const staleSources = await prisma.$queryRawUnsafe<{
    source_table: string;
    max_synced: Date | null;
  }[]>(
    `SELECT 'stripe_subscriptions' AS source_table, MAX(synced_at) AS max_synced FROM stripe_subscriptions
     UNION ALL
     SELECT 'stripe_customers', MAX(synced_at) FROM stripe_customers
     UNION ALL
     SELECT 'sf_accounts', MAX(synced_at) FROM sf_accounts
     UNION ALL
     SELECT 'sf_contracts', MAX(synced_at) FROM sf_contracts`,
  );

  for (const src of staleSources) {
    const srcFreshness = computeFreshness(src.max_synced);
    if (srcFreshness.state === "stale" || srcFreshness.state === "degraded") {
      issues.push({
        issueId: makeIssueId("stale_sync", "sf_account", src.source_table),
        severity: srcFreshness.state === "degraded" ? "high" : "medium",
        issueType: "stale_sync",
        entityType: "sf_account", // generic; represents the source table
        entityId: src.source_table,
        omniAccountId: null,
        displayName: src.source_table,
        summary: `${src.source_table} data has not synced recently.`,
        recommendedAction: "Check sync pipeline health and refresh stale source data.",
        sourceSystem: src.source_table.startsWith("stripe") ? "stripe" : "salesforce",
        detectedAt: now,
        freshness: srcFreshness,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. suspicious_account_name
  //    SF accounts with suspicious names — resolve omniAccountId via CI
  // ---------------------------------------------------------------------------
  const sfAccounts = await prisma.sfAccount.findMany({
    where: { isStub: false },
    select: { id: true, name: true, syncedAt: true },
  });

  // Resolve SF account IDs to CustomerIndex IDs
  const sfAccountIds = sfAccounts.map((a) => a.id);
  const ciForSfAccounts = sfAccountIds.length > 0
    ? await prisma.customerIndex.findMany({
        where: { sfAccountId: { in: sfAccountIds } },
        select: { id: true, sfAccountId: true },
      })
    : [];
  const ciSfMap = new Map(ciForSfAccounts.map((r) => [r.sfAccountId, r.id]));

  for (const acct of sfAccounts) {
    if (isSuspiciousName(acct.name)) {
      issues.push({
        issueId: makeIssueId("suspicious_account_name", "sf_account", acct.id),
        severity: "low",
        issueType: "suspicious_account_name",
        entityType: "sf_account",
        entityId: acct.id,
        omniAccountId: ciSfMap.get(acct.id) ?? null,
        displayName: acct.name || "(blank)",
        summary: "Account name appears suspicious or non-production.",
        recommendedAction: "Review account naming and merge, archive, or relabel as needed.",
        sourceSystem: "salesforce",
        detectedAt: now,
        freshness,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. orphaned_record
  //    Stripe customers with no CustomerIndex mapping
  // ---------------------------------------------------------------------------
  const orphanedCustomers = await prisma.$queryRawUnsafe<{
    id: string;
    name: string | null;
    has_active_sub: boolean;
  }[]>(
    `SELECT sc.id, sc.name,
            EXISTS(
              SELECT 1 FROM stripe_subscriptions sub
              WHERE sub.customer_id = sc.id
                AND sub.status IN ('active', 'trialing', 'past_due')
            ) AS has_active_sub
     FROM stripe_customers sc
     LEFT JOIN customer_index ci ON ci.stripe_customer_id = sc.id
     WHERE ci.id IS NULL
     ORDER BY sc.name`,
  );

  for (const cust of orphanedCustomers) {
    issues.push({
      issueId: makeIssueId("orphaned_record", "stripe_customer", cust.id),
      severity: cust.has_active_sub ? "high" : "medium",
      issueType: "orphaned_record",
      entityType: "stripe_customer",
      entityId: cust.id,
      omniAccountId: null,
      displayName: cust.name,
      summary: cust.has_active_sub
        ? "Stripe customer with active subscriptions is not connected to an Omni account."
        : "Stripe customer is not connected to an Omni account.",
      recommendedAction: "Repair source mapping so the record resolves into the Omni account spine.",
      sourceSystem: "stripe",
      detectedAt: now,
      freshness,
    });
  }

  // ---------------------------------------------------------------------------
  // Scope to specific accounts if requested
  // ---------------------------------------------------------------------------

  const scopedIssues = omniAccountIds?.length
    ? (() => {
        const idSet = new Set(omniAccountIds);
        return issues.filter((i) => i.omniAccountId && idSet.has(i.omniAccountId));
      })()
    : issues;

  // Sort and compile report
  // ---------------------------------------------------------------------------

  scopedIssues.sort((a, b) => {
    // severity descending
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) return sevDiff;
    // displayName ascending
    const nameA = a.displayName ?? "";
    const nameB = b.displayName ?? "";
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) return nameDiff;
    // detectedAt descending
    return b.detectedAt.localeCompare(a.detectedAt);
  });

  return {
    issues: scopedIssues,
    totalCount: scopedIssues.length,
    criticalCount: scopedIssues.filter((i) => i.severity === "critical").length,
    highCount: scopedIssues.filter((i) => i.severity === "high").length,
    mediumCount: scopedIssues.filter((i) => i.severity === "medium").length,
    lowCount: scopedIssues.filter((i) => i.severity === "low").length,
    freshness,
  };
}
