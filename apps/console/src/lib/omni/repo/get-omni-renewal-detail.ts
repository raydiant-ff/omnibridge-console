"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniRenewalDetail } from "../builders/build-omni-renewal-detail";
import type { OmniRenewalDetailData } from "../builders/build-omni-renewal-detail";

/**
 * Get full detail for a single renewal candidate by candidateId.
 * Used by the detail pane.
 */
export async function getOmniRenewalDetail(
  candidateId: string,
): Promise<OmniRenewalDetailData | null> {
  await requireSession();

  if (!candidateId || (!candidateId.startsWith("sub:") && !candidateId.startsWith("contract:"))) {
    throw new Error("Invalid candidate ID format.");
  }

  return buildOmniRenewalDetail(candidateId);
}
