import { getAccessToken } from "../packages/integrations/salesforce/src/index.ts";

const FF_CSM = "0058W00000FtNrxQAF";

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

interface Account {
  Id: string;
  Name: string;
  Status_Calculated__c: string | null;
  Owner: { Name: string } | null;
  Total_ARR__c: number | null;
  Account_Value__c: number | null;
}

async function main() {
  const { accessToken, instanceUrl } = await getAccessToken();

  const all: Account[] = [];
  let result = await rawQuery(
    `SELECT Id, Name, Status_Calculated__c, Owner.Name, Total_ARR__c, Account_Value__c ` +
      `FROM Account ` +
      `WHERE Status_Calculated__c = 'Active Customer' AND Account_Team_CSM__c = '${FF_CSM}' ` +
      `ORDER BY Name`,
    instanceUrl,
    accessToken,
  );
  all.push(...result.records);

  while (!result.done && result.nextRecordsUrl) {
    result = await queryMore(result.nextRecordsUrl, instanceUrl, accessToken);
    all.push(...result.records);
  }

  process.stderr.write(`Total Active Customer accounts for Francisco Fiedler: ${all.length}\n`);

  process.stdout.write("Id,Account Name,Status,Owner,ARR,Account Value\n");
  for (const a of all) {
    const name = (a.Name ?? "").replace(/"/g, '""');
    const owner = (a.Owner?.Name ?? "").replace(/"/g, '""');
    const arr = a.Total_ARR__c != null ? a.Total_ARR__c.toFixed(2) : "";
    const val = a.Account_Value__c != null ? a.Account_Value__c.toFixed(2) : "";
    process.stdout.write(`${a.Id},"${name}",${a.Status_Calculated__c ?? ""},"${owner}",${arr},${val}\n`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
