"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniDataQualityIssues } from "../builders/build-omni-data-quality-issues";
import type { OmniDataQualityReport } from "../contracts/omni-data-quality-issues";

/**
 * Get data quality issues across the Omni dataset.
 */
export async function getOmniDataQualityIssues(): Promise<OmniDataQualityReport> {
  await requireSession();
  return buildOmniDataQualityIssues();
}
