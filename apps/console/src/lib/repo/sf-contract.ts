/**
 * Repository guardrails for SfContract queries.
 *
 * WARNING: SfContract contains stale computed fields.
 *
 * - `daysTillExpiry` (Int?) — stored computed value from endDate. Will be wrong
 *   if the sync job hasn't run recently. NEVER display raw. Use computeDaysToExpiry().
 *
 * - `stripeStatus` (String?) — cached Stripe subscription status from sync time.
 *   NEVER prefer this over StripeSubscription.status for billing decisions.
 *   Use only as a fallback hint when StripeSubscription is not available.
 *
 * - `mrr`/`arr` (Float?) — cached from CPQ. Prefer summing SfContractLine.mrr/arr
 *   for accuracy.
 */

import type { Prisma } from "@omnibridge/db";

/**
 * Active contract where clause. Use for customer workspace queries.
 */
export const SF_CONTRACT_ACTIVE_WHERE = {
  status: "Activated",
} satisfies Prisma.SfContractWhereInput;

/**
 * Base select for SfContract in list contexts.
 * Intentionally EXCLUDES daysTillExpiry and stripeStatus.
 * Compute from endDate and join to StripeSubscription instead.
 */
export const SF_CONTRACT_LIST_SELECT = {
  id: true,
  accountId: true,
  accountName: true,
  status: true,
  statusCode: true,
  startDate: true,
  endDate: true,
  contractTerm: true,
  contractNumber: true,
  ownerId: true,
  ownerName: true,
  stripeSubscriptionId: true,
  stripeCustomerId: true,
  stripeScheduleId: true,
  collectionMethod: true,
  opportunityId: true,
  evergreen: true,
  doNotRenew: true,
  renewalTerm: true,
  cancellationDate: true,
  syncedAt: true,
  // mrr/arr included as approximation — use SfContractLine sum for accuracy
  mrr: true,
  arr: true,
  // EXCLUDED: daysTillExpiry — stale computed field, derive from endDate
  // EXCLUDED: stripeStatus — stale cache, use StripeSubscription.status
} satisfies Prisma.SfContractSelect;

/**
 * Detail select adds lines relation and description.
 */
export const SF_CONTRACT_DETAIL_SELECT = {
  ...SF_CONTRACT_LIST_SELECT,
  description: true,
  activatedDate: true,
  customerSignedDate: true,
  sfLastModified: true,
} satisfies Prisma.SfContractSelect;
