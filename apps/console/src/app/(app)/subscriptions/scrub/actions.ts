"use server";

/**
 * Scrub route actions — canonical Omni data layer.
 *
 * Data flows: canonical repo → adapter → route-edge types.
 * UI components consume adapter-local types only.
 */

import { requireSession } from "@omnibridge/auth";
import {
  getOmniScrubMonthlyAccounts,
  getOmniScrubAccountDetail,
} from "@/lib/omni/repo";
import { adaptScrubRow } from "@/lib/omni/adapters/scrub/adapt-scrub-row";
import { adaptScrubSummary } from "@/lib/omni/adapters/scrub/adapt-scrub-summary";
import { adaptScrubDetail } from "@/lib/omni/adapters/scrub/adapt-scrub-detail";
import type { ScrubData, ScrubDetailData } from "@/lib/omni/adapters/scrub";

// Types: import from @/lib/omni/adapters/scrub directly in client components

export async function fetchScrubData(month: string): Promise<ScrubData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  const data = await getOmniScrubMonthlyAccounts(month);

  return {
    rows: data.rows.map(adaptScrubRow),
    summary: adaptScrubSummary(data.summary),
  };
}

export async function fetchScrubDetail(
  stripeCustomerId: string,
  month: string,
): Promise<ScrubDetailData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  const detail = await getOmniScrubAccountDetail(stripeCustomerId, month);
  return adaptScrubDetail(detail);
}
