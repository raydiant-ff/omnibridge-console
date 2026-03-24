/**
 * Omni canonical builders — barrel export.
 *
 * Builders query raw mirror/product tables and compose canonical contracts.
 * These are internal to the omni layer — routes should use repo functions.
 */

export { buildOmniAccountSpines } from "./build-omni-account-spine";
export { buildOmniSubscriptionFacts } from "./build-omni-subscription-facts";
export {
  buildOmniRenewalDashboard,
  buildAllOmniRenewalCandidates,
  buildDistinctCsmNames,
} from "./build-omni-renewal-candidates";
export { buildOmniScrubMonthlyAccounts } from "./build-omni-scrub-monthly-accounts";
export { buildOmniScrubAccountDetail } from "./build-omni-scrub-account-detail";
export { buildOmniRenewalDetail } from "./build-omni-renewal-detail";
export { buildOmniAccountSummaries } from "./build-omni-account-summary";
export type {
  OmniRenewalDetailData,
  OmniRenewalContractLine,
  OmniRenewalAccount,
} from "./build-omni-renewal-detail";
export { buildOmniDataQualityIssues } from "./build-omni-data-quality-issues";
