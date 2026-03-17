/**
 * Backfill script: Salesforce Contracts + Contract Lines (SBQQ__Subscription__c) → local mirror tables.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-sf-contracts.ts
 *   npx tsx scripts/backfill-sf-contracts.ts --only contracts
 *   npx tsx scripts/backfill-sf-contracts.ts --only lines
 *
 * Requires: DATABASE_URL, SF_CLIENT_ID, SF_USERNAME, SF_PRIVATE_KEY_BASE64 in env.
 */

import { soql } from "../packages/integrations/salesforce/src/index.ts";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const prisma = new PrismaClient();

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const CONTRACT_FIELDS = `
  Id, AccountId, Account.Name, Status, StatusCode, StartDate, EndDate,
  ContractTerm, ContractNumber, Description, OwnerId, Owner.Name,
  Stripe_Subscription_ID__c, Stripe_Customer_ID__c, Stripe_Status__c,
  Stripe_Quote__c, Stripe_Subscription_Schedule_ID__c, Collection_Method__c,
  Contract_MRR__c, Contract_ARR__c, SBQQ__Opportunity__c, SBQQ__Evergreen__c,
  DO_NOT_RENEW__c, SBQQ__RenewalTerm__c, Cancellation_Date__c,
  Days_Till_Expiry__c, ActivatedDate, CustomerSignedDate, LastModifiedDate
`.replace(/\n/g, " ");

const LINE_FIELDS = `
  Id, SBQQ__Contract__c, SBQQ__Account__c, SBQQ__Product__c,
  SBQQ__ProductName__c, SBQQ__Quantity__c, SBQQ__ListPrice__c,
  SBQQ__NetPrice__c, SBQQ__StartDate__c, SBQQ__EndDate__c,
  Status__c, SBQQ__BillingFrequency__c,
  Stripe_Subscription_ID__c, Stripe_Price_ID__c, Stripe_Product_ID__c,
  Stripe_Subscription_ID_Actual__c, Stripe_Status__c,
  Monthly_Value__c, ARR__c, LastModifiedDate
`.replace(/\n/g, " ");

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function mapContract(r: any) {
  return {
    accountId: r.AccountId,
    accountName: r.Account?.Name ?? null,
    status: r.Status,
    statusCode: r.StatusCode ?? null,
    startDate: parseDate(r.StartDate),
    endDate: parseDate(r.EndDate),
    contractTerm: r.ContractTerm ?? null,
    contractNumber: r.ContractNumber ?? null,
    description: r.Description ?? null,
    ownerId: r.OwnerId ?? null,
    ownerName: r.Owner?.Name ?? null,
    stripeSubscriptionId: r.Stripe_Subscription_ID__c ?? null,
    stripeCustomerId: r.Stripe_Customer_ID__c ?? null,
    stripeStatus: r.Stripe_Status__c ?? null,
    stripeQuoteSfId: r.Stripe_Quote__c ?? null,
    stripeScheduleId: r.Stripe_Subscription_Schedule_ID__c ?? null,
    collectionMethod: r.Collection_Method__c ?? null,
    mrr: r.Contract_MRR__c ?? null,
    arr: r.Contract_ARR__c ?? null,
    opportunityId: r.SBQQ__Opportunity__c ?? null,
    evergreen: r.SBQQ__Evergreen__c ?? false,
    doNotRenew: r.DO_NOT_RENEW__c ?? false,
    renewalTerm: r.SBQQ__RenewalTerm__c ?? null,
    cancellationDate: parseDate(r.Cancellation_Date__c),
    daysTillExpiry: r.Days_Till_Expiry__c ?? null,
    activatedDate: parseDate(r.ActivatedDate),
    customerSignedDate: parseDate(r.CustomerSignedDate),
    sfLastModified: parseDate(r.LastModifiedDate),
    syncedAt: new Date(),
  };
}

function mapLine(r: any) {
  return {
    contractId: r.SBQQ__Contract__c,
    accountId: r.SBQQ__Account__c ?? null,
    productId: r.SBQQ__Product__c ?? null,
    productName: r.SBQQ__ProductName__c ?? null,
    quantity: r.SBQQ__Quantity__c ?? null,
    listPrice: r.SBQQ__ListPrice__c ?? null,
    netPrice: r.SBQQ__NetPrice__c ?? null,
    startDate: parseDate(r.SBQQ__StartDate__c),
    endDate: parseDate(r.SBQQ__EndDate__c),
    status: r.Status__c ?? null,
    billingFrequency: r.SBQQ__BillingFrequency__c ?? null,
    stripeSubItemId: r.Stripe_Subscription_ID__c ?? null,
    stripePriceId: r.Stripe_Price_ID__c ?? null,
    stripeProductId: r.Stripe_Product_ID__c ?? null,
    stripeSubscriptionId: r.Stripe_Subscription_ID_Actual__c ?? null,
    stripeStatus: r.Stripe_Status__c ?? null,
    mrr: r.Monthly_Value__c ?? null,
    arr: r.ARR__c ?? null,
    sfLastModified: parseDate(r.LastModifiedDate),
    syncedAt: new Date(),
  };
}

async function backfillContracts() {
  console.log("\n=== Backfilling Contracts ===");
  const records = await soql<any>(
    `SELECT ${CONTRACT_FIELDS} FROM Contract ORDER BY LastModifiedDate ASC`,
  );
  console.log(`Fetched ${records.length} contracts from Salesforce`);

  // Ensure all referenced accounts exist (create stubs for FK)
  const accountIds = new Set(records.map((r: any) => r.AccountId as string));
  const existingAccounts = await prisma.sfAccount.findMany({
    where: { id: { in: Array.from(accountIds) } },
    select: { id: true },
  });
  const existingAccountSet = new Set(existingAccounts.map((a) => a.id));
  const missingAccounts = Array.from(accountIds).filter((id) => !existingAccountSet.has(id));

  if (missingAccounts.length > 0) {
    console.log(`Creating ${missingAccounts.length} stub SfAccount records...`);
    const nameMap = new Map<string, string>();
    for (const r of records) {
      if (!nameMap.has(r.AccountId) && r.Account?.Name) {
        nameMap.set(r.AccountId, r.Account.Name);
      }
    }
    const CHUNK = 500;
    for (let i = 0; i < missingAccounts.length; i += CHUNK) {
      const batch = missingAccounts.slice(i, i + CHUNK);
      await prisma.sfAccount.createMany({
        data: batch.map((id) => ({
          id,
          name: nameMap.get(id) ?? "Unknown",
          isStub: true,
          stubReason: "contract_backfill",
        })),
        skipDuplicates: true,
      });
      console.log(`  Stubs: ${Math.min(i + CHUNK, missingAccounts.length)}/${missingAccounts.length}`);
    }
  }

  // Upsert contracts in batches using $transaction
  let created = 0;
  let errored = 0;
  const BATCH = 100;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    try {
      await prisma.$transaction(
        batch.map((r: any) => {
          const data = mapContract(r);
          return prisma.sfContract.upsert({
            where: { id: r.Id },
            create: { id: r.Id, ...data },
            update: data,
          });
        }),
      );
      created += batch.length;
    } catch (err) {
      // Fall back to individual upserts for this batch
      for (const r of batch) {
        try {
          const data = mapContract(r);
          await prisma.sfContract.upsert({
            where: { id: r.Id },
            create: { id: r.Id, ...data },
            update: data,
          });
          created++;
        } catch {
          errored++;
          if (errored <= 5) {
            console.error(`  Error on contract ${r.Id}:`, (err as Error).message);
          }
        }
      }
    }

    if ((i + BATCH) % 500 < BATCH || i + BATCH >= records.length) {
      console.log(`  Progress: ${Math.min(i + BATCH, records.length)}/${records.length} (${created} ok, ${errored} errors)`);
    }
  }

  console.log(`Contracts done: ${created} created/updated, ${errored} errors`);
}

async function backfillContractLines() {
  console.log("\n=== Backfilling Contract Lines (SBQQ__Subscription__c) ===");
  const records = await soql<any>(
    `SELECT ${LINE_FIELDS} FROM SBQQ__Subscription__c ORDER BY LastModifiedDate ASC`,
  );
  console.log(`Fetched ${records.length} contract lines from Salesforce`);

  // Get existing contract IDs to skip orphaned lines
  const contractIds = new Set(
    (await prisma.sfContract.findMany({ select: { id: true } })).map((c) => c.id),
  );

  // Filter to lines with valid parent contracts
  const validRecords = records.filter(
    (r: any) => r.SBQQ__Contract__c && contractIds.has(r.SBQQ__Contract__c),
  );
  const skipped = records.length - validRecords.length;
  console.log(`  ${validRecords.length} with valid parent, ${skipped} skipped (no parent contract)`);

  let created = 0;
  let errored = 0;
  const BATCH = 100;

  for (let i = 0; i < validRecords.length; i += BATCH) {
    const batch = validRecords.slice(i, i + BATCH);
    try {
      await prisma.$transaction(
        batch.map((r: any) => {
          const data = mapLine(r);
          return prisma.sfContractLine.upsert({
            where: { id: r.Id },
            create: { id: r.Id, ...data },
            update: data,
          });
        }),
      );
      created += batch.length;
    } catch {
      // Fall back to individual upserts for this batch
      for (const r of batch) {
        try {
          const data = mapLine(r);
          await prisma.sfContractLine.upsert({
            where: { id: r.Id },
            create: { id: r.Id, ...data },
            update: data,
          });
          created++;
        } catch (err2) {
          errored++;
          if (errored <= 5) {
            console.error(`  Error on line ${r.Id}:`, (err2 as Error).message);
          }
        }
      }
    }

    if ((i + BATCH) % 2000 < BATCH || i + BATCH >= validRecords.length) {
      console.log(`  Progress: ${Math.min(i + BATCH, validRecords.length)}/${validRecords.length} (${created} ok, ${errored} errors)`);
    }
  }

  console.log(`Contract lines done: ${created} created/updated, ${skipped} skipped, ${errored} errors`);
}

async function main() {
  try {
    if (!only || only === "contracts") {
      await backfillContracts();
    }
    if (!only || only === "lines") {
      await backfillContractLines();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
