/**
 * CS Queue types — extracted for Turbopack compatibility.
 */
import type { OmniAccountSummaryReport } from "@/lib/omni/contracts";
import type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

export type {
  OmniAccountSummary,
  OmniAccountSummaryReport,
  AccountSignalCategory,
  AccountRenewalSummary,
  AccountDqSummary,
  AccountReviewState,
} from "@/lib/omni/contracts";
export type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

export interface CsQueueData {
  report: OmniAccountSummaryReport;
  trust: WorkspaceTrustSummary;
}
