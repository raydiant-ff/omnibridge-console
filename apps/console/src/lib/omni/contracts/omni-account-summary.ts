/**
 * Omni Account Summary — canonical cross-surface account-level signal contract.
 *
 * Grain: one row per customer_index.id
 *
 * This is the reusable account-level operational model that powers
 * the CS Queue and future account-level surfaces. It composes:
 * - account spine (identity, billing state)
 * - renewal exposure (from renewal candidates)
 * - data quality burden (from DQ issue builder)
 * - explicit operational categories
 *
 * Routes should consume this instead of assembling signals ad hoc.
 */

import type { FreshnessInfo, ConfidenceFlagEntry } from "./shared-types";

// ---------------------------------------------------------------------------
// Sub-summaries
// ---------------------------------------------------------------------------

export interface AccountRenewalSummary {
  /** Number of renewal candidates for this account. */
  candidateCount: number;
  /** Nearest renewal date (ISO date string). */
  nearestRenewalDate: string | null;
  /** Days to nearest renewal. Negative = overdue. */
  daysToNearestRenewal: number | null;
  /** Highest-risk renewal status present. */
  worstRenewalStatus: "cancelling" | "scheduled_end" | "period_ending" | null;
  /** Total MRR at renewal across all candidates (cents). */
  renewalMrrCents: number;
  /** Whether any candidate is overdue. */
  hasOverdue: boolean;
  /** Whether any candidate is due within 7 days. */
  hasDueSoon: boolean;
  /** Whether any candidate is cancelling. */
  hasCancelling: boolean;
}

export interface AccountDqSummary {
  /** Total DQ issue count for this account. */
  issueCount: number;
  /** Highest severity present. */
  worstSeverity: "critical" | "high" | "medium" | "low" | null;
  /** Distinct issue types present. */
  issueTypes: string[];
}

export interface AccountReviewState {
  /** Whether the account has been flagged for review. */
  isFlagged: boolean;
  /** ISO timestamp of the most recent flag action. */
  lastFlaggedAt: string | null;
  /** Reason category from the most recent flag. */
  lastFlagReason: string | null;
  /** Display name of the user who last flagged. */
  lastFlaggedBy: string | null;
}

// ---------------------------------------------------------------------------
// Operational categories — explicit signals, not scores
// ---------------------------------------------------------------------------

export type AccountSignalCategory =
  | "missing_linkage"       // no SF or Stripe link
  | "correlation_issue"     // SF correlation partial/missing
  | "renewal_risk"          // has overdue, due-soon, or cancelling renewals
  | "invoice_risk"          // past due invoices
  | "stale_data"            // mirror data degraded
  | "no_active_subscription" // Stripe customer but no active subs
  | "data_quality";         // has DQ issues

// ---------------------------------------------------------------------------
// Top-level contract
// ---------------------------------------------------------------------------

export interface OmniAccountSummary {
  // --- Identity (from account spine) ---
  omniAccountId: string;
  displayName: string;
  sfAccountId: string | null;
  stripeCustomerId: string | null;
  domain: string | null;

  // --- Team ---
  csmName: string | null;
  accountOwnerName: string | null;
  accountStatus: string | null;

  // --- System linkage ---
  hasSalesforce: boolean;
  hasStripe: boolean;

  // --- Billing state ---
  activeSubscriptionCount: number;
  activeMrrCents: number;
  activeArrCents: number;

  // --- Invoice health ---
  pastDueInvoiceCount: number;
  openInvoiceCount: number;

  // --- Renewal exposure ---
  renewalSummary: AccountRenewalSummary;

  // --- Data quality ---
  dqSummary: AccountDqSummary;

  // --- Operational categories ---
  signalCategories: AccountSignalCategory[];

  // --- Review state (derived from AuditLog) ---
  reviewState: AccountReviewState;

  // --- Data freshness ---
  freshness: FreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}

export interface OmniAccountSummaryReport {
  accounts: OmniAccountSummary[];
  totalAccounts: number;
  accountsWithSignals: number;
  totalMrrCents: number;
}
