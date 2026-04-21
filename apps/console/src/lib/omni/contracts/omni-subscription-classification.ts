/**
 * Omni Subscription Classification — Phase 1 truth-layer output.
 *
 * Grain: one classification per Stripe subscription.
 * Produced by the pure classifier from OmniSubscriptionFacts.
 */

export type OmniSubscriptionClassification =
  | "legacy_term_encoded"
  | "legacy_true_churn"
  | "omni_managed_fixed"
  | "omni_managed_auto_renew"
  | "needs_review";

export interface OmniSubscriptionClassificationPolicyView {
  sfContractId: string | null;
  sfContractStatus: string | null;
  sfEndDate: string | null;
  sfEvergreen: boolean | null;
  sfDoNotRenew: boolean | null;
  sfRenewalTerm: number | null;
  autoRenewIntent: boolean;
}

export interface OmniSubscriptionClassificationStripeView {
  status: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasSchedule: boolean;
  currentPeriodEnd: string;
  terminating: boolean;
}

export interface OmniSubscriptionClassificationResult {
  subscriptionId: string;
  omniAccountId: string;
  classification: OmniSubscriptionClassification;
  /** Row-level plain-English reason for this row's classification. */
  explanation: string;
  /** Annualized forecast adjustment in cents. Non-zero only for legacy_term_encoded. */
  forecastDeltaCents: number;
  /** Populated only when classification is "needs_review". */
  needsReviewReason: string | null;
  policyView: OmniSubscriptionClassificationPolicyView;
  stripeView: OmniSubscriptionClassificationStripeView;
}
