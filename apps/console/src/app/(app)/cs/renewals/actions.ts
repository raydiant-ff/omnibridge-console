"use server";

import { requireSession } from "@omnibridge/auth";
import {
  getRenewalCandidates,
  getRenewalDetail,
  type RenewalsDashboardData,
  type RenewalDetailData,
} from "@/lib/queries/cs-renewals";

export async function fetchRenewalsForMonth(
  month: string,
  csm: string | null = null,
): Promise<RenewalsDashboardData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return getRenewalCandidates(month, csm);
}

export async function fetchRenewalDetail(
  candidateId: string,
): Promise<RenewalDetailData | null> {
  await requireSession();

  if (!candidateId || (!candidateId.startsWith("sub:") && !candidateId.startsWith("contract:"))) {
    throw new Error("Invalid candidate ID format.");
  }

  return getRenewalDetail(candidateId);
}
