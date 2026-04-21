/**
 * Omni canonical data layer — top-level barrel.
 *
 * Architecture:
 *   contracts/   — pure TypeScript interfaces (the "what")
 *   builders/    — query + transform logic (the "how")
 *   repo/        — auth-gated public API (the "who can")
 *   classifiers/ — pure functions over contracts (no I/O)
 *
 * Routes should import from `@/lib/omni/repo` for data access.
 * Types should be imported from `@/lib/omni/contracts`.
 */

// Re-export repo (public API)
export {
  getOmniAccountSpines,
  getOmniAccountSpine,
  getOmniSubscriptionFacts,
  getOmniSubscriptionFact,
  getOmniRenewalCandidates,
  getAllOmniRenewalCandidates,
  getOmniRenewalDetail,
  getOmniScrubMonthlyAccounts,
  getOmniScrubAccountDetail,
  getOmniScrubAccountDetailByOmniId,
  getOmniAccountSummaries,
  getOmniDataQualityIssues,
  getWorkspaceTrustSummary,
} from "./repo";

export type {
  OmniRenewalDetailData,
  OmniRenewalContractLine,
  OmniRenewalAccount,
  WorkspaceTrustSummary,
} from "./repo";

// Re-export contracts (types)
export {
  computeFreshness,
  computeCompositeFreshness,
} from "./contracts";

export type {
  FreshnessState,
  FreshnessInfo,
  FreshnessSource,
  SourceFreshness,
  CompositeFreshnessInfo,
  ConfidenceFlag,
  ConfidenceFlagEntry,
  OmniAccountSpine,
  OmniSubscriptionFacts,
  OmniRenewalCandidate,
  OmniRenewalSummary,
  OmniRenewalDashboardData,
  RenewalCandidateItem,
  LinkedContractInfo,
  BillingMode,
  RenewalPriorityBucket,
  RenewalCandidateStatus,
  RiskReason,
  OmniScrubMonthlyAccount,
  OmniScrubMonthlySummary,
  OmniScrubMonthlyData,
  ScrubClassification,
  ScrubSubscriptionRef,
  OmniScrubAccountDetail,
  ScrubCanceledSubscription,
  ScrubActiveSubscription,
  ScrubSummarySection,
  ScrubSubItemDetail,
  CoverageAssessment,
  CoverageConfidence,
  CoverageInfo,
  OmniAccountSummary,
  OmniAccountSummaryReport,
  AccountRenewalSummary,
  AccountDqSummary,
  AccountSignalCategory,
  AccountReviewState,
  OmniDataQualityIssue,
  OmniDataQualityReport,
  IssueSeverity,
  IssueType,
  EntityType,
} from "./contracts";
