import jwt from "jsonwebtoken";

interface SalesforceTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  scope: string;
}

let cachedToken: { accessToken: string; instanceUrl: string; expiresAt: number } | null = null;

function getPrivateKey(): string {
  const base64 = process.env.SF_PRIVATE_KEY_BASE64;
  if (!base64) throw new Error("SF_PRIVATE_KEY_BASE64 is not set");
  return Buffer.from(base64, "base64").toString("utf-8");
}

export async function getAccessToken(): Promise<{ accessToken: string; instanceUrl: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { accessToken: cachedToken.accessToken, instanceUrl: cachedToken.instanceUrl };
  }

  const loginUrl = process.env.SF_LOGIN_URL ?? "https://login.salesforce.com";
  const clientId = process.env.SF_CLIENT_ID;
  const username = process.env.SF_USERNAME;
  const audience = process.env.SF_JWT_AUDIENCE ?? loginUrl;

  if (!clientId || !username) {
    throw new Error("SF_CLIENT_ID and SF_USERNAME must be set");
  }

  const privateKey = getPrivateKey();
  const assertion = jwt.sign(
    { iss: clientId, sub: username, aud: audience },
    privateKey,
    { algorithm: "RS256", expiresIn: "3m" },
  );

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce token error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as SalesforceTokenResponse;
  cachedToken = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + 90 * 60 * 1000,
  };

  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

export async function soql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SOQL error: ${response.status} ${text}`);
  }

  const result = (await response.json()) as { records: T[] };
  return result.records;
}

export async function getAccount(accountId: string) {
  const records = await soql(
    `SELECT Id, Name, Website, BillingCity, BillingState, BillingCountry, Industry, Type FROM Account WHERE Id = '${accountId}' LIMIT 1`,
  );
  return records[0] ?? null;
}

export async function searchAccounts(term: string) {
  return soql(
    `SELECT Id, Name, Website, Industry FROM Account WHERE Name LIKE '%${term}%' ORDER BY Name LIMIT 25`,
  );
}
