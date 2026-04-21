/**
 * Verification: inspect generated data quality issues.
 *
 * Prints counts by issue type and severity, plus representative samples.
 *
 * Usage: npx tsx scripts/check-data-quality-issues.ts
 */

import { buildOmniDataQualityIssues } from "../apps/console/src/lib/omni/builders/build-omni-data-quality-issues";

process.env.SKIP_AUTH = "true";

async function main() {
  console.log("\n=== Data Quality Issues ===\n");

  const report = await buildOmniDataQualityIssues();

  console.log(`Total issues: ${report.totalCount}`);
  console.log(`  Critical: ${report.criticalCount}`);
  console.log(`  High: ${report.highCount}`);
  console.log(`  Medium: ${report.mediumCount}`);
  console.log(`  Low: ${report.lowCount}`);

  // Count by issue type
  const byType = new Map<string, number>();
  for (const issue of report.issues) {
    byType.set(issue.issueType, (byType.get(issue.issueType) ?? 0) + 1);
  }

  console.log("\n--- By Issue Type ---");
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Sample first 3 of each type
  console.log("\n--- Samples (first 3 per type) ---");
  const seen = new Map<string, number>();
  for (const issue of report.issues) {
    const count = seen.get(issue.issueType) ?? 0;
    if (count >= 3) continue;
    seen.set(issue.issueType, count + 1);

    console.log(`\n  [${issue.severity.toUpperCase()}] ${issue.issueType}`);
    console.log(`    Entity: ${issue.entityType}:${issue.entityId.slice(0, 30)}`);
    console.log(`    Name: ${issue.displayName ?? "(none)"}`);
    console.log(`    Summary: ${issue.summary}`);
    if (issue.omniAccountId) {
      console.log(`    OmniAccountId: ${issue.omniAccountId}`);
    }
  }

  console.log(`\n=== Done ===\n`);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
