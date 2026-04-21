/**
 * Adapt canonical OmniScrubMonthlySummary → route-edge ScrubSummary.
 */

import type { OmniScrubMonthlySummary } from "../../contracts";
import { centsToDollars } from "../shared/money";
import type { ScrubSummary } from "./types";

export function adaptScrubSummary(summary: OmniScrubMonthlySummary): ScrubSummary {
  return {
    month: summary.month,
    snapshotDate: summary.snapshotDate,
    totalAccounts: summary.totalAccounts,
    churned: summary.churned,
    contracted: summary.contracted,
    offset: summary.offset,
    expanded: summary.expanded,
    totalCanceledArr: centsToDollars(summary.totalCanceledArrCents),
    totalNewArr: centsToDollars(summary.totalReplacementArrCents),
    totalNetArr: centsToDollars(summary.totalNetArrImpactCents),
    freshness: summary.freshness,
  };
}
