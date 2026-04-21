/**
 * DQ Queue types — extracted for Turbopack compatibility.
 */
import type { OmniDataQualityReport } from "@/lib/omni/contracts";
import type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

export type { OmniDataQualityReport } from "@/lib/omni/contracts";
export type { OmniDataQualityIssue, IssueSeverity, IssueType, EntityType } from "@/lib/omni/contracts";
export type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

export interface DqQueueData {
  report: OmniDataQualityReport;
  trust: WorkspaceTrustSummary;
}
