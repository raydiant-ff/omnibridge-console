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
    signal: AbortSignal.timeout(8000),
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
  const encoded = encodeURIComponent(query);

  const usePost = encoded.length > 4000;
  const response = usePost
    ? await fetch(`${instanceUrl}/services/data/v60.0/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `q=${encoded}`,
        signal: AbortSignal.timeout(15000),
      })
    : await fetch(`${instanceUrl}/services/data/v60.0/query?q=${encoded}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SOQL error: ${response.status} ${text}`);
  }

  const result = (await response.json()) as { records: T[] };
  return result.records;
}

export function escapeSoql(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export async function getAccount(accountId: string) {
  const records = await soql(
    `SELECT Id, Name, Website, BillingCity, BillingState, BillingCountry, Industry, Type FROM Account WHERE Id = '${escapeSoql(accountId)}' LIMIT 1`,
  );
  return records[0] ?? null;
}

export async function searchAccounts(term: string) {
  return soql(
    `SELECT Id, Name, Website, Industry FROM Account WHERE Name LIKE '%${escapeSoql(term)}%' ORDER BY Name LIMIT 25`,
  );
}

export interface CreateOpportunityInput {
  Name: string;
  AccountId: string;
  StageName: string;
  CloseDate: string;
  Amount?: number;
  RecordTypeId?: string;
}

interface SObjectCreateResult {
  id: string;
  success: boolean;
  errors: { message: string; statusCode: string }[];
}

export async function createOpportunity(
  data: CreateOpportunityInput,
): Promise<SObjectCreateResult> {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/v60.0/sobjects/Opportunity`;

  const body: Record<string, unknown> = {
    Name: data.Name,
    AccountId: data.AccountId,
    StageName: data.StageName,
    CloseDate: data.CloseDate,
  };
  if (data.Amount !== undefined) body.Amount = data.Amount;
  if (data.RecordTypeId) body.RecordTypeId = data.RecordTypeId;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce create Opportunity error: ${response.status} ${text}`);
  }

  return (await response.json()) as SObjectCreateResult;
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  CloseDate: string;
  CreatedDate: string;
  Amount: number | null;
  Type: string | null;
  LastModifiedDate: string;
  Account: { Id: string; Name: string } | null;
  Owner: { Name: string } | null;
}

export async function getOpportunitiesByOwnerEmail(
  email: string,
): Promise<SalesforceOpportunity[]> {
  return soql<SalesforceOpportunity>(
    `SELECT Id, Name, StageName, CloseDate, CreatedDate, Amount, Type, LastModifiedDate, Account.Id, Account.Name, Owner.Name ` +
      `FROM Opportunity ` +
      `WHERE Owner.Email = '${escapeSoql(email)}' ` +
      `AND IsClosed = false ` +
      `ORDER BY LastModifiedDate DESC ` +
      `LIMIT 50`,
  );
}

export async function getAllOpportunities(): Promise<SalesforceOpportunity[]> {
  return soql<SalesforceOpportunity>(
    `SELECT Id, Name, StageName, CloseDate, CreatedDate, Amount, Type, LastModifiedDate, Account.Id, Account.Name, Owner.Name ` +
      `FROM Opportunity ` +
      `WHERE IsClosed = false ` +
      `ORDER BY LastModifiedDate DESC ` +
      `LIMIT 200`,
  );
}

export async function getOpportunitiesForDashboard(
  yearStart: string,
): Promise<SalesforceOpportunity[]> {
  return soql<SalesforceOpportunity>(
    `SELECT Id, Name, StageName, CloseDate, CreatedDate, Amount, Type, LastModifiedDate, Account.Id, Account.Name, Owner.Name ` +
      `FROM Opportunity ` +
      `WHERE CreatedDate >= ${yearStart}T00:00:00Z OR CloseDate >= ${yearStart} ` +
      `ORDER BY CloseDate ASC ` +
      `LIMIT 2000`,
  );
}

export interface SalesforceAccountByCsm {
  Id: string;
  Name: string;
  Website: string | null;
  Industry: string | null;
  BillingCity: string | null;
  BillingState: string | null;
  Type: string | null;
  Stripe_Customer_ID__c: string | null;
  Date_of_First_Closed_Won__c: string | null;
  Owner: { Name: string } | null;
  Account_Team_CSM__r: { Name: string } | null;
  Status_Calculated__c: string | null;
  Account_Value__c: number | null;
  Total_ARR__c: number | null;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const records = await soql<{ Id: string }>(
    `SELECT Id FROM User WHERE Email = '${escapeSoql(email)}' AND IsActive = true LIMIT 1`,
  );
  return records[0]?.Id ?? null;
}

export async function getAccountsByCsm(csmUserId: string): Promise<SalesforceAccountByCsm[]> {
  return soql<SalesforceAccountByCsm>(
    `SELECT Id, Name, Website, Industry, BillingCity, BillingState, Type, Stripe_Customer_ID__c, ` +
      `Date_of_First_Closed_Won__c, Owner.Name, Account_Team_CSM__r.Name, ` +
      `Status_Calculated__c, Account_Value__c, Total_ARR__c ` +
      `FROM Account ` +
      `WHERE Account_Team_CSM__c = '${escapeSoql(csmUserId)}' ` +
      `ORDER BY Name ` +
      `LIMIT 200`,
  );
}

export async function getAllAccounts(): Promise<SalesforceAccountByCsm[]> {
  return soql<SalesforceAccountByCsm>(
    `SELECT Id, Name, Website, Industry, BillingCity, BillingState, Type, Stripe_Customer_ID__c, ` +
      `Date_of_First_Closed_Won__c, Owner.Name, Account_Team_CSM__r.Name, ` +
      `Status_Calculated__c, Account_Value__c, Total_ARR__c ` +
      `FROM Account ` +
      `ORDER BY Name ` +
      `LIMIT 2000`,
  );
}

export interface SalesforceAccountDetail {
  Id: string;
  Name: string;
  Website: string | null;
  Industry: string | null;
  Type: string | null;
  Stripe_Customer_ID__c: string | null;
  Date_of_First_Closed_Won__c: string | null;
  Account_Value__c: number | null;
  Total_ARR__c: number | null;
  Lifetime_Value_SFBilling_and_stripe__c: number | null;
  Outstanding_AR__c: number | null;
  AR_Status__c: string | null;
  F52_Primary_Contact__r: { Name: string } | null;
  Primary_Contact_Email__c: string | null;
  Dashboard_Email__c: string | null;
  blng__BillToContact__r: { Name: string } | null;
  Bill_To_Email__c: string | null;
  ShippingStreet: string | null;
  ShippingCity: string | null;
  ShippingState: string | null;
  ShippingPostalCode: string | null;
  ShippingCountry: string | null;
  BillingStreet: string | null;
  BillingCity: string | null;
  BillingState: string | null;
  BillingPostalCode: string | null;
  BillingCountry: string | null;
  Account_notes__c: string | null;
  Churn_Details__c: string | null;
  AR_Notes__c: string | null;
  Latest_Health_Update_text__c: string | null;
}

export async function getAccountDetail(accountId: string): Promise<SalesforceAccountDetail | null> {
  const records = await soql<SalesforceAccountDetail>(
    `SELECT Id, Name, Website, Industry, Type, Stripe_Customer_ID__c, ` +
      `Date_of_First_Closed_Won__c, Account_Value__c, Total_ARR__c, ` +
      `Lifetime_Value_SFBilling_and_stripe__c, ` +
      `Outstanding_AR__c, AR_Status__c, ` +
      `F52_Primary_Contact__r.Name, Primary_Contact_Email__c, ` +
      `Dashboard_Email__c, blng__BillToContact__r.Name, Bill_To_Email__c, ` +
      `ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry, ` +
      `BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, ` +
      `Account_notes__c, Churn_Details__c, AR_Notes__c, Latest_Health_Update_text__c ` +
      `FROM Account WHERE Id = '${escapeSoql(accountId)}' LIMIT 1`,
  );
  return records[0] ?? null;
}

export interface SalesforceProduct {
  Id: string;
  Name: string;
  ProductCode: string | null;
  Description: string | null;
  IsActive: boolean;
  Family: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
  Stripe_Product_ID__c: string | null;
  Stripe_Price_ID__c: string | null;
  LastModifiedBy: { Name: string } | null;
}

export interface SalesforcePricebookEntry {
  Id: string;
  Product2Id: string;
  UnitPrice: number;
  IsActive: boolean;
  Pricebook2: { Id: string; Name: string };
  CurrencyIsoCode?: string;
}

export async function getProducts(): Promise<SalesforceProduct[]> {
  return soql<SalesforceProduct>(
    `SELECT Id, Name, ProductCode, Description, IsActive, Family, CreatedDate, LastModifiedDate, ` +
      `Stripe_Product_ID__c, Stripe_Price_ID__c, LastModifiedBy.Name ` +
      `FROM Product2 ` +
      `ORDER BY Family NULLS LAST, Name ` +
      `LIMIT 2000`,
  );
}

export async function getAllPricebookEntries(): Promise<SalesforcePricebookEntry[]> {
  return soql<SalesforcePricebookEntry>(
    `SELECT Id, Product2Id, UnitPrice, IsActive, Pricebook2.Id, Pricebook2.Name ` +
      `FROM PricebookEntry ` +
      `ORDER BY Product2Id, UnitPrice ` +
      `LIMIT 2000`,
  );
}

export async function createSObject(
  objectType: string,
  data: Record<string, unknown>,
): Promise<SObjectCreateResult> {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/v60.0/sobjects/${objectType}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SF create ${objectType}: ${response.status} ${text}`);
  }

  return (await response.json()) as SObjectCreateResult;
}

export async function updateSObject(
  objectType: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { accessToken, instanceUrl } = await getAccessToken();
  const url = `${instanceUrl}/services/data/v60.0/sobjects/${objectType}/${id}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SF update ${objectType}/${id}: ${response.status} ${text}`);
  }
}
