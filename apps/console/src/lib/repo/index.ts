/**
 * Repository guardrail layer.
 *
 * Import query helpers and base where/select objects from here
 * instead of writing raw Prisma queries with duplicated guardrails.
 *
 * Rules enforced here:
 * - SfAccount: always excludes isStub=true records
 * - SfContract: never reads daysTillExpiry or stripeStatus directly
 * - Derived fields: computed at query time, not from stale stored values
 */

export {
  SF_ACCOUNT_BASE_WHERE,
  SF_ACCOUNT_LIST_SELECT,
  SF_ACCOUNT_DETAIL_SELECT,
} from "./sf-account";

export {
  SF_CONTRACT_ACTIVE_WHERE,
  SF_CONTRACT_LIST_SELECT,
  SF_CONTRACT_DETAIL_SELECT,
} from "./sf-contract";

export {
  computeDaysToExpiry,
  classifyRenewalUrgency,
  computeMrrCents,
  isMirrorFresh,
  mirrorFreshnessLabel,
} from "./derived";

export type { RenewalUrgency } from "./derived";
