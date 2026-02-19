"use server";

import { flags } from "@/lib/feature-flags";
import { getMockSalesforceData, type MockSalesforceData } from "@/lib/mock-data";

export async function getSalesforceDataForCustomer(sfAccountId: string | null): Promise<MockSalesforceData | null> {
  if (!sfAccountId) return null;

  if (flags.useMockSalesforce) {
    return getMockSalesforceData(sfAccountId);
  }

  const { soql } = await import("@omnibridge/salesforce");

  const [accounts, contacts, opportunities] = await Promise.all([
    soql<Record<string, unknown>>(
      `SELECT Id, Name, Website, Industry, Type, BillingCity, BillingState, BillingCountry, Phone, AnnualRevenue FROM Account WHERE Id = '${sfAccountId}' LIMIT 1`,
    ),
    soql<Record<string, unknown>>(
      `SELECT Id, Name, Email, Title, Phone FROM Contact WHERE AccountId = '${sfAccountId}' ORDER BY Name LIMIT 25`,
    ),
    soql<Record<string, unknown>>(
      `SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE AccountId = '${sfAccountId}' ORDER BY CloseDate DESC LIMIT 25`,
    ),
  ]);

  const account = accounts[0];
  if (!account) return null;

  return {
    account: {
      Id: String(account.Id ?? ""),
      Name: String(account.Name ?? ""),
      Website: account.Website ? String(account.Website) : null,
      Industry: account.Industry ? String(account.Industry) : null,
      Type: account.Type ? String(account.Type) : null,
      BillingCity: account.BillingCity ? String(account.BillingCity) : null,
      BillingState: account.BillingState ? String(account.BillingState) : null,
      BillingCountry: account.BillingCountry ? String(account.BillingCountry) : null,
      Phone: account.Phone ? String(account.Phone) : null,
      AnnualRevenue: account.AnnualRevenue ? Number(account.AnnualRevenue) : null,
    },
    contacts: contacts.map((c) => ({
      Id: String(c.Id ?? ""),
      Name: String(c.Name ?? ""),
      Email: String(c.Email ?? ""),
      Title: c.Title ? String(c.Title) : null,
      Phone: c.Phone ? String(c.Phone) : null,
    })),
    opportunities: opportunities.map((o) => ({
      Id: String(o.Id ?? ""),
      Name: String(o.Name ?? ""),
      StageName: String(o.StageName ?? ""),
      Amount: o.Amount ? Number(o.Amount) : null,
      CloseDate: String(o.CloseDate ?? ""),
    })),
  };
}
