/**
 * Parity check: legacy cs-renewals.ts vs canonical omni renewals.
 *
 * Compares counts, money totals, and candidate IDs between the old
 * and new data sources for a given month and CSM filter.
 *
 * Usage: npx tsx scripts/check-renewals-parity.ts [month] [csm]
 * Example: npx tsx scripts/check-renewals-parity.ts 2025-03
 *          npx tsx scripts/check-renewals-parity.ts 2025-03 "Jane Doe"
 */

import { getRenewalCandidates } from "../apps/console/src/lib/queries/cs-renewals";
import { buildOmniRenewalDashboard } from "../apps/console/src/lib/omni/builders/build-omni-renewal-candidates";

// Suppress requireSession for scripts
process.env.SKIP_AUTH = "true";

const month = process.argv[2] ?? new Date().toISOString().slice(0, 7);
const csm = process.argv[3] ?? null;

async function main() {
  console.log(`\n=== Renewals Parity Check ===`);
  console.log(`Month: ${month}, CSM: ${csm ?? "(all)"}\n`);

  const [legacy, canonical] = await Promise.all([
    getRenewalCandidates(month, csm),
    buildOmniRenewalDashboard(month, csm),
  ]);

  // --- Summary comparison ---
  console.log("--- Summary ---");
  const fields = [
    "total", "totalMrr", "allCount", "autoRenewCount", "reviewNeededCount",
    "cancellingCount", "cancellingMrr", "scheduledEndCount", "scheduledEndMrr",
    "periodEndingCount", "periodEndingMrr",
  ] as const;

  let summaryMatch = true;
  for (const field of fields) {
    const legacyVal = legacy.summary[field];
    const canonVal = canonical.summary[field];
    const match = legacyVal === canonVal;
    if (!match) summaryMatch = false;
    console.log(
      `  ${match ? "✓" : "✗"} ${field}: legacy=${legacyVal}, canonical=${canonVal}`,
    );
  }

  // --- Candidate count ---
  console.log("\n--- Candidate Counts ---");
  console.log(`  Month candidates: legacy=${legacy.candidates.length}, canonical=${canonical.candidates.length}`);
  console.log(`  Overdue candidates: legacy=${legacy.overdue.length}, canonical=${canonical.overdue.length}`);

  // --- Candidate ID comparison ---
  const legacyIds = new Set(legacy.candidates.map((c) => c.candidateId));
  const canonicalIds = new Set(canonical.candidates.map((c) => c.candidateId));

  const onlyInLegacy = [...legacyIds].filter((id) => !canonicalIds.has(id));
  const onlyInCanonical = [...canonicalIds].filter((id) => !legacyIds.has(id));

  if (onlyInLegacy.length > 0) {
    console.log(`\n  ✗ Only in legacy (${onlyInLegacy.length}):`);
    for (const id of onlyInLegacy.slice(0, 10)) console.log(`    - ${id}`);
  }
  if (onlyInCanonical.length > 0) {
    console.log(`\n  ✗ Only in canonical (${onlyInCanonical.length}):`);
    for (const id of onlyInCanonical.slice(0, 10)) console.log(`    - ${id}`);
  }

  // --- Per-candidate MRR comparison ---
  console.log("\n--- Per-Candidate MRR Diffs ---");
  let mrrDiffs = 0;
  const legacyMap = new Map(legacy.candidates.map((c) => [c.candidateId, c]));
  for (const cc of canonical.candidates) {
    const lc = legacyMap.get(cc.candidateId);
    if (!lc) continue;
    if (lc.mrr !== cc.mrrCents) {
      mrrDiffs++;
      if (mrrDiffs <= 10) {
        console.log(`  ✗ ${cc.candidateId}: legacy=${lc.mrr}, canonical=${cc.mrrCents} (diff=${cc.mrrCents - lc.mrr})`);
      }
    }
  }
  if (mrrDiffs === 0) {
    console.log("  ✓ All candidate MRRs match");
  } else {
    console.log(`  ${mrrDiffs} MRR mismatches total`);
  }

  // --- CSM list ---
  console.log("\n--- CSM List ---");
  const csmMatch = JSON.stringify(legacy.csmList) === JSON.stringify(canonical.csmList);
  console.log(`  ${csmMatch ? "✓" : "✗"} CSM lists match (${legacy.csmList.length} entries)`);

  // --- Overall ---
  const allMatch = summaryMatch
    && onlyInLegacy.length === 0
    && onlyInCanonical.length === 0
    && mrrDiffs === 0
    && csmMatch;

  console.log(`\n=== ${allMatch ? "✓ PARITY PASS" : "✗ PARITY FAIL"} ===\n`);
  process.exit(allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error("Parity check failed:", err);
  process.exit(2);
});
