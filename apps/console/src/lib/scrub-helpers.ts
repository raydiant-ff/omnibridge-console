/**
 * Route-scoped helpers for the subscription scrub workspace.
 * Kept small and scrub-specific per implementation brief.
 */

// ── Snapshot helpers ──

/** Compute the snapshot date (last day of previous month) for a YYYY-MM scrub month. */
export function getSnapshotDate(month: string): Date {
  const [year, mon] = month.split("-").map(Number);
  // Day 0 of the scrub month = last day of previous month
  return new Date(Date.UTC(year, mon - 1, 0, 23, 59, 59, 999));
}

/** Human-readable label like "ARR as of Jan 31" */
export function getSnapshotLabel(month: string): string {
  const d = getSnapshotDate(month);
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `ARR as of ${label}`;
}

// ── Freshness helpers ──

export type FreshnessState = "fresh" | "lagging" | "stale" | "degraded";

export interface FreshnessInfo {
  dataAsOf: string; // ISO timestamp
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

export function freshnessVariant(
  state: FreshnessState,
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "fresh":
      return "default";
    case "lagging":
      return "secondary";
    case "stale":
      return "outline";
    case "degraded":
      return "destructive";
  }
}
