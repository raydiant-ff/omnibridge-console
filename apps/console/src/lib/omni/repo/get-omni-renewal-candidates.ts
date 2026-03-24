"use server";

import { requireSession } from "@omnibridge/auth";
import {
  buildOmniRenewalDashboard,
  buildAllOmniRenewalCandidates,
} from "../builders/build-omni-renewal-candidates";
import type {
  OmniRenewalDashboardData,
  OmniRenewalCandidate,
} from "../contracts/omni-renewal-candidates";

/**
 * Get renewal dashboard data for a month with optional CSM filter.
 * This is the primary entry point for the Renewals workspace.
 */
export async function getOmniRenewalCandidates(
  month: string,
  csmFilter: string | null = null,
): Promise<OmniRenewalDashboardData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return buildOmniRenewalDashboard(month, csmFilter);
}

/**
 * Get all renewal candidates (no month filter) for reports.
 */
export async function getAllOmniRenewalCandidates(): Promise<OmniRenewalCandidate[]> {
  await requireSession();
  return buildAllOmniRenewalCandidates();
}
