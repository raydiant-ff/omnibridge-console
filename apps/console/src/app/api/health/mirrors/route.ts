/**
 * Health check: Mirror freshness
 *
 * Returns per-source freshness state for external monitoring.
 * Public endpoint (excluded from auth middleware).
 */

import { NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";

interface SourceStatus {
  source: string;
  count: number;
  latestSync: string | null;
  ageHours: number | null;
  state: "fresh" | "lagging" | "stale" | "degraded" | "empty";
}

const TABLES = [
  { source: "stripe_customers", table: "stripe_customers" },
  { source: "stripe_subscriptions", table: "stripe_subscriptions" },
  { source: "stripe_invoices", table: "stripe_invoices" },
  { source: "stripe_payments", table: "stripe_payments" },
  { source: "stripe_payment_methods", table: "stripe_payment_methods" },
  { source: "sf_accounts", table: "sf_accounts" },
  { source: "sf_contracts", table: "sf_contracts" },
  { source: "sf_contract_lines", table: "sf_contract_lines" },
  { source: "sf_contacts", table: "sf_contacts" },
];

export async function GET() {
  const results: SourceStatus[] = await Promise.all(
    TABLES.map(async ({ source, table }) => {
      const [countResult, syncResult] = await Promise.all([
        prisma.$queryRawUnsafe<[{ cnt: bigint }]>(`SELECT COUNT(*) as cnt FROM "${table}"`),
        prisma.$queryRawUnsafe<[{ max_sync: Date | null }]>(`SELECT MAX(synced_at) as max_sync FROM "${table}"`),
      ]);

      const count = Number(countResult[0]?.cnt ?? 0);
      const latestSync = syncResult[0]?.max_sync ?? null;

      if (count === 0) {
        return { source, count, latestSync: null, ageHours: null, state: "empty" as const };
      }

      if (!latestSync) {
        return { source, count, latestSync: null, ageHours: null, state: "degraded" as const };
      }

      const ageHours = (Date.now() - latestSync.getTime()) / (1000 * 60 * 60);
      const state = ageHours < 1 ? "fresh" : ageHours < 6 ? "lagging" : ageHours < 24 ? "stale" : "degraded";

      return {
        source,
        count,
        latestSync: latestSync.toISOString(),
        ageHours: Math.round(ageHours * 10) / 10,
        state: state as SourceStatus["state"],
      };
    }),
  );

  const worstState = results.reduce((worst, r) => {
    const order = { fresh: 0, lagging: 1, stale: 2, degraded: 3, empty: 4 };
    return order[r.state] > order[worst] ? r.state : worst;
  }, "fresh" as SourceStatus["state"]);

  const healthy = worstState === "fresh" || worstState === "lagging";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      overall: worstState,
      sources: results,
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
