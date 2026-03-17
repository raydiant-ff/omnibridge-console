/**
 * Backfill script: Salesforce contacts → local mirror table.
 *
 * Fetches contacts for all SfAccount records in the DB and upserts them.
 *
 * Usage:
 *   export $(grep -v '^#' apps/console/.env.local | grep -v '^$' | xargs)
 *   npx tsx scripts/backfill-sf-contacts.ts
 *
 * Requires: DATABASE_URL and Salesforce env vars.
 */

import { soql, escapeSoql } from "../packages/integrations/salesforce/src/index.ts";
import { PrismaClient } from "../packages/db/generated/client/index.js";

const prisma = new PrismaClient();

interface SfContactRow {
  Id: string;
  AccountId: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Title?: string;
  Department?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingCountry?: string;
  LastModifiedDate?: string;
}

interface SfAccountBillTo {
  Id: string;
  blng__BillToContact__c?: string;
}

const CONTACT_FIELDS = `
  Id, AccountId, FirstName, LastName, Email, Phone, MobilePhone,
  Title, Department, MailingCity, MailingState, MailingCountry,
  LastModifiedDate
`.replace(/\n/g, " ");

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  // 1. Get all account IDs from the mirror
  const accounts = await prisma.sfAccount.findMany({
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  console.log(`Found ${accountIds.length} accounts in mirror`);

  if (accountIds.length === 0) {
    console.log("No accounts to process");
    await prisma.$disconnect();
    return;
  }

  // 2. Fetch BillTo contact IDs per account (chunked)
  const CHUNK = 150;
  const billToMap = new Map<string, string>(); // accountId → billToContactId

  console.log("Fetching BillTo contact mappings...");
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    const idList = chunk.map((id) => `'${escapeSoql(id)}'`).join(",");

    try {
      const rows = await soql<SfAccountBillTo>(
        `SELECT Id, blng__BillToContact__c FROM Account WHERE Id IN (${idList}) AND blng__BillToContact__c != null`,
      );
      for (const r of rows) {
        if (r.blng__BillToContact__c) {
          billToMap.set(r.Id, r.blng__BillToContact__c);
        }
      }
    } catch {
      // blng__BillToContact__c may not exist in all orgs
    }
  }
  console.log(`  ${billToMap.size} accounts have BillTo contacts`);

  // 3. Fetch and upsert contacts in chunks
  let fetched = 0;
  let upserted = 0;
  let errored = 0;

  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const chunk = accountIds.slice(i, i + CHUNK);
    const idList = chunk.map((id) => `'${escapeSoql(id)}'`).join(",");

    let records: SfContactRow[];
    try {
      records = await soql<SfContactRow>(
        `SELECT ${CONTACT_FIELDS} FROM Contact WHERE AccountId IN (${idList})`,
      );
    } catch (err) {
      console.error(
        `  SOQL error on chunk ${i}-${i + chunk.length}:`,
        (err as Error).message,
      );
      errored += chunk.length;
      continue;
    }

    fetched += records.length;

    for (const r of records) {
      try {
        const isBillTo = billToMap.get(r.AccountId) === r.Id;

        const data = {
          id: r.Id,
          accountId: r.AccountId,
          firstName: r.FirstName ?? null,
          lastName: r.LastName,
          email: r.Email ?? null,
          phone: r.Phone ?? null,
          mobilePhone: r.MobilePhone ?? null,
          title: r.Title ?? null,
          department: r.Department ?? null,
          mailingCity: r.MailingCity ?? null,
          mailingState: r.MailingState ?? null,
          mailingCountry: r.MailingCountry ?? null,
          isBillTo,
          isPrimary: false,
          sfLastModified: parseDate(r.LastModifiedDate),
          syncedAt: new Date(),
        };

        await prisma.sfContact.upsert({
          where: { id: r.Id },
          create: data,
          update: { ...data, id: undefined },
        });
        upserted++;
      } catch (err) {
        errored++;
        if (errored <= 5) {
          console.error(
            `  Error on contact ${r.Id}:`,
            (err as Error).message,
          );
        }
      }
    }

    const progress = Math.min(i + CHUNK, accountIds.length);
    console.log(
      `  Progress: ${progress}/${accountIds.length} accounts (${fetched} fetched, ${upserted} upserted, ${errored} errors)`,
    );
  }

  console.log(`\nDone: ${upserted} contacts upserted, ${errored} errors`);

  const total = await prisma.sfContact.count();
  const withEmail = await prisma.sfContact.count({
    where: { email: { not: null } },
  });
  const billTos = await prisma.sfContact.count({ where: { isBillTo: true } });

  console.log(`  Total contacts: ${total}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Bill-to: ${billTos}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
