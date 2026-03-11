export type ContractTerm = "mtm" | "1yr" | "2yr" | "3yr";
export type BillingFrequency =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "2yr"
  | "3yr";

export const CONTRACT_TERM_LABELS: Record<ContractTerm, string> = {
  mtm: "Month-to-Month",
  "1yr": "1 Year",
  "2yr": "2 Years",
  "3yr": "3 Years",
};

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
  "2yr": "Every 2 Years",
  "3yr": "Every 3 Years",
};

const TERM_MONTHS: Record<ContractTerm, number> = {
  mtm: 1,
  "1yr": 12,
  "2yr": 24,
  "3yr": 36,
};

const FREQ_MONTHS: Record<BillingFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
  "2yr": 24,
  "3yr": 36,
};

export function contractTermMonths(term: ContractTerm): number {
  return TERM_MONTHS[term];
}

export function billingFrequencyMonths(freq: BillingFrequency): number {
  return FREQ_MONTHS[freq];
}

/**
 * Convert a price interval string (from Stripe, e.g. "month", "year")
 * plus an optional interval_count into a total number of months.
 */
export function intervalToMonths(
  interval: string,
  intervalCount = 1,
): number {
  switch (interval) {
    case "month":
      return intervalCount;
    case "year":
      return intervalCount * 12;
    case "week":
      return intervalCount / 4;
    case "day":
      return intervalCount / 30;
    default:
      return 1;
  }
}

export function billingIntervalToStripe(freq: BillingFrequency): {
  interval: "month" | "year";
  interval_count: number;
} {
  switch (freq) {
    case "monthly":
      return { interval: "month", interval_count: 1 };
    case "quarterly":
      return { interval: "month", interval_count: 3 };
    case "semi_annual":
      return { interval: "month", interval_count: 6 };
    case "annual":
      return { interval: "year", interval_count: 1 };
    case "2yr":
      return { interval: "year", interval_count: 2 };
    case "3yr":
      return { interval: "year", interval_count: 3 };
  }
}

/**
 * Convert a unit_amount from its current billing interval to a target billing frequency.
 * E.g. $285/month → quarterly = $855.
 */
export function convertPriceToFrequency(
  unitAmount: number,
  fromInterval: string,
  toFreq: BillingFrequency,
): number {
  const fromMonths = intervalToMonths(fromInterval);
  const toMonths = billingFrequencyMonths(toFreq);
  const monthlyRate = unitAmount / fromMonths;
  return Math.round(monthlyRate * toMonths);
}

/**
 * How many billing cycles fit in the contract term.
 * E.g. 1yr contract with quarterly billing = 4 iterations.
 */
export function computeIterations(
  term: ContractTerm,
  freq: BillingFrequency,
): number {
  const termM = contractTermMonths(term);
  const freqM = billingFrequencyMonths(freq);
  return Math.max(1, Math.round(termM / freqM));
}

export function validBillingFrequencies(
  term: ContractTerm,
): BillingFrequency[] {
  const termM = contractTermMonths(term);
  return (Object.keys(FREQ_MONTHS) as BillingFrequency[]).filter(
    (f) => FREQ_MONTHS[f] <= termM,
  );
}

export function computeContractEndDate(
  startDate: Date,
  term: ContractTerm,
): Date {
  const months = contractTermMonths(term);
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + months);
  return end;
}

/**
 * Check whether a line item's native interval already matches the billing frequency.
 */
export function intervalMatchesFrequency(
  interval: string,
  freq: BillingFrequency,
): boolean {
  const { interval: targetInt, interval_count: targetCnt } =
    billingIntervalToStripe(freq);
  if (interval === "one-time" || interval === "one_time") return false;
  if (targetInt === "month" && interval === "month" && targetCnt === 1)
    return true;
  if (targetInt === "year" && interval === "year" && targetCnt === 1)
    return true;
  return false;
}

/**
 * Convert a unit_amount from a billing frequency back to a native price interval.
 * Inverse of convertPriceToFrequency.
 */
export function convertPriceFromFrequency(
  unitAmount: number,
  fromFreq: BillingFrequency,
  toInterval: string,
): number {
  const fromMonths = billingFrequencyMonths(fromFreq);
  const toMonths = intervalToMonths(toInterval);
  return Math.round((unitAmount / fromMonths) * toMonths);
}

export function billingFrequencyIntervalLabel(freq: BillingFrequency): string {
  switch (freq) {
    case "monthly":
      return "mo";
    case "quarterly":
      return "quarter";
    case "semi_annual":
      return "6 mo";
    case "annual":
      return "yr";
    case "2yr":
      return "2 yr";
    case "3yr":
      return "3 yr";
  }
}

/**
 * Normalize a subscription item's unit_amount (in cents) to a monthly rate (in cents).
 * Handles day/week/month/year intervals with an optional interval_count.
 */
export function computeItemMrr(
  unitAmountCents: number,
  interval: string | null,
  intervalCount: number,
  quantity: number,
): number {
  if (!interval) return 0;
  const months = intervalToMonths(interval, intervalCount);
  if (months <= 0) return 0;
  return Math.round((unitAmountCents * quantity) / months);
}

/**
 * Determine whether a price interval represents a one-time (non-recurring) charge.
 */
export function isOneTimePrice(interval: string | null | undefined): boolean {
  return !interval || interval === "one_time" || interval === "one-time";
}

/**
 * Compute a human-readable payment terms label from collection method + days until due.
 */
export function computePaymentTerms(
  collectionMethod: string,
  daysUntilDue: number | null | undefined,
): string {
  if (collectionMethod === "charge_automatically") return "Due on receipt";
  if (daysUntilDue === 0) return "Due on receipt";
  return daysUntilDue ? `Net ${daysUntilDue}` : "Net 30";
}

export function formatBillingCycleSummary(
  term: ContractTerm,
  freq: BillingFrequency,
): string {
  const iters = computeIterations(term, freq);
  const freqLabel = BILLING_FREQUENCY_LABELS[freq].toLowerCase();
  if (term === "mtm") return "Month-to-month, auto-renewing";
  return `${iters} ${freqLabel} payment${iters > 1 ? "s" : ""} over ${CONTRACT_TERM_LABELS[term].toLowerCase()}, auto-renewing`;
}
