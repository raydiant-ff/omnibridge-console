"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniSubscriptionFacts } from "../builders/build-omni-subscription-facts";
import type { OmniSubscriptionFacts } from "../contracts/omni-subscription-facts";

/**
 * Get subscription facts by subscription IDs, customer IDs, or status filter.
 */
export async function getOmniSubscriptionFacts(opts: {
  subscriptionIds?: string[];
  stripeCustomerIds?: string[];
  statuses?: string[];
}): Promise<OmniSubscriptionFacts[]> {
  await requireSession();
  return buildOmniSubscriptionFacts(opts);
}

/**
 * Get a single subscription's facts.
 */
export async function getOmniSubscriptionFact(
  subscriptionId: string,
): Promise<OmniSubscriptionFacts | null> {
  await requireSession();
  const results = await buildOmniSubscriptionFacts({ subscriptionIds: [subscriptionId] });
  return results[0] ?? null;
}
