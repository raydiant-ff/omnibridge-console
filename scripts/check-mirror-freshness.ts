/**
 * Mirror Freshness Diagnostic
 *
 * Checks the current state of all mirrored tables and reports:
 * - Row counts
 * - Latest synced_at per table
 * - Freshness state (fresh / lagging / stale / degraded)
 * - Recent sync events by source
 * - Missing or empty mirrors
 *
 * Usage:
 *   npx tsx scripts/check-mirror-freshness.ts
 */

import { PrismaClient } from "../packages/db/generated/client/index.js";

const prisma = new PrismaClient();

interface MirrorCheck {
  table: string;
  label: string;
  count: number;
  latestSync: Date | null;
  state: string;
  ageLabel: string;
}

function freshnessState(syncedAt: Date | null): { state: string; ageLabel: string } {
  if (!syncedAt) return { state: "MISSING", ageLabel: "No data" };

  const ageMs = Date.now() - syncedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = ageHours / 24;

  let state: string;
  if (ageHours < 1) state = "FRESH";
  else if (ageHours < 6) state = "LAGGING";
  else if (ageHours < 24) state = "STALE";
  else state = "DEGRADED";

  let ageLabel: string;
  if (ageDays >= 1) ageLabel = `${ageDays.toFixed(1)} days ago`;
  else if (ageHours >= 1) ageLabel = `${ageHours.toFixed(1)} hours ago`;
  else ageLabel = `${Math.round(ageMs / 60000)} minutes ago`;

  return { state, ageLabel };
}

async function checkTable(table: string, label: string): Promise<MirrorCheck> {
  const [countResult, syncResult] = await Promise.all([
    prisma.$queryRawUnsafe<[{ cnt: bigint }]>(`SELECT COUNT(*) as cnt FROM "${table}"`),
    prisma.$queryRawUnsafe<[{ max_sync: Date | null }]>(`SELECT MAX(synced_at) as max_sync FROM "${table}"`),
  ]);

  const count = Number(countResult[0]?.cnt ?? 0);
  const latestSync = syncResult[0]?.max_sync ?? null;
  const { state, ageLabel } = freshnessState(latestSync);

  return { table, label, count, latestSync, state, ageLabel };
}

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  MIRROR FRESHNESS DIAGNOSTIC");
  console.log("  Run at:", new Date().toISOString());
  console.log("══════════════════════════════════════════════════════════════\n");

  // Check all mirror tables
  const checks = await Promise.all([
    checkTable("stripe_customers", "Stripe Customers"),
    checkTable("stripe_products", "Stripe Products"),
    checkTable("stripe_prices", "Stripe Prices"),
    checkTable("stripe_subscriptions", "Stripe Subscriptions"),
    checkTable("stripe_subscription_items", "Stripe Sub Items"),
    checkTable("stripe_invoices", "Stripe Invoices"),
    checkTable("stripe_payments", "Stripe Payments"),
    checkTable("stripe_payment_methods", "Stripe Payment Methods"),
    checkTable("sf_accounts", "SF Accounts"),
    checkTable("sf_contracts", "SF Contracts"),
    checkTable("sf_contract_lines", "SF Contract Lines"),
    checkTable("sf_contacts", "SF Contacts"),
  ]);

  // Print table
  console.log("TABLE                        COUNT     STATE      LAST SYNCED");
  console.log("─────────────────────────────────────────────────────────────");

  for (const c of checks) {
    const countStr = String(c.count).padStart(7);
    const stateStr = c.state.padEnd(10);
    const icon = c.state === "FRESH" ? "✓" : c.state === "LAGGING" ? "~" : c.state === "MISSING" ? "✗" : "!";
    const timeStr = c.latestSync
      ? `${c.latestSync.toISOString().slice(0, 19)} (${c.ageLabel})`
      : "— never synced —";
    console.log(`${icon} ${c.label.padEnd(26)} ${countStr}  ${stateStr} ${timeStr}`);
  }

  // Summary
  const missing = checks.filter((c) => c.count === 0);
  const degraded = checks.filter((c) => c.state === "DEGRADED");
  const stale = checks.filter((c) => c.state === "STALE");

  console.log("\n── SUMMARY ──────────────────────────────────────────────────");

  if (missing.length > 0) {
    console.log(`\n⚠  EMPTY MIRRORS (${missing.length}):`);
    for (const m of missing) console.log(`   - ${m.label}`);
  }

  if (degraded.length > 0) {
    console.log(`\n⚠  DEGRADED (>24h old) (${degraded.length}):`);
    for (const d of degraded) console.log(`   - ${d.label}: ${d.ageLabel}`);
  }

  if (stale.length > 0) {
    console.log(`\n⚠  STALE (6-24h old) (${stale.length}):`);
    for (const s of stale) console.log(`   - ${s.label}: ${s.ageLabel}`);
  }

  if (missing.length === 0 && degraded.length === 0 && stale.length === 0) {
    console.log("\n✓  All mirrors are fresh or lagging. No issues detected.");
  }

  // Recent sync events
  console.log("\n── RECENT SYNC EVENTS ───────────────────────────────────────");

  const recentEvents = await prisma.$queryRaw<{ source: string; event_type: string; cnt: bigint; latest: Date }[]>`
    SELECT source, event_type, COUNT(*) as cnt, MAX(created_at) as latest
    FROM sync_events
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY source, event_type
    ORDER BY latest DESC
    LIMIT 20
  `;

  if (recentEvents.length === 0) {
    console.log("  No sync events in the last 7 days.");
  } else {
    console.log("  SOURCE       EVENT TYPE                        COUNT   LATEST");
    for (const e of recentEvents) {
      console.log(
        `  ${e.source.padEnd(12)} ${e.event_type.padEnd(34)} ${String(Number(e.cnt)).padStart(5)}   ${e.latest.toISOString().slice(0, 19)}`,
      );
    }
  }

  // Sync jobs
  const recentJobs = await prisma.$queryRaw<{ job_type: string; status: string; cnt: bigint; latest: Date }[]>`
    SELECT job_type, status, COUNT(*) as cnt, MAX(created_at) as latest
    FROM sync_jobs
    GROUP BY job_type, status
    ORDER BY latest DESC
    LIMIT 10
  `;

  console.log("\n── SYNC JOBS ────────────────────────────────────────────────");
  if (recentJobs.length === 0) {
    console.log("  No sync jobs recorded. Backfills may not be using the SyncJob table.");
  } else {
    for (const j of recentJobs) {
      console.log(`  ${j.job_type} [${j.status}] — ${Number(j.cnt)} runs, latest: ${j.latest.toISOString().slice(0, 19)}`);
    }
  }

  // Restoration recommendations
  console.log("\n── RESTORATION COMMANDS ─────────────────────────────────────");
  console.log("  To restore Stripe invoices (if empty):");
  console.log("    npx tsx scripts/backfill-stripe-invoices.ts");
  console.log("");
  console.log("  To restore Salesforce data:");
  console.log("    npx tsx scripts/backfill-sf-contracts.ts");
  console.log("    npx tsx scripts/backfill-sf-contacts.ts");
  console.log("");
  console.log("  To restore Stripe subscriptions:");
  console.log("    npx tsx scripts/backfill-subscriptions.ts");
  console.log("");
  console.log("  To restore Stripe customers/products/prices:");
  console.log("    npx tsx scripts/backfill-stripe-mirror.ts");
  console.log("");
  console.log("  To restore Stripe payments:");
  console.log("    npx tsx scripts/backfill-stripe-payments.ts");
  console.log("");
  console.log("  To restore Stripe payment methods:");
  console.log("    npx tsx scripts/backfill-stripe-payment-methods.ts");
  console.log("══════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
