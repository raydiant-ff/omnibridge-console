/**
 * Omni Scrub Account Detail — canonical detail payload for scrub drill-down.
 *
 * Grain: one prepared detail payload per omniAccountId per month
 *
 * Provides all information needed to render the scrub detail panel:
 * canceled subscriptions with coverage, active subscriptions with SF correlation.
 */

import type { FreshnessInfo, CompositeFreshnessInfo, ConfidenceFlagEntry } from "./shared-types";

// ---------------------------------------------------------------------------
// Coverage assessment (reused from subscription-scrub-detail patterns)
// ---------------------------------------------------------------------------

export type CoverageAssessment =
  | "covered_past_cancellation"
  | "covered_to_term_end"
  | "potential_uncovered_interval"
  | "no_mirrored_paid_invoice"
  | "historical_coverage_incomplete";

export type CoverageConfidence = "high" | "medium" | "low";

export interface CoverageInfo {
  coveredThrough: string | null; // ISO date
  cancellationDate: string; // ISO date
  assessment: CoverageAssessment;
  confidence: CoverageConfidence;
  evidenceSource: string;
  notes: string;
  lastInvoiceId: string | null;
  lastInvoiceNumber: string | null;
  lastInvoiceAmountCents: number;
  lastInvoicePeriodStart: string | null; // ISO date
  lastInvoicePeriodEnd: string | null; // ISO date
}

// ---------------------------------------------------------------------------
// Subscription item detail
// ---------------------------------------------------------------------------

export interface ScrubSubItemDetail {
  id: string;
  productName: string;
  quantity: number;
  unitAmountCents: number;
  billingInterval: string | null;
  intervalCount: number;
  arrCents: number;
  sfContractLineId: string | null;
  correlationStatus: string | null;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface ScrubCanceledSubscription {
  subId: string;
  canceledAt: string; // ISO date
  startDate: string; // ISO date
  items: ScrubSubItemDetail[];
  arrCents: number;
  coverage: CoverageInfo;
}

export interface ScrubActiveSubscription {
  subId: string;
  status: string;
  startDate: string; // ISO date
  currentPeriodEnd: string; // ISO date
  arrCents: number;
  sfContractId: string | null;
  sfContractStatus: string | null;
  sfMatchStatus: "matched" | "no_contract" | "partial";
  items: ScrubSubItemDetail[];
}

export interface ScrubSummarySection {
  customerName: string;
  stripeCustomerId: string;
  scrubMonth: string;
  snapshotDate: string; // ISO date
  canceledArrCents: number;
  activeArrCents: number;
  netArrImpactCents: number;
}

// ---------------------------------------------------------------------------
// Top-level detail contract
// ---------------------------------------------------------------------------

export interface OmniScrubAccountDetail {
  summary: ScrubSummarySection;
  canceledSubscriptions: ScrubCanceledSubscription[];
  coverageAssessments: CoverageInfo[]; // flattened from all canceled subs
  activeSubscriptions: ScrubActiveSubscription[];
  /** Overall freshness for adapter compatibility. */
  freshness: FreshnessInfo;
  /** Source-aware freshness breakdown. */
  compositeFreshness: CompositeFreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}
