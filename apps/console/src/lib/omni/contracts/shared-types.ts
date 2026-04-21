/**
 * Shared types for the Omni canonical data layer.
 *
 * These types are used across all canonical contracts to express
 * data freshness and confidence in computed fields.
 */

// ---------------------------------------------------------------------------
// Freshness — how current is the underlying mirror data
// ---------------------------------------------------------------------------

export type FreshnessState = "fresh" | "lagging" | "stale" | "degraded";

export interface FreshnessInfo {
  dataAsOf: string; // ISO timestamp of most recent sync
  state: FreshnessState;
  label: string;
}

/**
 * Derive freshness state from a "most recent synced_at" timestamp.
 * Thresholds: <1h = fresh, <6h = lagging, <24h = stale, >24h = degraded.
 */
export function computeFreshness(syncedAt: Date | null): FreshnessInfo {
  if (!syncedAt) {
    return {
      dataAsOf: "",
      state: "degraded",
      label: "No sync timestamp available",
    };
  }

  const ageMs = Date.now() - syncedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  let state: FreshnessState;
  if (ageHours < 1) state = "fresh";
  else if (ageHours < 6) state = "lagging";
  else if (ageHours < 24) state = "stale";
  else state = "degraded";

  const timeLabel = syncedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateLabel = syncedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return {
    dataAsOf: syncedAt.toISOString(),
    state,
    label: `Mirrored data as of ${dateLabel}, ${timeLabel}`,
  };
}

// ---------------------------------------------------------------------------
// Composite freshness — for surfaces that depend on multiple data sources
// ---------------------------------------------------------------------------

export type FreshnessSource =
  | "stripe_subscriptions"
  | "stripe_invoices"
  | "stripe_customers"
  | "sf_accounts"
  | "sf_contracts";

export interface SourceFreshness {
  source: FreshnessSource;
  freshness: FreshnessInfo;
}

export interface CompositeFreshnessInfo {
  /** Overall state — worst-case across all sources. */
  overall: FreshnessInfo;
  /** Per-source breakdown. */
  sources: SourceFreshness[];
}

/**
 * Compute composite freshness from multiple source timestamps.
 * Overall state is the worst-case (most stale) across all sources.
 */
export function computeCompositeFreshness(
  entries: { source: FreshnessSource; syncedAt: Date | null }[],
): CompositeFreshnessInfo {
  const sources: SourceFreshness[] = entries.map((e) => ({
    source: e.source,
    freshness: computeFreshness(e.syncedAt),
  }));

  const STATE_ORDER: Record<FreshnessState, number> = {
    fresh: 0,
    lagging: 1,
    stale: 2,
    degraded: 3,
  };

  // Overall = worst-case source
  let worstSource = sources[0];
  for (let i = 1; i < sources.length; i++) {
    if (STATE_ORDER[sources[i].freshness.state] > STATE_ORDER[worstSource.freshness.state]) {
      worstSource = sources[i];
    }
  }

  const sourceLabels = sources
    .filter((s) => s.freshness.state !== "fresh")
    .map((s) => {
      const name = s.source.replace(/_/g, " ").replace(/^(stripe|sf) /, (m) => m.toUpperCase());
      return `${name}: ${s.freshness.state}`;
    });

  const overallLabel = sourceLabels.length > 0
    ? `Data freshness varies — ${sourceLabels.join(", ")}`
    : worstSource.freshness.label;

  return {
    overall: {
      dataAsOf: worstSource.freshness.dataAsOf,
      state: worstSource.freshness.state,
      label: overallLabel,
    },
    sources,
  };
}

// ---------------------------------------------------------------------------
// Confidence flags — known data quality issues on a record
// ---------------------------------------------------------------------------

/**
 * Canonical confidence flag vocabulary.
 * Each flag describes a specific data quality concern.
 */
export type ConfidenceFlag =
  | "no_stripe_customer" // CustomerIndex has no linked Stripe customer
  | "no_sf_account" // CustomerIndex has no linked SF account
  | "sf_account_is_stub" // SF account exists but is a stub (not fully hydrated)
  | "no_active_subscription" // No active Stripe subscriptions found
  | "subscription_past_due" // At least one subscription is past_due
  | "mrr_from_contract_lines" // MRR fell back to SF contract line data (not sub items)
  | "mrr_is_zero" // Could not compute any MRR
  | "no_sf_contract" // No SF contract linked to subscription
  | "sf_correlation_partial" // Some sub items lack SF contract line correlation
  | "sf_correlation_missing" // No sub items have SF contract line correlation
  | "no_paid_invoices" // No paid invoices found for coverage assessment
  | "coverage_gap_detected" // Gap between paid period and cancellation
  | "stale_mirror_data"; // Mirror data is older than 24h

/**
 * Structured confidence flag with human-readable context.
 */
export interface ConfidenceFlagEntry {
  flag: ConfidenceFlag;
  detail: string;
}
