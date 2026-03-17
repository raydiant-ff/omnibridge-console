/**
 * Hydrate sf_accounts: backfill CSM, owner, and metadata from Salesforce.
 *
 * Targets ALL accounts referenced by sf_contracts (not just those with CSM).
 * Updates stubs created by backfill-sf-contracts.ts with full account data.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/hydrate-sf-accounts.ts
 */

import { soql, escapeSoql } from "../packages/integrations/salesforce/src/index.ts";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const prisma = new PrismaClient();

interface SfAccountRow {
  Id: string;
  Name: string;
  Owner?: { Name?: string };
  OwnerId?: string;
  Account_Team_CSM__c?: string;
  Account_Team_CSM__r?: { Name?: string };
  Industry?: string;
  Type?: string;
  Stripe_Customer_ID__c?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  Website?: string;
}

const ACCOUNT_FIELDS = `
  Id, Name, OwnerId, Owner.Name,
  Account_Team_CSM__c, Account_Team_CSM__r.Name,
  Industry, Type, Stripe_Customer_ID__c,
  BillingCity, BillingState, BillingCountry, Website
`.replace(/\n/g, " ");

function domainFromWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function main() {
  // 1. Get all distinct account IDs referenced by contracts
  const contractAccounts = await prisma.sfContract.findMany({
    select: { accountId: true },
    distinct: ["accountId"],
  });
  const accountIds = contractAccounts.map((c) => c.accountId);
  console.log(`Found ${accountIds.length} distinct accounts referenced by contracts`);

  // 2. Query Salesforce in chunks (SOQL IN clause limit ~200)
  const CHUNK = 150;
  let fetched = 0;
  let upserted = 0;
  let errored = 0;

  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    const idList = chunk.map((id) => `'${escapeSoql(id)}'`).join(",");

    let records: SfAccountRow[];
    try {
      records = await soql<SfAccountRow>(
        `SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Id IN (${idList})`,
      );
    } catch (err) {
      console.error(`  SOQL error on chunk ${i}-${i + chunk.length}:`, (err as Error).message);
      errored += chunk.length;
      continue;
    }

    fetched += records.length;

    // Upsert each account
    for (const r of records) {
      try {
        await prisma.sfAccount.upsert({
          where: { id: r.Id },
          create: {
            id: r.Id,
            name: r.Name,
            ownerId: r.OwnerId ?? null,
            ownerName: r.Owner?.Name ?? null,
            csmId: r.Account_Team_CSM__c ?? null,
            csmName: r.Account_Team_CSM__r?.Name ?? null,
            industry: r.Industry ?? null,
            accountType: r.Type ?? null,
            stripeCustomerId: r.Stripe_Customer_ID__c ?? null,
            billingCity: r.BillingCity ?? null,
            billingState: r.BillingState ?? null,
            billingCountry: r.BillingCountry ?? null,
            domain: domainFromWebsite(r.Website),
            isStub: false,
            hydratedAt: new Date(),
            syncedAt: new Date(),
          },
          update: {
            name: r.Name,
            ownerId: r.OwnerId ?? null,
            ownerName: r.Owner?.Name ?? null,
            csmId: r.Account_Team_CSM__c ?? null,
            csmName: r.Account_Team_CSM__r?.Name ?? null,
            industry: r.Industry ?? null,
            accountType: r.Type ?? null,
            stripeCustomerId: r.Stripe_Customer_ID__c ?? null,
            billingCity: r.BillingCity ?? null,
            billingState: r.BillingState ?? null,
            billingCountry: r.BillingCountry ?? null,
            domain: domainFromWebsite(r.Website),
            isStub: false,
            hydratedAt: new Date(),
            syncedAt: new Date(),
          },
        });
        upserted++;
      } catch (err) {
        errored++;
        if (errored <= 5) {
          console.error(`  Error on account ${r.Id}:`, (err as Error).message);
        }
      }
    }

    const progress = Math.min(i + CHUNK, accountIds.length);
    console.log(`  Progress: ${progress}/${accountIds.length} (${fetched} fetched, ${upserted} upserted, ${errored} errors)`);
  }

  // 3. Summary
  const withCsm = await prisma.sfAccount.count({ where: { csmName: { not: null } } });
  const hydrated = await prisma.sfAccount.count({ where: { isStub: false } });
  const total = await prisma.sfAccount.count();

  console.log(`\nDone: ${upserted} accounts hydrated, ${errored} errors`);
  console.log(`  Total accounts: ${total}`);
  console.log(`  Hydrated (non-stub): ${hydrated}`);
  console.log(`  With CSM name: ${withCsm}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
