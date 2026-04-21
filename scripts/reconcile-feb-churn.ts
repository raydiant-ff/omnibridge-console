import Stripe from "stripe";
import { PrismaClient } from "../packages/db/generated/client/index.js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Load env from apps/console/.env.local (same pattern as other scripts but automated)
// ---------------------------------------------------------------------------

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Always overwrite — packages/db/.env may have stale values loaded by Prisma
      process.env[key] = val;
    }
  } catch {
    // file not found is fine
  }
}

loadEnvFile(resolve(__dirname, "../apps/console/.env.local"));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;
let stripeValid = false;

const prisma = new PrismaClient();

const CSV_PATH = resolve(
  __dirname,
  "../Revenue & ARR Data Scrub (Feb-26) - Feb Subscription Churn.csv",
);
const OUTPUT_PATH = resolve(__dirname, "../artifacts/local/spreadsheets/feb-2026-churn-reconciled.csv");

// ---------------------------------------------------------------------------
// CSV parsing (no external deps)
// ---------------------------------------------------------------------------

interface CsvRow {
  rowNum: number;
  accountName: string;
  sfAccountId: string;
  janArr: number;
  febArr: number;
  reportedDelta: number;
}

function parseCsvNumber(raw: string): number {
  // Handle quoted numbers with commas: "21,804" → 21804
  const cleaned = raw.replace(/[",]/g, "").trim();
  if (!cleaned || cleaned === "#N/A") return 0;
  return parseFloat(cleaned) || 0;
}

/** Simple CSV field splitter that respects quoted fields */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(): CsvRow[] {
  const raw = readFileSync(CSV_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  // Skip header (line 0)
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    // Columns: 0=rowNum, 1=accountName, 2=sfAccountId, 3=jan, 4=feb, 5=delta, ...
    const sfAccountId = fields[2]?.trim();
    if (!sfAccountId || sfAccountId === "#N/A") continue;
    rows.push({
      rowNum: parseInt(fields[0]) || i,
      accountName: fields[1]?.trim() || "Unknown",
      sfAccountId,
      janArr: parseCsvNumber(fields[3]),
      febArr: parseCsvNumber(fields[4]),
      reportedDelta: Math.abs(parseCsvNumber(fields[5])), // CSV stores as negative; normalize to positive loss
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Stripe customer resolution (3 DB tables + Stripe metadata search)
// ---------------------------------------------------------------------------

async function resolveStripeCustomerId(
  sfAccountId: string,
): Promise<{ id: string; source: string } | null> {
  // 1. CustomerIndex — the canonical identity mapping
  const fromIndex = await prisma.customerIndex.findUnique({
    where: { sfAccountId },
    select: { stripeCustomerId: true },
  });
  if (fromIndex?.stripeCustomerId)
    return { id: fromIndex.stripeCustomerId, source: "CustomerIndex" };

  // 2. SfAccount mirror — has stripeCustomerId column
  const fromSf = await prisma.sfAccount.findUnique({
    where: { id: sfAccountId },
    select: { stripeCustomerId: true },
  });
  if (fromSf?.stripeCustomerId)
    return { id: fromSf.stripeCustomerId, source: "SfAccount" };

  // 3. StripeCustomer mirror — has sfAccountId column
  const fromStripe = await prisma.stripeCustomer.findFirst({
    where: { sfAccountId },
    select: { id: true },
  });
  if (fromStripe) return { id: fromStripe.id, source: "StripeCustomer" };

  // 4. Last resort: Stripe live API metadata search (correct key: sf_account_id)
  if (stripe && stripeValid) {
    try {
      const result = await stripe.customers.search({
        query: `metadata["sf_account_id"]:"${sfAccountId}"`,
        limit: 1,
      });
      if (result.data.length > 0)
        return { id: result.data[0].id, source: "StripeSearch" };
    } catch {
      // search may fail, fall through
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// MRR / ARR calculation from live Stripe subscriptions
// ---------------------------------------------------------------------------

interface SubSummary {
  activeCount: number; // subs with real revenue (active/trialing/past_due with ARR > 0)
  activeArr: number;
  canceledCount: number;
  zeroArrActiveCount: number; // active subs at $0 — placeholder/free, not real revenue
  pastDueCount: number;
}

function computeItemMrr(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  if (!price?.unit_amount) return 0;
  const amount = price.unit_amount * (item.quantity ?? 1); // in cents
  const interval = price.recurring?.interval;
  const intervalCount = price.recurring?.interval_count ?? 1;
  if (interval === "year") return amount / (12 * intervalCount);
  if (interval === "month") return amount / intervalCount;
  return 0; // one-time or unknown
}

async function getSubscriptionSummary(
  stripeCustomerId: string,
): Promise<SubSummary> {
  let activeCount = 0;
  let zeroArrActiveCount = 0;
  let pastDueCount = 0;
  let activeMrrCents = 0;
  let canceledCount = 0;

  // Paginate through all subscriptions
  for await (const sub of stripe!.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    expand: ["data.items.data.price"],
  })) {
    // Include active, trialing, AND past_due — past_due still represents intended revenue
    if (
      sub.status === "active" ||
      sub.status === "trialing" ||
      sub.status === "past_due"
    ) {
      let subMrr = 0;
      for (const item of sub.items.data) {
        subMrr += computeItemMrr(item);
      }
      if (subMrr > 0) {
        activeCount++;
        activeMrrCents += subMrr;
      } else {
        zeroArrActiveCount++; // $0 placeholder sub — don't count as real revenue
      }
      if (sub.status === "past_due") pastDueCount++;
    } else if (
      sub.status === "canceled" ||
      sub.status === "incomplete_expired"
    ) {
      canceledCount++;
    }
  }

  return {
    activeCount,
    activeArr: Math.round((activeMrrCents / 100) * 12 * 100) / 100,
    canceledCount,
    zeroArrActiveCount,
    pastDueCount,
  };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

type Classification =
  | "true_churn"
  | "contraction"
  | "migration"
  | "expansion"
  | "no_stripe_match";

function classify(
  janArr: number,
  summary: SubSummary,
  stripeCustomerId: string | null,
): { classification: Classification; realLoss: number; notes: string } {
  if (!stripeCustomerId) {
    return {
      classification: "no_stripe_match",
      realLoss: janArr,
      notes: "Could not resolve Stripe customer for this SF Account",
    };
  }

  const { activeCount, activeArr, zeroArrActiveCount, pastDueCount } = summary;
  const notesParts: string[] = [];

  if (zeroArrActiveCount > 0)
    notesParts.push(`${zeroArrActiveCount} $0 placeholder sub(s) ignored`);
  if (pastDueCount > 0)
    notesParts.push(`${pastDueCount} past_due sub(s) included in ARR`);

  // No paid active subs → true churn (even if $0 placeholder subs exist)
  if (activeCount === 0) {
    return {
      classification: "true_churn",
      realLoss: janArr,
      notes:
        (zeroArrActiveCount > 0
          ? `Only $0 placeholder subs remain; `
          : "No active subscriptions; ") + (notesParts.join("; ") || "fully churned"),
    };
  }

  if (activeArr >= janArr) {
    return {
      classification: "expansion",
      realLoss: 0,
      notes:
        `Active ARR $${activeArr.toLocaleString()} >= Jan ARR $${janArr.toLocaleString()}` +
        (notesParts.length ? `; ${notesParts.join("; ")}` : ""),
    };
  }

  // Has paid active subs but lower than Jan
  const realLoss = Math.round((janArr - activeArr) * 100) / 100;
  return {
    classification: "contraction",
    realLoss,
    notes:
      `Contracted from $${janArr.toLocaleString()} to $${activeArr.toLocaleString()}` +
      (notesParts.length ? `; ${notesParts.join("; ")}` : ""),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface OutputRow {
  accountName: string;
  sfAccountId: string;
  stripeCustomerId: string;
  janArr: number;
  febArr: number;
  reportedDelta: number;
  activeSubCount: number;
  currentActiveArr: number;
  realArrLoss: number;
  classification: string;
  notes: string;
}

async function main() {
  console.log("Parsing CSV...");
  const rows = parseCsv();
  console.log(`Found ${rows.length} accounts to reconcile\n`);

  // --- Validate Stripe key ---
  if (STRIPE_KEY) {
    stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-02-24.acacia" as any });
    try {
      await stripe.customers.list({ limit: 1 });
      stripeValid = true;
      console.log("Stripe API key validated ✓\n");
    } catch (err: any) {
      console.warn(
        `⚠  Stripe API key is invalid/expired: ${err.code ?? err.message}`,
      );
      console.warn(
        "   DB resolution will still run. Subscription queries will be skipped.\n",
      );
      stripeValid = false;
    }
  } else {
    console.warn("⚠  STRIPE_SECRET_KEY not set — running DB-only mode.\n");
  }

  // --- Phase 1: Resolve SF Account ID → Stripe Customer ID (DB + optional Stripe search) ---
  console.log("Phase 1: Resolving Stripe customer IDs...");
  const resolved: {
    row: CsvRow;
    stripeCustomerId: string;
    source: string;
  }[] = [];
  const unresolvedRows: CsvRow[] = [];
  const sourceCounts: Record<string, number> = {};

  for (const row of rows) {
    const match = await resolveStripeCustomerId(row.sfAccountId);
    if (match) {
      resolved.push({ row, stripeCustomerId: match.id, source: match.source });
      sourceCounts[match.source] = (sourceCounts[match.source] || 0) + 1;
    } else {
      unresolvedRows.push(row);
    }
  }

  console.log(
    `  Resolved: ${resolved.length}/${rows.length} | Unresolved: ${unresolvedRows.length}`,
  );
  for (const [src, cnt] of Object.entries(sourceCounts)) {
    console.log(`    via ${src}: ${cnt}`);
  }
  console.log("");

  // --- Phase 2: Query Stripe for live subscription data ---
  const results: OutputRow[] = [];

  if (stripeValid && stripe) {
    console.log("Phase 2: Querying Stripe for live subscriptions...");
    for (let i = 0; i < resolved.length; i++) {
      const { row, stripeCustomerId, source } = resolved[i];
      const pct = `[${i + 1}/${resolved.length}]`;

      const subSummary = await getSubscriptionSummary(stripeCustomerId);
      const { classification, realLoss, notes } = classify(
        row.janArr,
        subSummary,
        stripeCustomerId,
      );

      const extras: string[] = [];
      if (subSummary.zeroArrActiveCount > 0)
        extras.push(`${subSummary.zeroArrActiveCount} $0 subs`);
      if (subSummary.pastDueCount > 0)
        extras.push(`${subSummary.pastDueCount} past_due`);

      console.log(
        `${pct} ${row.accountName} — ${classification} (via ${source}) | ` +
          `Paid active: ${subSummary.activeCount} subs, $${subSummary.activeArr.toLocaleString()} ARR | ` +
          `Real loss: $${realLoss.toLocaleString()}` +
          (extras.length ? ` (${extras.join(", ")})` : ""),
      );

      results.push({
        accountName: row.accountName,
        sfAccountId: row.sfAccountId,
        stripeCustomerId,
        janArr: row.janArr,
        febArr: row.febArr,
        reportedDelta: row.reportedDelta,
        activeSubCount: subSummary.activeCount,
        currentActiveArr: subSummary.activeArr,
        realArrLoss: realLoss,
        classification,
        notes,
      });

      // Small delay to be kind to Stripe rate limits
      if (i < resolved.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  } else {
    console.log(
      "Phase 2: SKIPPED — Stripe key unavailable. Resolved accounts written with classification 'pending_stripe'.",
    );
    for (const { row, stripeCustomerId, source } of resolved) {
      results.push({
        accountName: row.accountName,
        sfAccountId: row.sfAccountId,
        stripeCustomerId,
        janArr: row.janArr,
        febArr: row.febArr,
        reportedDelta: row.reportedDelta,
        activeSubCount: 0,
        currentActiveArr: 0,
        realArrLoss: 0,
        classification: "pending_stripe",
        notes: `Stripe customer found (via ${source}) but key expired — re-run with valid key`,
      });
    }
  }

  // Add unresolved rows
  for (const row of unresolvedRows) {
    results.push({
      accountName: row.accountName,
      sfAccountId: row.sfAccountId,
      stripeCustomerId: "",
      janArr: row.janArr,
      febArr: row.febArr,
      reportedDelta: row.reportedDelta,
      activeSubCount: 0,
      currentActiveArr: 0,
      realArrLoss: row.janArr,
      classification: "no_stripe_match",
      notes: "Could not resolve Stripe customer",
    });
  }

  // -------------------------------------------------------------------------
  // Write output CSV
  // -------------------------------------------------------------------------
  const header = [
    "Account Name",
    "SF Account ID",
    "Stripe Customer ID",
    "Reported Jan ARR",
    "Reported Feb ARR",
    "Reported Delta",
    "Current Active Subs",
    "Current Active ARR",
    "Real ARR Loss",
    "Classification",
    "Notes",
  ].join(",");

  const csvLines = results.map((r) => {
    const escapeCsv = (v: string) =>
      v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    return [
      escapeCsv(r.accountName),
      r.sfAccountId,
      r.stripeCustomerId,
      r.janArr,
      r.febArr,
      r.reportedDelta,
      r.activeSubCount,
      r.currentActiveArr,
      r.realArrLoss,
      r.classification,
      escapeCsv(r.notes),
    ].join(",");
  });

  writeFileSync(OUTPUT_PATH, [header, ...csvLines].join("\n"), "utf-8");
  console.log(`\nOutput written to: ${OUTPUT_PATH}`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const totalReportedDelta = results.reduce(
    (s, r) => s + r.reportedDelta,
    0,
  );
  const totalRealLoss = results.reduce((s, r) => s + r.realArrLoss, 0);

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.classification] = (counts[r.classification] || 0) + 1;
  }

  const withActiveSubs = results.filter((r) => r.activeSubCount > 0).length;

  console.log("\n" + "=".repeat(60));
  console.log("RECONCILIATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total accounts analyzed:     ${results.length}`);
  console.log(`Stripe customer resolved:    ${resolved.length}`);
  console.log(`Stripe customer NOT found:   ${unresolvedRows.length}`);
  console.log(`Accounts w/ active subs:     ${withActiveSubs}`);
  console.log("");
  for (const [cls, cnt] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls.padEnd(20)} ${cnt}`);
  }
  console.log("");
  console.log(
    `Reported total churn:  $${totalReportedDelta.toLocaleString()}`,
  );
  if (stripeValid) {
    console.log(`Real total ARR loss:   $${totalRealLoss.toLocaleString()}`);
    const diff = totalReportedDelta - totalRealLoss;
    const pct = totalReportedDelta !== 0
      ? Math.round((diff / totalReportedDelta) * 100)
      : 0;
    if (diff > 0) {
      console.log(`Report OVERSTATED by:  $${diff.toLocaleString()} (${pct}% — some "churn" was actually contraction/migration)`);
    } else if (diff < 0) {
      console.log(`Report UNDERSTATED by: $${Math.abs(diff).toLocaleString()} (${Math.abs(pct)}% — real losses exceed reported delta)`);
    } else {
      console.log(`Report matches reality exactly`);
    }
  } else {
    console.log(`Real total ARR loss:   (requires valid Stripe key)`);
  }
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
