/**
 * Adapt canonical OmniRenewalDetailData → route-edge RenewalDetailData.
 */

import type { OmniRenewalDetailData } from "../../repo";
import type { RenewalDetailData } from "./types";
import { adaptRenewalCandidate } from "./adapt-renewal-candidate";

export function adaptRenewalDetail(d: OmniRenewalDetailData): RenewalDetailData {
  return {
    candidate: adaptRenewalCandidate(d.candidate),
    contractLines: d.contractLines,
    account: d.account,
  };
}
