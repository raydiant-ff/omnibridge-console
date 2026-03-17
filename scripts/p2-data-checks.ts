/**
 * P2 data quality checks — run before FK hardening.
 * Usage: npx tsx scripts/p2-data-checks.ts
 */

import { PrismaClient } from "../packages/db/generated/client";

const prisma = new PrismaClient();

async function main() {
  // --- QuoteRecord.customerId ---
  const qrCheck = await prisma.$queryRaw<Array<{
    total_rows: bigint;
    orphaned_count: bigint;
  }>>`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM customer_index ci WHERE ci.id = quote_records.customer_id
        )
      ) AS orphaned_count
    FROM quote_records
  `;

  console.log("\n=== QuoteRecord.customerId ===");
  console.log(`  Total rows:    ${Number(qrCheck[0].total_rows)}`);
  console.log(`  Orphaned:      ${Number(qrCheck[0].orphaned_count)}`);
  const qrSafe = Number(qrCheck[0].orphaned_count) === 0;
  console.log(`  FK-safe:       ${qrSafe ? "YES ✓" : "NO ✗ — orphaned rows block FK"}`);

  // --- StripeInvoice.subscriptionId ---
  const invCheck = await prisma.$queryRaw<Array<{
    total_rows: bigint;
    null_count: bigint;
    non_null_count: bigint;
    orphaned_count: bigint;
  }>>`
    SELECT
      COUNT(*) AS total_rows,
      COUNT(*) FILTER (WHERE subscription_id IS NULL) AS null_count,
      COUNT(*) FILTER (WHERE subscription_id IS NOT NULL) AS non_null_count,
      COUNT(*) FILTER (
        WHERE subscription_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM stripe_subscriptions ss WHERE ss.id = stripe_invoices.subscription_id
        )
      ) AS orphaned_count
    FROM stripe_invoices
  `;

  console.log("\n=== StripeInvoice.subscriptionId ===");
  console.log(`  Total rows:    ${Number(invCheck[0].total_rows)}`);
  console.log(`  NULL:          ${Number(invCheck[0].null_count)}`);
  console.log(`  Non-null:      ${Number(invCheck[0].non_null_count)}`);
  console.log(`  Orphaned:      ${Number(invCheck[0].orphaned_count)}`);
  const invSafe = Number(invCheck[0].orphaned_count) === 0;
  console.log(`  FK-safe:       ${invSafe ? "YES ✓" : "NO ✗ — orphaned rows block FK"}`);

  // --- WorkItem.type distinct values ---
  const workItemTypes = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
    SELECT type, COUNT(*) AS count FROM work_items GROUP BY type ORDER BY count DESC
  `;

  console.log("\n=== WorkItem.type distinct values ===");
  if (workItemTypes.length === 0) {
    console.log("  (no rows in work_items table)");
  } else {
    for (const row of workItemTypes) {
      console.log(`  "${row.type}": ${Number(row.count)} rows`);
    }
  }

  const validTypes = new Set(["renewal_follow_up", "quote_review", "billing_issue", "customer_task", "ops_exception"]);
  const unknownTypes = workItemTypes.filter((r) => !validTypes.has(r.type));
  console.log(`  Unmapped values: ${unknownTypes.length === 0 ? "none ✓" : unknownTypes.map((r) => `"${r.type}"`).join(", ") + " ✗"}`);

  console.log("\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
