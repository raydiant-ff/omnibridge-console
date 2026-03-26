/**
 * Backfill script: Salesforce CPQ quotes (SBQQ__Quote__c) -> local mirror table.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-sf-quotes.ts
 *
 * Requires: DATABASE_URL and Salesforce env vars.
 */

import { soql } from "../packages/integrations/salesforce/src/index.ts";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const prisma = new PrismaClient();

const QUOTE_FIELDS = `
  Id, Name, SBQQ__Account__c, SBQQ__Opportunity2__c, SBQQ__Status__c,
  SBQQ__NetAmount__c, SBQQ__StartDate__c, SBQQ__EndDate__c, SBQQ__Type__c,
  SBQQ__Primary__c, SBQQ__Ordered__c, Stripe_Subscription_ID__c,
  Stripe_Customer_ID__c, LastModifiedDate, CreatedDate
`.replace(/\n/g, " ");

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureAccounts(rows: Array<Record<string, unknown>>) {
  const accountIds = Array.from(
    new Set(
      rows
        .map((row) => row.SBQQ__Account__c)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (accountIds.length === 0) return;

  const existing = await prisma.sfAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((account) => account.id));
  const missingIds = accountIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) return;

  console.log(`Creating ${missingIds.length} stub Salesforce accounts for quote backfill...`);
  await prisma.sfAccount.createMany({
    data: missingIds.map((id) => ({
      id,
      name: "Unknown",
      isStub: true,
      stubReason: "quote_backfill",
      syncedAt: new Date(),
    })),
    skipDuplicates: true,
  });
}

async function main() {
  console.log("\n=== Backfilling Salesforce quotes ===");

  const rows = await soql<Record<string, unknown>>(
    `SELECT ${QUOTE_FIELDS} FROM SBQQ__Quote__c ORDER BY LastModifiedDate ASC`,
  );
  console.log(`Fetched ${rows.length} quotes from Salesforce`);

  await ensureAccounts(rows);

  let upserted = 0;
  let errored = 0;
  const batchSize = 100;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    try {
      await prisma.$transaction(
        batch.map((row) => {
          const accountId =
            typeof row.SBQQ__Account__c === "string" ? row.SBQQ__Account__c : "";

          const data = {
            accountId,
            opportunityId:
              typeof row.SBQQ__Opportunity2__c === "string"
                ? row.SBQQ__Opportunity2__c
                : null,
            name: typeof row.Name === "string" ? row.Name : null,
            status:
              typeof row.SBQQ__Status__c === "string" && row.SBQQ__Status__c.length > 0
                ? row.SBQQ__Status__c
                : "Unknown",
            netAmount:
              typeof row.SBQQ__NetAmount__c === "number" ? row.SBQQ__NetAmount__c : null,
            startDate: parseDate(
              typeof row.SBQQ__StartDate__c === "string" ? row.SBQQ__StartDate__c : null,
            ),
            endDate: parseDate(
              typeof row.SBQQ__EndDate__c === "string" ? row.SBQQ__EndDate__c : null,
            ),
            quoteType:
              typeof row.SBQQ__Type__c === "string" ? row.SBQQ__Type__c : null,
            isPrimary: row.SBQQ__Primary__c === true,
            isOrdered: row.SBQQ__Ordered__c === true,
            stripeSubscriptionId:
              typeof row.Stripe_Subscription_ID__c === "string"
                ? row.Stripe_Subscription_ID__c
                : null,
            stripeCustomerId:
              typeof row.Stripe_Customer_ID__c === "string"
                ? row.Stripe_Customer_ID__c
                : null,
            sfCreatedDate: parseDate(
              typeof row.CreatedDate === "string" ? row.CreatedDate : null,
            ),
            sfLastModified: parseDate(
              typeof row.LastModifiedDate === "string" ? row.LastModifiedDate : null,
            ),
            syncedAt: new Date(),
          };

          return prisma.sfQuote.upsert({
            where: { id: row.Id as string },
            create: { id: row.Id as string, ...data },
            update: data,
          });
        }),
      );
      upserted += batch.length;
    } catch (error) {
      for (const row of batch) {
        try {
          const accountId =
            typeof row.SBQQ__Account__c === "string" ? row.SBQQ__Account__c : "";

          const data = {
            accountId,
            opportunityId:
              typeof row.SBQQ__Opportunity2__c === "string"
                ? row.SBQQ__Opportunity2__c
                : null,
            name: typeof row.Name === "string" ? row.Name : null,
            status:
              typeof row.SBQQ__Status__c === "string" && row.SBQQ__Status__c.length > 0
                ? row.SBQQ__Status__c
                : "Unknown",
            netAmount:
              typeof row.SBQQ__NetAmount__c === "number" ? row.SBQQ__NetAmount__c : null,
            startDate: parseDate(
              typeof row.SBQQ__StartDate__c === "string" ? row.SBQQ__StartDate__c : null,
            ),
            endDate: parseDate(
              typeof row.SBQQ__EndDate__c === "string" ? row.SBQQ__EndDate__c : null,
            ),
            quoteType:
              typeof row.SBQQ__Type__c === "string" ? row.SBQQ__Type__c : null,
            isPrimary: row.SBQQ__Primary__c === true,
            isOrdered: row.SBQQ__Ordered__c === true,
            stripeSubscriptionId:
              typeof row.Stripe_Subscription_ID__c === "string"
                ? row.Stripe_Subscription_ID__c
                : null,
            stripeCustomerId:
              typeof row.Stripe_Customer_ID__c === "string"
                ? row.Stripe_Customer_ID__c
                : null,
            sfCreatedDate: parseDate(
              typeof row.CreatedDate === "string" ? row.CreatedDate : null,
            ),
            sfLastModified: parseDate(
              typeof row.LastModifiedDate === "string" ? row.LastModifiedDate : null,
            ),
            syncedAt: new Date(),
          };

          await prisma.sfQuote.upsert({
            where: { id: row.Id as string },
            create: { id: row.Id as string, ...data },
            update: data,
          });
          upserted += 1;
        } catch (rowError) {
          errored += 1;
          if (errored <= 5) {
            console.error(`Error on quote ${row.Id}:`, (rowError as Error).message);
          }
        }
      }
    }

    const progress = Math.min(index + batchSize, rows.length);
    console.log(`  Progress: ${progress}/${rows.length} (${upserted} ok, ${errored} errors)`);
  }

  const totalsByStatus = await prisma.sfQuote.groupBy({
    by: ["status"],
    _count: { id: true },
    orderBy: { status: "asc" },
  });

  console.log(`Quotes done: ${upserted} upserted, ${errored} errors`);
  console.log(JSON.stringify(totalsByStatus, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Fatal:", error);
  await prisma.$disconnect();
  process.exit(1);
});
