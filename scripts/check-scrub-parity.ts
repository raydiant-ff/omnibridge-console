/**
 * Scrub canonical layer validation.
 *
 * Since the legacy scrub query uses requireSession() which can't run
 * outside Next.js, this script validates the canonical layer directly:
 * - builds scrub data for a month
 * - checks output is non-empty and internally consistent
 * - validates classification math
 * - validates ARR consistency (canceled + net = replacement)
 *
 * Usage: npx tsx scripts/check-scrub-parity.ts [month]
 * Example: npx tsx scripts/check-scrub-parity.ts 2026-02
 */

import { buildOmniScrubMonthlyAccounts } from "../apps/console/src/lib/omni/builders/build-omni-scrub-monthly-accounts";

const now = new Date();
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const defaultMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
const month = process.argv[2] ?? defaultMonth;

async function main() {
  console.log(`\n=== Scrub Canonical Validation ===`);
  console.log(`Month: ${month}\n`);

  const data = await buildOmniScrubMonthlyAccounts(month);

  // --- Summary ---
  console.log("--- Summary ---");
  console.log(`  Accounts: ${data.summary.totalAccounts}`);
  console.log(`  Churned: ${data.summary.churned}`);
  console.log(`  Contracted: ${data.summary.contracted}`);
  console.log(`  Offset: ${data.summary.offset}`);
  console.log(`  Expanded: ${data.summary.expanded}`);
  console.log(`  Canceled ARR: ${data.summary.totalCanceledArrCents} cents`);
  console.log(`  Replacement ARR: ${data.summary.totalReplacementArrCents} cents`);
  console.log(`  Net ARR: ${data.summary.totalNetArrImpactCents} cents`);
  console.log(`  Freshness: ${data.summary.freshness.state} — ${data.summary.freshness.label}`);

  // --- Composite freshness ---
  console.log("\n--- Composite Freshness ---");
  for (const src of data.summary.compositeFreshness.sources) {
    console.log(`  ${src.source}: ${src.freshness.state} — ${src.freshness.label}`);
  }

  let issues = 0;

  // --- Classification consistency ---
  console.log("\n--- Classification Consistency ---");
  const classCount = data.rows.reduce(
    (acc, r) => {
      acc[r.classification] = (acc[r.classification] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summaryClassTotal = data.summary.churned + data.summary.contracted + data.summary.offset + data.summary.expanded;
  const match = summaryClassTotal === data.summary.totalAccounts;
  if (!match) issues++;
  console.log(`  ${match ? "✓" : "✗"} Classification sum matches totalAccounts (${summaryClassTotal} vs ${data.summary.totalAccounts})`);

  for (const cls of ["churned", "contracted", "offset", "expanded"] as const) {
    const rowCount = classCount[cls] ?? 0;
    const summaryCount = data.summary[cls];
    const m = rowCount === summaryCount;
    if (!m) issues++;
    console.log(`  ${m ? "✓" : "✗"} ${cls}: rows=${rowCount}, summary=${summaryCount}`);
  }

  // --- Per-row ARR consistency ---
  console.log("\n--- Per-Row ARR Consistency ---");
  let arrIssues = 0;
  for (const row of data.rows) {
    const expectedNet = row.replacementArrCents - row.canceledArrCents;
    if (row.netArrImpactCents !== expectedNet) {
      arrIssues++;
      if (arrIssues <= 5) {
        console.log(`  ✗ ${row.displayName}: net=${row.netArrImpactCents} expected=${expectedNet}`);
      }
    }
  }
  if (arrIssues === 0) {
    console.log("  ✓ All rows: net = replacement - canceled");
  } else {
    console.log(`  ${arrIssues} rows with ARR inconsistency`);
    issues += arrIssues;
  }

  // --- Summary ARR consistency ---
  console.log("\n--- Summary ARR Consistency ---");
  const expectedSummaryNet = data.summary.totalReplacementArrCents - data.summary.totalCanceledArrCents;
  const summaryMatch = data.summary.totalNetArrImpactCents === expectedSummaryNet;
  if (!summaryMatch) issues++;
  console.log(`  ${summaryMatch ? "✓" : "✗"} Summary net = replacement - canceled (${data.summary.totalNetArrImpactCents} vs ${expectedSummaryNet})`);

  // --- Row count sanity ---
  console.log("\n--- Row Sanity ---");
  const hasRows = data.rows.length > 0;
  console.log(`  ${hasRows ? "✓" : "⚠"} Row count: ${data.rows.length}`);
  if (!hasRows) console.log("    (no cancellations in this month — may be expected)");

  // --- Sample rows ---
  console.log("\n--- Sample Rows (first 5) ---");
  for (const row of data.rows.slice(0, 5)) {
    console.log(`  ${row.displayName} [${row.classification}]`);
    console.log(`    canceled=${row.canceledArrCents}¢  snapshot=${row.snapshotArrCents}¢  replacement=${row.replacementArrCents}¢  net=${row.netArrImpactCents}¢`);
    console.log(`    canceledSubs=${row.canceledSubscriptionCount}  activeSubs=${row.activeSubscriptionCountNow}`);
  }

  console.log(`\n=== ${issues === 0 ? "✓ VALIDATION PASS" : `✗ ${issues} ISSUES FOUND`} ===\n`);
  process.exit(issues === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(2);
});
