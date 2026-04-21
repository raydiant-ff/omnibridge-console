/**
 * Omni Renewal Candidates — canonical renewal pipeline contract.
 *
 * Grain: one row per renewable contract/subscription candidate
 *
 * This is the backbone of the Renewals workspace. Composes SF contract
 * timing + Stripe subscription billing state + risk signals into a single
 * renewal-oriented row.
 *
 * candidateId uses the existing convention: "sub:{subId}" or "contract:{contractId}"
 */

import type { ConfidenceFlagEntry, FreshnessInfo } from "./shared-types";

export type BillingMode = "charge_automatically" | "send_invoice";
export type RenewalPriorityBucket = "overdue" | "due_today" | "due_soon" | "on_track";
export type RenewalCandidateStatus =
  | "cancelling"
  | "scheduled_end"
  | "period_ending";

export type RiskReason =
  | "past_due_subscription"
  | "cancelling"
  | "do_not_renew"
  | "no_linked_subscription"
  | "coverage_gap"
  | "sf_correlation_missing";

export interface RenewalCandidateItem {
  id: string;
  productName: string;
  unitAmountCents: number;
  currency: string;
  billingInterval: string | null;
  intervalCount: number;
  quantity: number;
  mrrCents: number;
}

export interface LinkedContractInfo {
  id: string;
  accountId: string;
  accountName: string | null;
  contractNumber: string | null;
  status: string;
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  contractTerm: number | null;
  ownerName: string | null;
  mrrApprox: number | null; // currency units from SF
  arrApprox: number | null;
  evergreen: boolean;
  doNotRenew: boolean;
  daysToExpiry: number | null;
  collectionMethod: string | null;
  lineCount: number;
}

export interface OmniRenewalCandidate {
  // --- Identity ---
  candidateId: string; // "sub:{subId}" or "contract:{contractId}"
  omniAccountId: string; // customer_index.id
  customerName: string;
  csmName: string | null;

  // --- Contract linkage ---
  sfContractId: string | null;
  subscriptionId: string | null;

  // --- Billing ---
  billingMode: BillingMode;
  items: RenewalCandidateItem[];

  // --- Renewal timing ---
  renewalDate: string; // ISO date — contract end_date or sub period end
  daysToRenewal: number | null;

  // --- Financials ---
  mrrCents: number;
  arrCents: number;

  // --- Status & risk ---
  status: RenewalCandidateStatus;
  subscriptionStatus: string | null; // raw Stripe status
  worstRiskReason: RiskReason | null;
  priorityBucket: RenewalPriorityBucket;

  // --- Contract detail ---
  contract: LinkedContractInfo | null;

  // --- Data quality ---
  freshness: FreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}

/**
 * Dashboard-level summary computed from candidates.
 */
export interface OmniRenewalSummary {
  total: number;
  totalMrr: number;
  allCount: number;
  autoRenewCount: number;
  reviewNeededCount: number;
  cancellingCount: number;
  cancellingMrr: number;
  scheduledEndCount: number;
  scheduledEndMrr: number;
  periodEndingCount: number;
  periodEndingMrr: number;
}

export interface OmniRenewalDashboardData {
  summary: OmniRenewalSummary;
  candidates: OmniRenewalCandidate[];
  overdue: OmniRenewalCandidate[];
  csmList: string[];
  freshness: FreshnessInfo;
}
