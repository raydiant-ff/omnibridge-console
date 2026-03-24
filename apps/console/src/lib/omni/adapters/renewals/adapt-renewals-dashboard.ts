/**
 * Adapt canonical OmniRenewalDashboardData → route-edge RenewalsDashboardData.
 */

import type { OmniRenewalDashboardData } from "../../contracts";
import type { RenewalsDashboardData, RenewalsSummary } from "./types";
import { adaptRenewalCandidate } from "./adapt-renewal-candidate";

export function adaptRenewalsDashboard(data: OmniRenewalDashboardData): RenewalsDashboardData {
  const summary: RenewalsSummary = {
    total: data.summary.total,
    totalMrr: data.summary.totalMrr,
    allCount: data.summary.allCount,
    autoRenewCount: data.summary.autoRenewCount,
    reviewNeededCount: data.summary.reviewNeededCount,
    cancellingCount: data.summary.cancellingCount,
    cancellingMrr: data.summary.cancellingMrr,
    scheduledEndCount: data.summary.scheduledEndCount,
    scheduledEndMrr: data.summary.scheduledEndMrr,
    periodEndingCount: data.summary.periodEndingCount,
    periodEndingMrr: data.summary.periodEndingMrr,
  };

  return {
    summary,
    candidates: data.candidates.map(adaptRenewalCandidate),
    overdue: data.overdue.map(adaptRenewalCandidate),
    csmList: data.csmList,
  };
}
