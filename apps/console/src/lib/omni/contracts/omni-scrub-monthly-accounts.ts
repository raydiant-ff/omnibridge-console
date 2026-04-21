/**
 * Omni Scrub Monthly Accounts — canonical monthly churn analysis contract.
 *
 * Grain: one row per omniAccountId per month
 *
 * Computes point-in-time snapshot ARR, canceled ARR, replacement ARR,
 * and classification for each customer that had cancellations in a month.
 */

import type { FreshnessInfo, CompositeFreshnessInfo, ConfidenceFlagEntry } from "./shared-types";

export type ScrubClassification = "churned" | "contracted" | "offset" | "expanded";

export interface ScrubSubscriptionRef {
  id: string;
  status: string;
  mrrCents: number;
  canceledAt: string | null; // ISO date
  createdAt: string | null; // ISO date
}

export interface OmniScrubMonthlyAccount {
  // --- Identity ---
  omniAccountId: string; // customer_index.id (or stripeCustomerId if no CI)
  stripeCustomerId: string; // always the Stripe customer ID (used for detail lookup)
  month: string; // YYYY-MM
  displayName: string;

  // --- Snapshot ---
  snapshotDate: string; // ISO — last day of prev month
  snapshotArrCents: number; // ARR as of snapshot date

  // --- Cancellation impact ---
  canceledArrCents: number;
  replacementArrCents: number; // ARR from new/replacement subs
  netArrImpactCents: number; // replacement - canceled

  // --- Classification ---
  classification: ScrubClassification;

  // --- Detail refs ---
  canceledSubscriptionCount: number;
  activeSubscriptionCountNow: number;
  canceledSubs: ScrubSubscriptionRef[];
  snapshotSubs: ScrubSubscriptionRef[];
  newSubs: ScrubSubscriptionRef[];

  // --- Risk flags ---
  hasCoverageRisk: boolean; // any canceled sub has coverage gap
  hasSfCorrelationRisk: boolean; // any active sub has no SF contract

  // --- Data quality ---
  freshness: FreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}

/**
 * Summary aggregates across all accounts in a scrub month.
 */
export interface OmniScrubMonthlySummary {
  month: string;
  snapshotDate: string;
  totalAccounts: number;
  churned: number;
  contracted: number;
  offset: number;
  expanded: number;
  totalCanceledArrCents: number;
  totalReplacementArrCents: number;
  totalNetArrImpactCents: number;
  /** Overall freshness (worst-case across sources) for adapter compatibility. */
  freshness: FreshnessInfo;
  /** Source-aware freshness breakdown. */
  compositeFreshness: CompositeFreshnessInfo;
}

export interface OmniScrubMonthlyData {
  rows: OmniScrubMonthlyAccount[];
  summary: OmniScrubMonthlySummary;
}
