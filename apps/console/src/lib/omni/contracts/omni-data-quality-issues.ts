/**
 * Omni Data Quality Issues — canonical contract for surfacing data problems.
 *
 * Grain: one issue per detected problem
 *
 * Used by data cleanup queues and CS dashboards to surface
 * actionable data quality problems across the Omni dataset.
 */

import type { FreshnessInfo } from "./shared-types";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type IssueType =
  | "missing_stripe_customer"
  | "missing_sf_account"
  | "subscription_missing_sf_contract"
  | "sub_item_missing_sf_line"
  | "stale_sync"
  | "suspicious_account_name"
  | "orphaned_record"
  | "duplicate_mapping_candidate";

export type EntityType =
  | "customer_index"
  | "stripe_subscription"
  | "stripe_subscription_item"
  | "stripe_customer"
  | "sf_account"
  | "sf_contract";

export interface OmniDataQualityIssue {
  issueId: string; // deterministic: `${issueType}:${entityType}:${entityId}`
  severity: IssueSeverity;
  issueType: IssueType;
  entityType: EntityType;
  entityId: string;
  omniAccountId: string | null;
  displayName: string | null;
  summary: string;
  recommendedAction: string;
  sourceSystem: "stripe" | "salesforce" | "omni";
  detectedAt: string; // ISO timestamp
  freshness: FreshnessInfo;
}

export interface OmniDataQualityReport {
  issues: OmniDataQualityIssue[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  freshness: FreshnessInfo;
}
