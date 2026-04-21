/**
 * Omni canonical contracts — barrel export.
 *
 * All canonical data shapes live here. Routes must consume
 * these contracts via repo functions, never raw mirror tables.
 */

// Shared types
export type {
  FreshnessState,
  FreshnessInfo,
  FreshnessSource,
  SourceFreshness,
  CompositeFreshnessInfo,
  ConfidenceFlag,
  ConfidenceFlagEntry,
} from "./shared-types";
export { computeFreshness, computeCompositeFreshness } from "./shared-types";

// Account Spine
export type { OmniAccountSpine } from "./omni-account-spine";

// Subscription Facts
export type { OmniSubscriptionFacts } from "./omni-subscription-facts";

// Subscription Classification
export type {
  OmniSubscriptionClassification,
  OmniSubscriptionClassificationResult,
  OmniSubscriptionClassificationPolicyView,
  OmniSubscriptionClassificationStripeView,
} from "./omni-subscription-classification";

// Renewal Candidates
export type {
  OmniRenewalCandidate,
  OmniRenewalSummary,
  OmniRenewalDashboardData,
  RenewalCandidateItem,
  LinkedContractInfo,
  BillingMode,
  RenewalPriorityBucket,
  RenewalCandidateStatus,
  RiskReason,
} from "./omni-renewal-candidates";

// Scrub Monthly Accounts
export type {
  OmniScrubMonthlyAccount,
  OmniScrubMonthlySummary,
  OmniScrubMonthlyData,
  ScrubClassification,
  ScrubSubscriptionRef,
} from "./omni-scrub-monthly-accounts";

// Scrub Account Detail
export type {
  OmniScrubAccountDetail,
  ScrubCanceledSubscription,
  ScrubActiveSubscription,
  ScrubSummarySection,
  ScrubSubItemDetail,
  CoverageAssessment,
  CoverageConfidence,
  CoverageInfo,
} from "./omni-scrub-account-detail";

// Account Summary
export type {
  OmniAccountSummary,
  OmniAccountSummaryReport,
  AccountRenewalSummary,
  AccountDqSummary,
  AccountSignalCategory,
  AccountReviewState,
} from "./omni-account-summary";

// Data Quality Issues
export type {
  OmniDataQualityIssue,
  OmniDataQualityReport,
  IssueSeverity,
  IssueType,
  EntityType,
} from "./omni-data-quality-issues";
