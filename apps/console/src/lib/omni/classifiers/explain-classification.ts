/**
 * Plain-English labels and bucket-level explanations for every
 * OmniSubscriptionClassification. Single source for UI tooltips,
 * info panels, and static copy.
 *
 * Row-level explanations are produced by classify-subscription.ts
 * so they can reference the specific signals that drove the bucket.
 */

import type { OmniSubscriptionClassification } from "../contracts/omni-subscription-classification";

export const CLASSIFICATION_LABELS: Record<OmniSubscriptionClassification, string> = {
  legacy_term_encoded: "Legacy — term-encoded",
  legacy_true_churn: "Legacy — true churn",
  omni_managed_fixed: "Omni-managed — fixed term",
  omni_managed_auto_renew: "Omni-managed — auto-renew",
  needs_review: "Needs review",
};

export const CLASSIFICATION_EXPLANATIONS: Record<OmniSubscriptionClassification, string> = {
  legacy_term_encoded:
    "Stripe is scheduled to end this subscription at period end, but the Salesforce contract policy says it should renew. This is the legacy term-encoded pattern — revenue that disappears from Stripe's native forecast but is likely continuing.",
  legacy_true_churn:
    "Stripe and Salesforce agree this subscription is ending. No forecast adjustment needed.",
  omni_managed_fixed:
    "This subscription is scheduled to end (or roll over via a Stripe schedule) in a way that matches Salesforce policy. Stripe's forecast correctly reflects the intended lifecycle.",
  omni_managed_auto_renew:
    "Stripe and Salesforce both indicate this subscription continues indefinitely. No forecast adjustment needed.",
  needs_review:
    "Stripe and Salesforce disagree in a way that requires human judgment before this subscription can be classified confidently.",
};
