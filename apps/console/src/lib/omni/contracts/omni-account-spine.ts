/**
 * Omni Account Spine — canonical account-level contract.
 *
 * Grain: one row per customer_index.id
 *
 * Source of truth for "who is this customer across systems" with
 * aggregated billing and CRM state. Routes consume this instead of
 * joining CustomerIndex + SfAccount + StripeCustomer + StripeSubscription.
 */

import type { FreshnessInfo, ConfidenceFlagEntry } from "./shared-types";

export interface OmniAccountSpine {
  // --- Identity ---
  omniAccountId: string; // customer_index.id
  displayName: string; // SF account name → CI snapshot → Stripe name → "Unknown"
  sfAccountId: string | null;
  stripeCustomerId: string | null;
  domain: string | null;

  // --- Team ---
  accountOwnerName: string | null; // SF account owner
  csmName: string | null; // SF CSM

  // --- Account state ---
  accountStatus: string | null; // SF account status

  // --- Aggregated billing ---
  activeSubscriptionCount: number;
  activeMrrCents: number; // computed from Stripe sub items
  activeArrCents: number; // activeMrrCents × 12

  // --- Invoice health ---
  pastDueInvoiceCount: number;
  openInvoiceCount: number;
  lastInvoiceDate: string | null; // ISO date
  lastPaymentDate: string | null; // ISO date

  // --- Data quality ---
  freshness: FreshnessInfo;
  confidenceFlags: ConfidenceFlagEntry[];
}
