"use server";

/**
 * CS Queue actions — consumes canonical account summary.
 */

import { requireSession } from "@omnibridge/auth";
import { getOmniAccountSummaries, getWorkspaceTrustSummary } from "@/lib/omni/repo";
import type { CsQueueData } from "./types";

export async function fetchCsQueueData(): Promise<CsQueueData> {
  await requireSession();
  const [report, trust] = await Promise.all([
    getOmniAccountSummaries(),
    getWorkspaceTrustSummary(),
  ]);
  return { report, trust };
}
