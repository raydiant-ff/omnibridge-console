"use server";

/**
 * Workspace-level trust summary — queries MAX(synced_at) per mirror table
 * and computes composite freshness for CS-facing surfaces.
 *
 * This answers: "Can I trust what I'm looking at right now?"
 */

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import {
  computeCompositeFreshness,
  type FreshnessSource,
} from "../contracts/shared-types";
import type { WorkspaceTrustSummary } from "../contracts/workspace-trust-types";

interface MaxSyncRow {
  max_synced: Date | null;
}

async function queryMaxSync(table: string): Promise<Date | null> {
  const rows = await prisma.$queryRawUnsafe<MaxSyncRow[]>(
    `SELECT MAX(synced_at) as max_synced FROM "${table}"`,
  );
  return rows[0]?.max_synced ?? null;
}

async function queryRowCount(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*) as cnt FROM "${table}"`,
  );
  return Number(rows[0]?.cnt ?? 0);
}

const SOURCE_CONFIG: { source: FreshnessSource; table: string; label: string }[] = [
  { source: "stripe_customers", table: "stripe_customers", label: "Stripe Customers" },
  { source: "stripe_subscriptions", table: "stripe_subscriptions", label: "Stripe Subscriptions" },
  { source: "stripe_invoices", table: "stripe_invoices", label: "Stripe Invoices" },
  { source: "sf_accounts", table: "sf_accounts", label: "Salesforce Accounts" },
  { source: "sf_contracts", table: "sf_contracts", label: "Salesforce Contracts" },
];

export async function getWorkspaceTrustSummary(): Promise<WorkspaceTrustSummary> {
  await requireSession();

  // Query all sources in parallel
  const results = await Promise.all(
    SOURCE_CONFIG.map(async (cfg) => {
      const [maxSync, count] = await Promise.all([
        queryMaxSync(cfg.table),
        queryRowCount(cfg.table),
      ]);
      return { ...cfg, maxSync, count };
    }),
  );

  // Build composite freshness
  const entries = results.map((r) => ({
    source: r.source,
    syncedAt: r.maxSync,
  }));
  const freshness = computeCompositeFreshness(entries);

  // Detect missing sources (zero rows)
  const missingSources = results
    .filter((r) => r.count === 0)
    .map((r) => ({ source: r.source, label: r.label }));

  // Determine if warning should show
  const showWarning =
    freshness.overall.state === "stale" ||
    freshness.overall.state === "degraded" ||
    missingSources.length > 0;

  // Build summary label
  let summaryLabel: string;
  if (missingSources.length > 0) {
    const names = missingSources.map((s) => s.label).join(", ");
    summaryLabel = `Missing data: ${names}. Some workspace metrics may be incomplete.`;
  } else if (freshness.overall.state === "degraded") {
    const staleSources = freshness.sources
      .filter((s) => s.freshness.state === "degraded")
      .map((s) => s.source.replace(/_/g, " "));
    summaryLabel = `Data is outdated. ${staleSources.join(", ")} last synced more than 24 hours ago.`;
  } else if (freshness.overall.state === "stale") {
    summaryLabel = "Some data sources are stale (last synced 6-24 hours ago).";
  } else if (freshness.overall.state === "lagging") {
    summaryLabel = "Data is slightly behind (last synced 1-6 hours ago).";
  } else {
    summaryLabel = "All data sources are current.";
  }

  return {
    freshness,
    missingSources,
    showWarning,
    summaryLabel,
  };
}
