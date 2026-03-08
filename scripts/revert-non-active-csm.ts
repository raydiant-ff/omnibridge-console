import { getAccessToken } from "../packages/integrations/salesforce/src/index.ts";

const OLD_CSM = "0058W00000FtkJyQAJ";
const NEW_CSM = "0058W00000FtNrxQAF";
const BATCH_SIZE = 200;

async function rawQuery(query: string, instanceUrl: string, accessToken: string) {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`${instanceUrl}/services/data/v60.0/query?q=${encoded}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`SOQL error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function queryMore(nextUrl: string, instanceUrl: string, accessToken: string) {
  const res = await fetch(`${instanceUrl}${nextUrl}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

async function main() {
  const { accessToken, instanceUrl } = await getAccessToken();

  console.log(`Querying non-Active Customer accounts currently assigned to ${NEW_CSM} that need reverting...`);
  const accountIds: string[] = [];
  let result = await rawQuery(
    `SELECT Id FROM Account WHERE Account_Team_CSM__c = '${NEW_CSM}' AND Status_Calculated__c != 'Active Customer'`,
    instanceUrl,
    accessToken,
  );
  accountIds.push(...result.records.map((r: { Id: string }) => r.Id));

  while (!result.done && result.nextRecordsUrl) {
    result = await queryMore(result.nextRecordsUrl, instanceUrl, accessToken);
    accountIds.push(...result.records.map((r: { Id: string }) => r.Id));
  }

  console.log(`Found ${accountIds.length} non-Active Customer accounts to revert back to ${OLD_CSM}.\n`);

  if (accountIds.length === 0) {
    console.log("Nothing to revert.");
    return;
  }

  let success = 0;
  let failed = 0;
  const failures: { id: string; errors: unknown }[] = [];

  for (let i = 0; i < accountIds.length; i += BATCH_SIZE) {
    const batch = accountIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(accountIds.length / BATCH_SIZE);

    const compositeRequest = {
      allOrNone: false,
      records: batch.map((id) => ({
        attributes: { type: "Account" },
        id,
        Account_Team_CSM__c: OLD_CSM,
      })),
    };

    const res = await fetch(
      `${instanceUrl}/services/data/v60.0/composite/sobjects`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(compositeRequest),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Batch ${batchNum}/${totalBatches} FAILED (HTTP ${res.status}): ${text}`);
      failed += batch.length;
      continue;
    }

    const results: { id: string; success: boolean; errors: unknown[] }[] =
      await res.json();

    let batchSuccess = 0;
    let batchFailed = 0;
    for (const r of results) {
      if (r.success) {
        batchSuccess++;
      } else {
        batchFailed++;
        failures.push({ id: r.id, errors: r.errors });
      }
    }

    success += batchSuccess;
    failed += batchFailed;
    console.log(
      `Batch ${batchNum}/${totalBatches}: ${batchSuccess} ok, ${batchFailed} failed (running total: ${success} ok, ${failed} failed)`,
    );
  }

  console.log(`\n=== DONE ===`);
  console.log(`Reverted: ${success}`);
  console.log(`Failed: ${failed}`);

  if (failures.length > 0) {
    console.log(`\nFailed records:`);
    for (const f of failures) {
      console.log(`  ${f.id}: ${JSON.stringify(f.errors)}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
