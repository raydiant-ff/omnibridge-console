/**
 * Derived / computed field utilities.
 *
 * These replace stale stored computed fields in mirror tables.
 * Always prefer these functions over reading stored computed values.
 *
 * Stale fields they replace:
 * - SfContract.daysTillExpiry  → use computeDaysToExpiry(contract.endDate)
 * - SfContract.stripeStatus    → use StripeSubscription.status directly
 */

/**
 * Compute days until a contract or subscription expires.
 *
 * Replaces: SfContract.daysTillExpiry (stored Int — will go stale).
 *
 * Returns:
 * - positive number: days remaining
 * - 0: expires today
 * - negative number: already expired (days overdue)
 * - null: no end date recorded
 */
export function computeDaysToExpiry(endDate: Date | null | undefined): number | null {
  if (!endDate) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((endDate.getTime() - Date.now()) / msPerDay);
}

/**
 * Classify renewal urgency from days-to-expiry.
 *
 * Used for renewal workspace filtering and color-coding.
 */
export type RenewalUrgency = "overdue" | "critical" | "due_soon" | "on_track";

export function classifyRenewalUrgency(daysToExpiry: number | null): RenewalUrgency {
  if (daysToExpiry === null) return "on_track";
  if (daysToExpiry < 0) return "overdue";
  if (daysToExpiry <= 30) return "critical";
  if (daysToExpiry <= 90) return "due_soon";
  return "on_track";
}

/**
 * Compute MRR in cents from StripeSubscriptionItem records.
 * Normalizes annual prices to monthly equivalent.
 *
 * Replaces: relying on SfContract.mrr (stale cache).
 */
export function computeMrrCents(
  items: Array<{
    unitAmount: number;
    quantity: number;
    billingInterval: string | null;
    intervalCount: number;
  }>,
): number {
  return items.reduce((sum, item) => {
    const amount = item.unitAmount * item.quantity;
    const interval = item.billingInterval ?? "month";
    const count = item.intervalCount ?? 1;

    if (interval === "year") return sum + Math.round(amount / (12 * count));
    if (interval === "month") return sum + Math.round(amount / count);
    if (interval === "week") return sum + Math.round((amount * 52) / (12 * count));
    if (interval === "day") return sum + Math.round((amount * 365) / (12 * count));
    return sum + amount;
  }, 0);
}

/**
 * Check whether a mirror row is considered fresh enough to display without a warning.
 *
 * @param syncedAt - The `syncedAt` timestamp on a mirror row
 * @param maxAgeMinutes - Threshold before showing a staleness warning (default: 60 min)
 */
export function isMirrorFresh(syncedAt: Date, maxAgeMinutes = 60): boolean {
  const ageMs = Date.now() - syncedAt.getTime();
  return ageMs < maxAgeMinutes * 60 * 1000;
}

/**
 * Returns a human-readable staleness description for UI display.
 */
export function mirrorFreshnessLabel(syncedAt: Date): string {
  const ageMs = Date.now() - syncedAt.getTime();
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
