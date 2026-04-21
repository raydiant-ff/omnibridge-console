/**
 * Pure classifier: OmniSubscriptionFacts → OmniSubscriptionClassificationResult.
 *
 * Rules (Phase 1):
 *   - Salesforce policy is primary; Stripe state is evidence of divergence.
 *   - `needs_review` is exception-only — used when SF and Stripe disagree
 *     in a way that cannot be auto-resolved.
 *   - Forecast delta is annualized ARR, non-zero only for `legacy_term_encoded`.
 */

import type { OmniSubscriptionFacts } from "../contracts/omni-subscription-facts";
import type {
  OmniSubscriptionClassification,
  OmniSubscriptionClassificationResult,
  OmniSubscriptionClassificationPolicyView,
  OmniSubscriptionClassificationStripeView,
} from "../contracts/omni-subscription-classification";

export function classifySubscription(
  facts: OmniSubscriptionFacts,
): OmniSubscriptionClassificationResult {
  const stripeCanceled = facts.status === "canceled";
  const stripeScheduledToEnd = facts.cancelAtPeriodEnd || facts.cancelAt != null;
  const terminating = stripeCanceled || stripeScheduledToEnd;

  const hasPolicy = facts.sfContractId != null;
  const autoRenewIntent =
    hasPolicy &&
    facts.sfDoNotRenew !== true &&
    (facts.sfEvergreen === true ||
      (facts.sfRenewalTerm != null && facts.sfRenewalTerm > 0));

  const policyView: OmniSubscriptionClassificationPolicyView = {
    sfContractId: facts.sfContractId,
    sfContractStatus: facts.sfContractStatus,
    sfEndDate: facts.sfContractEndDate,
    sfEvergreen: facts.sfEvergreen,
    sfDoNotRenew: facts.sfDoNotRenew,
    sfRenewalTerm: facts.sfRenewalTerm,
    autoRenewIntent,
  };

  const stripeView: OmniSubscriptionClassificationStripeView = {
    status: facts.status,
    cancelAt: facts.cancelAt,
    cancelAtPeriodEnd: facts.cancelAtPeriodEnd,
    hasSchedule: facts.hasSchedule,
    currentPeriodEnd: facts.currentPeriodEnd,
    terminating,
  };

  const make = (
    classification: OmniSubscriptionClassification,
    explanation: string,
    forecastDeltaCents: number,
    needsReviewReason: string | null,
  ): OmniSubscriptionClassificationResult => ({
    subscriptionId: facts.subscriptionId,
    omniAccountId: facts.omniAccountId,
    classification,
    explanation,
    forecastDeltaCents,
    needsReviewReason,
    policyView,
    stripeView,
  });

  // 1. No linked SF contract — cannot evaluate renewal intent confidently.
  if (!hasPolicy) {
    const reason = stripeCanceled
      ? "Stripe subscription is canceled but no Salesforce contract is linked — cannot confirm churn was intentional."
      : stripeScheduledToEnd
        ? "Stripe subscription is scheduled to terminate but no Salesforce contract is linked — cannot verify intent."
        : "Active Stripe subscription with no linked Salesforce contract — cannot evaluate renewal policy.";
    return make("needs_review", reason, 0, reason);
  }

  // 2. Already canceled in Stripe.
  if (stripeCanceled) {
    if (autoRenewIntent) {
      const reason =
        "Stripe subscription is canceled, but Salesforce policy indicates it should renew. Human review required.";
      return make("needs_review", reason, 0, reason);
    }
    return make(
      "legacy_true_churn",
      "Salesforce policy does not indicate renewal and Stripe confirms the subscription is canceled.",
      0,
      null,
    );
  }

  // 3. Active but scheduled to end (cancelAtPeriodEnd or cancelAt set).
  if (stripeScheduledToEnd) {
    if (!autoRenewIntent) {
      return make(
        "omni_managed_fixed",
        "Salesforce policy indicates a fixed term and Stripe is scheduled to end the subscription accordingly.",
        0,
        null,
      );
    }
    if (facts.hasSchedule) {
      return make(
        "omni_managed_fixed",
        "Salesforce policy indicates renewal and a Stripe subscription schedule is in place to handle the rollover.",
        0,
        null,
      );
    }
    return make(
      "legacy_term_encoded",
      "Stripe is scheduled to end this subscription at period end, but Salesforce policy indicates it should renew. Annualized ARR will disappear from Stripe's forecast unless the renewal is reflected.",
      facts.arrCents,
      null,
    );
  }

  // 4. Active with no scheduled end.
  if (autoRenewIntent) {
    return make(
      "omni_managed_auto_renew",
      "Stripe subscription is active with no scheduled end and Salesforce policy indicates it should continue.",
      0,
      null,
    );
  }

  const reason =
    "Stripe subscription is active with no scheduled end, but Salesforce policy does not indicate renewal — expected a fixed end date or cancellation.";
  return make("needs_review", reason, 0, reason);
}
