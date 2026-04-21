/**
 * Route-edge types for the Scrub workspace.
 *
 * These are the UI-compatible shapes that route components consume.
 * Originally defined in lib/queries/subscription-scrub.ts and
 * lib/queries/subscription-scrub-detail.ts — now adapter-local.
 *
 * All ARR/money fields are in **dollars** (the adapter converts from cents).
 */

import type { FreshnessInfo } from "../../contracts/shared-types";

// ---------------------------------------------------------------------------
// Table types (subscription-scrub)
// ---------------------------------------------------------------------------

export interface ScrubSubscription {
  id: string;
  status: string;
  customerName: string;
  canceledAt: string | null;
  createdAt: string;
  mrrCents: number;
  isNew?: boolean;
}

export interface ScrubRow {
  customerName: string;
  stripeCustomerId: string;
  sfAccountId: string | null;
  canceledSubs: ScrubSubscription[];
  canceledArrDollars: number;
  snapshotSubs: ScrubSubscription[];
  snapshotArrDollars: number;
  newSubs: ScrubSubscription[];
  newArrDollars: number;
  netArrDollars: number;
  totalActiveArrDollars: number;
  classification: "churned" | "contracted" | "offset" | "expanded";
}

export interface ScrubSummary {
  month: string;
  snapshotDate: string;
  totalAccounts: number;
  churned: number;
  contracted: number;
  offset: number;
  expanded: number;
  totalCanceledArr: number;
  totalNewArr: number;
  totalNetArr: number;
  freshness: FreshnessInfo;
}

export interface ScrubData {
  rows: ScrubRow[];
  summary: ScrubSummary;
}

// ---------------------------------------------------------------------------
// Detail types (subscription-scrub-detail)
// ---------------------------------------------------------------------------

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
