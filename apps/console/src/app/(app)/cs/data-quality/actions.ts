"use server";

import { requireSession } from "@omnibridge/auth";
import { getOmniDataQualityIssues, getWorkspaceTrustSummary } from "@/lib/omni/repo";
import type { DqQueueData } from "./types";

export async function fetchDataQualityIssues(): Promise<DqQueueData> {
  await requireSession();
  const [report, trust] = await Promise.all([
    getOmniDataQualityIssues(),
    getWorkspaceTrustSummary(),
  ]);
  return { report, trust };
}
