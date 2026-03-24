/**
 * Omni Subscription Facts — canonical subscription-level contract.
 *
 * Grain: one row per Stripe subscription
 *
 * Provides billing state, financials, and SF correlation for
 * each subscription. Routes consume this instead of querying
 * StripeSubscription + StripeSubscriptionItem + SfContract directly.
 */

import type { FreshnessInfo, ConfidenceFlagEntry } from "./shared-types";

export interface OmniSubscriptionFacts {
  // --- Identity ---
  subscriptionId: string; // sub_xxx
  omniAccountId: string; // customer_index.id
  stripeCustomerId: string;

  // --- Billing state ---
  status: string; // active | trialing | past_due | canceled | ...
  startDate: string; // ISO date
  currentPeriodStart: string; // ISO date
  currentPeriodEnd: string; // ISO date
  cancelAt: string | null; // ISO date
  canceledAt: string | null; // ISO date
  cancelAtPeriodEnd: boolean;

  // --- Line items ---
  itemCount: number;

  // --- Financials ---
  mrrCents: number; // computed from sub items
  arrCents: number; // mrrCents × 12

  // --- SF correlation ---
  sfContractId: string | null;
  sfCorrelationStatus: "matched" | "partial" | "no_contract";

  // --- Invoice coverage ---
  hasAnyPaidInvoice: boolean;
  lastPaidInvoiceDate: string | null; // ISO date
  lastPaidCoverageEnd: string | null; // ISO date — period_end of last paid invoice

  // --- Data quality ---
  freshness: FreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}
