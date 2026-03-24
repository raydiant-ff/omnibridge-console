"use server";

/**
 * Renewals route actions — canonical Omni data layer.
 *
 * Data flows: canonical repo → adapter → route-edge types.
 * UI components consume adapter-local types only.
 */

import { requireSession } from "@omnibridge/auth";
import {
  getOmniRenewalCandidates,
  getOmniRenewalDetail,
} from "@/lib/omni/repo";
import {
  adaptRenewalsDashboard,
  adaptRenewalDetail,
} from "@/lib/omni/adapters/renewals";
import type {
  RenewalsDashboardData,
  RenewalCandidate,
  RenewalDetailData,
} from "@/lib/omni/adapters/renewals";

// Types: import from @/lib/omni/adapters/renewals directly in client components

export async function fetchRenewalsForMonth(
  month: string,
  csm: string | null = null,
): Promise<RenewalsDashboardData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  const data = await getOmniRenewalCandidates(month, csm);
  return adaptRenewalsDashboard(data);
}

export async function fetchRenewalDetail(
  candidateId: string,
): Promise<RenewalDetailData | null> {
  await requireSession();

  if (!candidateId || (!candidateId.startsWith("sub:") && !candidateId.startsWith("contract:"))) {
    throw new Error("Invalid candidate ID format.");
  }

  const detail = await getOmniRenewalDetail(candidateId);
  if (!detail) return null;
  return adaptRenewalDetail(detail);
}

