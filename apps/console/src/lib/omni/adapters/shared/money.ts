/**
 * Adapter-boundary money conversion.
 *
 * All cents → dollars translation for route-facing data
 * must happen through these helpers. No conversion in
 * builders, repos, or route components.
 */

/** Convert cents integer to dollars with 2-decimal precision. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Convert dollars to cents integer. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
