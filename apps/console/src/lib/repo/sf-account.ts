/**
 * Repository guardrails for SfAccount queries.
 *
 * CRITICAL: SfAccount contains stub records created during contract backfills.
 * `isStub = true` rows are known-incomplete placeholders.
 *
 * ALL product-facing queries MUST use SF_ACCOUNT_BASE_WHERE.
 * Do not filter isStub individually in each query — use this centrally.
 */

import type { Prisma } from "@omnibridge/db";

/**
 * Base where clause for all product-facing SfAccount queries.
 * Excludes stub records. Spread this into every SfAccount findMany/findFirst.
 *
 * @example
 * prisma.sfAccount.findMany({
 *   where: { ...SF_ACCOUNT_BASE_WHERE, ownerId: userId },
 * })
 */
export const SF_ACCOUNT_BASE_WHERE = {
  isStub: false,
} satisfies Prisma.SfAccountWhereInput;

/**
 * Base select for SfAccount in list contexts.
 * Use this to keep queries fast — don't select `raw` for lists.
 */
export const SF_ACCOUNT_LIST_SELECT = {
  id: true,
  name: true,
  domain: true,
  ownerId: true,
  ownerName: true,
  csmId: true,
  csmName: true,
  accountType: true,
  status: true,
  stripeCustomerId: true,
  syncedAt: true,
} satisfies Prisma.SfAccountSelect;

/**
 * Base select for SfAccount in detail contexts.
 * Adds financial and location fields. Still excludes `raw`.
 */
export const SF_ACCOUNT_DETAIL_SELECT = {
  ...SF_ACCOUNT_LIST_SELECT,
  industry: true,
  billingCity: true,
  billingState: true,
  billingCountry: true,
  annualRevenue: true,
  dateOfFirstClosedWon: true,
  sfLastModified: true,
} satisfies Prisma.SfAccountSelect;
