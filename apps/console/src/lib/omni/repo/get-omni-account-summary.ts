"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniAccountSummaries } from "../builders/build-omni-account-summary";
import type { OmniAccountSummaryReport } from "../contracts/omni-account-summary";

/**
 * Get account-level summaries for the CS Queue and future account surfaces.
 * If no IDs provided, returns all accounts.
 */
export async function getOmniAccountSummaries(
  customerIndexIds?: string[],
): Promise<OmniAccountSummaryReport> {
  await requireSession();
  return buildOmniAccountSummaries(customerIndexIds);
}
