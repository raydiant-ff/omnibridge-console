import { Prisma } from "@omnibridge/db";

/**
 * Shared SQL CASE expression that converts a subscription item's
 * unit_amount * quantity into a monthly rate (in raw unit-amount currency units).
 *
 * Expects the table alias `si` with columns:
 *   billing_interval, interval_count, unit_amount, quantity
 *
 * Divide the result by 100 to convert cents → dollars.
 */
export const MRR_CASE = Prisma.sql`
  CASE si.billing_interval
    WHEN 'year'  THEN si.unit_amount * si.quantity / (12.0 * si.interval_count)
    WHEN 'month' THEN si.unit_amount * si.quantity / si.interval_count
    WHEN 'week'  THEN si.unit_amount * si.quantity * 52.0 / (12.0 * si.interval_count)
    WHEN 'day'   THEN si.unit_amount * si.quantity * 365.0 / (12.0 * si.interval_count)
    ELSE 0
  END
`;
