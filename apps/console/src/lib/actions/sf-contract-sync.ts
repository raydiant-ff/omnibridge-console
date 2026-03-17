"use server";

import { prisma, Prisma } from "@omnibridge/db";

/* ── Types for SOQL results ── */

interface SfContractRow {
  Id: string;
  AccountId: string;
  Account?: { Name?: string };
  Status: string;
  StatusCode?: string;
  StartDate?: string;
  EndDate?: string;
  ContractTerm?: number;
  ContractNumber?: string;
  Description?: string;
  OwnerId?: string;
  Owner?: { Name?: string };
  Stripe_Subscription_ID__c?: string;
  Stripe_Customer_ID__c?: string;
  Stripe_Status__c?: string;
  Stripe_Quote__c?: string;
  Stripe_Subscription_Schedule_ID__c?: string;
  Collection_Method__c?: string;
  Contract_MRR__c?: number;
  Contract_ARR__c?: number;
  SBQQ__Opportunity__c?: string;
  SBQQ__Evergreen__c?: boolean;
  DO_NOT_RENEW__c?: boolean;
  SBQQ__RenewalTerm__c?: number;
  Cancellation_Date__c?: string;
  Days_Till_Expiry__c?: number;
  ActivatedDate?: string;
  CustomerSignedDate?: string;
  LastModifiedDate?: string;
}

interface SfContractLineRow {
  Id: string;
  SBQQ__Contract__c: string;
  SBQQ__Account__c?: string;
  SBQQ__Product__c?: string;
  SBQQ__ProductName__c?: string;
  SBQQ__Quantity__c?: number;
  SBQQ__ListPrice__c?: number;
  SBQQ__NetPrice__c?: number;
  SBQQ__StartDate__c?: string;
  SBQQ__EndDate__c?: string;
  Status__c?: string;
  SBQQ__BillingFrequency__c?: string;
  Stripe_Subscription_ID__c?: string; // This is actually the sub item ID on SBQQ__Subscription__c
  Stripe_Price_ID__c?: string;
  Stripe_Product_ID__c?: string;
  Stripe_Subscription_ID_Actual__c?: string; // The real subscription ID
  Stripe_Status__c?: string;
  Monthly_Value__c?: number;
  ARR__c?: number;
  LastModifiedDate?: string;
}

/* ── SOQL Queries ── */

export const CONTRACT_SOQL_FIELDS = `
  Id, AccountId, Account.Name, Status, StatusCode, StartDate, EndDate,
  ContractTerm, ContractNumber, Description, OwnerId, Owner.Name,
  Stripe_Subscription_ID__c, Stripe_Customer_ID__c, Stripe_Status__c,
  Stripe_Quote__c, Stripe_Subscription_Schedule_ID__c, Collection_Method__c,
  Contract_MRR__c, Contract_ARR__c, SBQQ__Opportunity__c, SBQQ__Evergreen__c,
  DO_NOT_RENEW__c, SBQQ__RenewalTerm__c, Cancellation_Date__c,
  Days_Till_Expiry__c, ActivatedDate, CustomerSignedDate, LastModifiedDate
`.replace(/\n/g, " ");

export const CONTRACT_LINE_SOQL_FIELDS = `
  Id, SBQQ__Contract__c, SBQQ__Account__c, SBQQ__Product__c,
  SBQQ__ProductName__c, SBQQ__Quantity__c, SBQQ__ListPrice__c,
  SBQQ__NetPrice__c, SBQQ__StartDate__c, SBQQ__EndDate__c,
  Status__c, SBQQ__BillingFrequency__c,
  Stripe_Subscription_ID__c, Stripe_Price_ID__c, Stripe_Product_ID__c,
  Stripe_Subscription_ID_Actual__c, Stripe_Status__c,
  Monthly_Value__c, ARR__c, LastModifiedDate
`.replace(/\n/g, " ");

/* ── Upsert Functions ── */

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function upsertSfContract(row: SfContractRow) {
  const data: Prisma.SfContractUncheckedCreateInput = {
    id: row.Id,
    accountId: row.AccountId,
    accountName: row.Account?.Name ?? null,
    status: row.Status,
    statusCode: row.StatusCode ?? null,
    startDate: parseDate(row.StartDate),
    endDate: parseDate(row.EndDate),
    contractTerm: row.ContractTerm ?? null,
    contractNumber: row.ContractNumber ?? null,
    description: row.Description ?? null,
    ownerId: row.OwnerId ?? null,
    ownerName: row.Owner?.Name ?? null,
    stripeSubscriptionId: row.Stripe_Subscription_ID__c ?? null,
    stripeCustomerId: row.Stripe_Customer_ID__c ?? null,
    stripeStatus: row.Stripe_Status__c ?? null,
    stripeQuoteSfId: row.Stripe_Quote__c ?? null,
    stripeScheduleId: row.Stripe_Subscription_Schedule_ID__c ?? null,
    collectionMethod: row.Collection_Method__c ?? null,
    mrr: row.Contract_MRR__c ?? null,
    arr: row.Contract_ARR__c ?? null,
    opportunityId: row.SBQQ__Opportunity__c ?? null,
    evergreen: row.SBQQ__Evergreen__c ?? false,
    doNotRenew: row.DO_NOT_RENEW__c ?? false,
    renewalTerm: row.SBQQ__RenewalTerm__c ?? null,
    cancellationDate: parseDate(row.Cancellation_Date__c),
    daysTillExpiry: row.Days_Till_Expiry__c ?? null,
    activatedDate: parseDate(row.ActivatedDate),
    customerSignedDate: parseDate(row.CustomerSignedDate),
    sfLastModified: parseDate(row.LastModifiedDate),
    syncedAt: new Date(),
  };

  await prisma.sfContract.upsert({
    where: { id: row.Id },
    create: data,
    update: { ...data, id: undefined },
  });
}

export async function upsertSfContractLine(row: SfContractLineRow) {
  const data: Prisma.SfContractLineUncheckedCreateInput = {
    id: row.Id,
    contractId: row.SBQQ__Contract__c,
    accountId: row.SBQQ__Account__c ?? null,
    productId: row.SBQQ__Product__c ?? null,
    productName: row.SBQQ__ProductName__c ?? null,
    quantity: row.SBQQ__Quantity__c ?? null,
    listPrice: row.SBQQ__ListPrice__c ?? null,
    netPrice: row.SBQQ__NetPrice__c ?? null,
    startDate: parseDate(row.SBQQ__StartDate__c),
    endDate: parseDate(row.SBQQ__EndDate__c),
    status: row.Status__c ?? null,
    billingFrequency: row.SBQQ__BillingFrequency__c ?? null,
    stripeSubItemId: row.Stripe_Subscription_ID__c ?? null,
    stripePriceId: row.Stripe_Price_ID__c ?? null,
    stripeProductId: row.Stripe_Product_ID__c ?? null,
    stripeSubscriptionId: row.Stripe_Subscription_ID_Actual__c ?? null,
    stripeStatus: row.Stripe_Status__c ?? null,
    mrr: row.Monthly_Value__c ?? null,
    arr: row.ARR__c ?? null,
    sfLastModified: parseDate(row.LastModifiedDate),
    syncedAt: new Date(),
  };

  await prisma.sfContractLine.upsert({
    where: { id: row.Id },
    create: data,
    update: { ...data, id: undefined },
  });
}
