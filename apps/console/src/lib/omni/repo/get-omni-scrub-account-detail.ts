"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { buildOmniScrubAccountDetail } from "../builders/build-omni-scrub-account-detail";
import type { OmniScrubAccountDetail } from "../contracts/omni-scrub-account-detail";

/**
 * Get detailed scrub data by Stripe customer ID.
 * Kept for backward compatibility with existing callers.
 */
export async function getOmniScrubAccountDetail(
  stripeCustomerId: string,
  month: string,
): Promise<OmniScrubAccountDetail> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return buildOmniScrubAccountDetail(stripeCustomerId, month);
}

/**
 * Get detailed scrub data by omniAccountId (CustomerIndex ID).
 * Resolves the linked Stripe customer ID internally.
 */
export async function getOmniScrubAccountDetailByOmniId(
  omniAccountId: string,
  month: string,
): Promise<OmniScrubAccountDetail | null> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  // Resolve omniAccountId → stripeCustomerId
  const ci = await prisma.customerIndex.findUnique({
    where: { id: omniAccountId },
    select: { stripeCustomerId: true },
  });

  if (!ci?.stripeCustomerId) {
    // omniAccountId might itself be a Stripe customer ID (fallback for accounts without CI)
    return buildOmniScrubAccountDetail(omniAccountId, month);
  }

  return buildOmniScrubAccountDetail(ci.stripeCustomerId, month);
}
