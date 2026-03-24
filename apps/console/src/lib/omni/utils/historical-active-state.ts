/**
 * Canonical historical active-state predicate.
 *
 * Answers: "Did this subscription contribute recurring ARR on a given date?"
 *
 * This is the single shared rule for point-in-time snapshot ARR logic.
 * All surfaces that need "ARR as of date X" should use this predicate
 * rather than reimplementing inline SQL WHERE clauses.
 *
 * Business rule:
 *   A subscription contributed ARR on `snapshotDate` if ALL of:
 *   1. It had started on or before the snapshot date (`start_date <= snapshotDate`)
 *   2. It had not yet been canceled at that point (`canceled_at IS NULL OR canceled_at > snapshotDate`)
 *   3. Its status was not a transient/failed state (`NOT IN ('incomplete', 'incomplete_expired')`)
 *
 * Confidence caveats (documented, not hidden):
 *   - `past_due` subs are included because they still carry contractual ARR
 *     obligation even if payment is failing. A confidence flag should be
 *     attached when past_due subs contribute to snapshot ARR.
 *   - Paused subscriptions (if Stripe pause is ever used) would need
 *     additional handling. Currently not present in the Omni dataset.
 *   - `cancel_at` (future scheduled cancel) does NOT exclude a sub
 *     from the snapshot because the sub was still active on that date.
 *   - Subs with `ended_at` set (if present in schema) are excluded
 *     via the canceled_at check since cancellation precedes ending.
 */

/**
 * SQL WHERE clause fragment for the historical active-state predicate.
 *
 * Parameterized: $N is the snapshot date parameter position.
 * Table alias: `sub` for stripe_subscriptions.
 *
 * Usage in raw SQL:
 *   `WHERE ${historicalActiveWhere("sub", "$2")}`
 */
export function historicalActiveWhere(
  tableAlias: string,
  snapshotDateParam: string,
): string {
  return [
    `${tableAlias}.start_date <= ${snapshotDateParam}`,
    `(${tableAlias}.canceled_at IS NULL OR ${tableAlias}.canceled_at > ${snapshotDateParam})`,
    `${tableAlias}.status NOT IN ('incomplete', 'incomplete_expired')`,
  ].join(" AND ");
}

/**
 * Evaluate the historical active-state predicate in TypeScript.
 *
 * For use when subscription data is already in memory (e.g., filtering
 * Prisma results). Uses the same business rule as the SQL version.
 */
export function wasActiveOnDate(
  sub: {
    startDate: Date;
    canceledAt: Date | null;
    status: string;
  },
  snapshotDate: Date,
): boolean {
  if (sub.startDate > snapshotDate) return false;
  if (sub.canceledAt !== null && sub.canceledAt <= snapshotDate) return false;
  if (sub.status === "incomplete" || sub.status === "incomplete_expired") return false;
  return true;
}

/**
 * Returns an array of confidence flags for a subscription that was active
 * on a snapshot date but has concerning signals.
 */
export function snapshotConfidenceFlags(
  sub: { status: string },
): string[] {
  const flags: string[] = [];
  if (sub.status === "past_due") {
    flags.push("past_due_on_snapshot: subscription was past_due at snapshot time — ARR included but payment was failing");
  }
  return flags;
}
