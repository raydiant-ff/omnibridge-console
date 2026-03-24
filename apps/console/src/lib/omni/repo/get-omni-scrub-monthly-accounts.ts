"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniScrubMonthlyAccounts } from "../builders/build-omni-scrub-monthly-accounts";
import type { OmniScrubMonthlyData } from "../contracts/omni-scrub-monthly-accounts";

/**
 * Get scrub data for a month — all accounts with cancellations,
 * their snapshot ARR, and replacement assessment.
 */
export async function getOmniScrubMonthlyAccounts(
  month: string,
): Promise<OmniScrubMonthlyData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return buildOmniScrubMonthlyAccounts(month);
}
