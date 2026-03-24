import type { CompositeFreshnessInfo, FreshnessSource } from "./shared-types";

export interface WorkspaceTrustSummary {
  /** Composite freshness across all CS-relevant mirror sources. */
  freshness: CompositeFreshnessInfo;
  /** Whether any required source has zero rows (missing entirely). */
  missingSources: { source: FreshnessSource; label: string }[];
  /** Whether the workspace should show a trust warning. */
  showWarning: boolean;
  /** Human-readable trust summary for low-tech users. */
  summaryLabel: string;
}
