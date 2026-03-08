"use server";

import { flags } from "@/lib/feature-flags";
import {
  contractTermMonths,
  computeContractEndDate,
  convertPriceToFrequency,
  BILLING_FREQUENCY_LABELS,
} from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "./quotes";

export interface SfQuoteMirrorInput {
  opportunityId: string;
  sfAccountId: string;
  stripeQuoteId: string;
  stripeCustomerId: string;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue?: number;
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate?: string;
  totalAmount: number;
  listAmount: number;
  currency: string;
  expiresAt: Date;
  lineItems: QuoteLineItem[];
  creatorName: string;
}

export interface SfQuoteMirrorResult {
  sfQuoteId: string | null;
  sfQuoteNumber: string | null;
  sfQuoteLineIds: string[];
  error?: string;
}

function resolveProductMappings(
  lineItems: QuoteLineItem[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const li of lineItems) {
    if (li.sfProductId) {
      map.set(li.productId, li.sfProductId);
    }
  }
  return map;
}

export async function createSfQuoteMirror(
  input: SfQuoteMirrorInput,
  dryRun: boolean,
): Promise<{ result: SfQuoteMirrorResult; log: string[] }> {
  const log: string[] = [];

  if (flags.useMockSalesforce) {
    const mockId = `a0mock${Date.now().toString(36)}`;
    log.push(`[MOCK] Would create Stripe_Quote__c → ${mockId}`);
    log.push(
      `[MOCK] Would create ${input.lineItems.length} Stripe_Quote_Line__c records`,
    );
    return {
      result: { sfQuoteId: mockId, sfQuoteNumber: null, sfQuoteLineIds: [] },
      log,
    };
  }

  const { createSObject } = await import("@omnibridge/salesforce");

  const productMap = resolveProductMappings(input.lineItems);

  const missingProducts = input.lineItems.filter(
    (li) => !productMap.has(li.productId),
  );
  if (missingProducts.length > 0) {
    log.push(
      `[WARN] No SF Product2 mapping for: ${missingProducts.map((p) => `${p.productName} (${p.productId})`).join(", ")}`,
    );
  }

  const expirationDate = input.expiresAt.toISOString().split("T")[0];
  const startDate = input.effectiveDate
    ? new Date(input.effectiveDate).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const contractStart = input.effectiveDate
    ? new Date(input.effectiveDate)
    : new Date();
  const contractEnd = computeContractEndDate(contractStart, input.contractTerm);
  const endDate = contractEnd.toISOString().split("T")[0];

  const paymentTerms =
    input.collectionMethod === "send_invoice"
      ? input.daysUntilDue === 0
        ? "Due on receipt"
        : `Net ${input.daysUntilDue ?? 30}`
      : "Due on receipt";

  const quoteFields: Record<string, unknown> = {
    Opportunity__c: input.opportunityId,
    Account__c: input.sfAccountId,
    Status__c: "Draft",
    Expiration_Date__c: expirationDate,
    Start_Date__c: startDate,
    End_Date__c: endDate,
    Subscription_Term__c: contractTermMonths(input.contractTerm),
    Billing_Frequency__c: BILLING_FREQUENCY_LABELS[input.billingFrequency],
    Payment_Terms__c: paymentTerms,
    Net_Amount__c: input.totalAmount / 100,
    List_Amount__c: input.listAmount / 100,
    Notes__c: `Displai Omni quote — Stripe ID: ${input.stripeQuoteId}`,
    Stripe_Customer_ID__c: input.stripeCustomerId,
    Stripe_Quote_ID__c: input.stripeQuoteId,
    Creator__c: input.creatorName,
    Collection_Method__c: input.collectionMethod,
    Currency_ISO__c: input.currency,
  };

  log.push(
    `[SF] Create Stripe_Quote__c: ${JSON.stringify(quoteFields, null, 2)}`,
  );

  if (dryRun) {
    const lineLog = input.lineItems.map((li, idx) => {
      const sfProd = productMap.get(li.productId);
      const oneTime =
        !li.interval || li.interval === "one-time" || li.interval === "one_time";
      const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;
      const listConverted = oneTime
        ? li.unitAmount
        : convertPriceToFrequency(li.unitAmount, li.interval, input.billingFrequency);
      const netConverted = oneTime
        ? effectiveUnit
        : convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency);
      const hasDiscount = effectiveUnit !== li.unitAmount;
      return `  Line ${idx + 1}: ${li.productName} | qty=${li.quantity} | list=${listConverted / 100}/${oneTime ? "one-time" : BILLING_FREQUENCY_LABELS[input.billingFrequency].toLowerCase()} | net=${netConverted / 100}×${li.quantity}=${(netConverted * li.quantity) / 100}${hasDiscount ? " [DISCOUNT]" : ""} | SF Product=${sfProd ?? "MISSING"}`;
    });
    log.push(`[SF] Would create ${input.lineItems.length} quote lines:`);
    log.push(...lineLog);
    return { result: { sfQuoteId: null, sfQuoteNumber: null, sfQuoteLineIds: [] }, log };
  }

  let sfQuoteId: string;
  let sfQuoteNumber: string | null = null;
  try {
    const createResult = await createSObject(
      "Stripe_Quote__c",
      quoteFields,
    );
    sfQuoteId = createResult.id;
    log.push(`[SF] Created Stripe_Quote__c: ${sfQuoteId}`);

    try {
      const { soql } = await import("@omnibridge/salesforce");
      const [sfQuote] = await soql<{ Name: string }>(
        `SELECT Name FROM Stripe_Quote__c WHERE Id = '${sfQuoteId}' LIMIT 1`,
      );
      if (sfQuote) {
        sfQuoteNumber = sfQuote.Name;
        log.push(`[SF] Quote number: ${sfQuoteNumber}`);
      }
    } catch {
      log.push(`[SF] WARN: Could not retrieve quote number`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`[SF] ERROR creating quote: ${msg}`);
    return { result: { sfQuoteId: null, sfQuoteNumber: null, sfQuoteLineIds: [] }, log };
  }

  const sfQuoteLineIds: string[] = [];
  for (let i = 0; i < input.lineItems.length; i++) {
    const li = input.lineItems[i]!;
    const sfProductId = productMap.get(li.productId);
    if (!sfProductId) {
      log.push(
        `[SF] SKIP line ${i + 1} (${li.productName}): no SF Product2 mapping`,
      );
      continue;
    }

    const oneTime =
      !li.interval || li.interval === "one-time" || li.interval === "one_time";
    const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;
    const listConverted = oneTime
      ? li.unitAmount
      : convertPriceToFrequency(li.unitAmount, li.interval, input.billingFrequency);
    const netConverted = oneTime
      ? effectiveUnit
      : convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency);

    const lineFields: Record<string, unknown> = {
      Stripe_Quote__c: sfQuoteId,
      Product__c: sfProductId,
      Quantity__c: li.quantity,
      List_Price__c: listConverted / 100,
      Net_Price__c: (netConverted * li.quantity) / 100,
      Description__c: li.nickname,
      Line_Number__c: i + 1,
      Stripe_Price_ID__c: li.priceId,
    };

    try {
      const lineResult = await createSObject(
        "Stripe_Quote_Line__c",
        lineFields,
      );
      sfQuoteLineIds.push(lineResult.id);
      log.push(
        `[SF] Created Stripe Quote Line ${i + 1}: ${lineResult.id} (${li.productName})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push(`[SF] ERROR creating line ${i + 1} (${li.productName}): ${msg}`);
    }
  }

  return { result: { sfQuoteId, sfQuoteNumber, sfQuoteLineIds }, log };
}

export async function updateSfQuoteStatus(
  sfQuoteId: string,
  status: string,
  dryRun: boolean,
): Promise<string[]> {
  const log: string[] = [];

  if (flags.useMockSalesforce || dryRun) {
    log.push(
      `[${dryRun ? "DRY RUN" : "MOCK"}] Would update Stripe_Quote__c ${sfQuoteId} → Status: ${status}`,
    );
    return log;
  }

  const { updateSObject } = await import("@omnibridge/salesforce");
  try {
    await updateSObject("Stripe_Quote__c", sfQuoteId, {
      Status__c: status,
    });
    log.push(`[SF] Updated Stripe_Quote__c ${sfQuoteId} → ${status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`[SF] ERROR updating quote status: ${msg}`);
  }
  return log;
}

export async function closeOpportunityWon(
  opportunityId: string,
  amount: number,
  dryRun: boolean,
): Promise<string[]> {
  const log: string[] = [];

  if (flags.useMockSalesforce || dryRun) {
    log.push(
      `[${dryRun ? "DRY RUN" : "MOCK"}] Would update Opportunity ${opportunityId} → StageName: Closed Won, Amount: ${amount / 100}`,
    );
    return log;
  }

  const { updateSObject } = await import("@omnibridge/salesforce");
  try {
    await updateSObject("Opportunity", opportunityId, {
      StageName: "Closed Won",
      Amount: amount / 100,
      CloseDate: new Date().toISOString().split("T")[0],
    });
    log.push(
      `[SF] Opportunity ${opportunityId} → Closed Won (amount: ${amount / 100})`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`[SF] ERROR closing opportunity: ${msg}`);
  }
  return log;
}

export interface SfContractInput {
  sfAccountId: string;
  sfQuoteId: string;
  stripeQuoteId: string;
  stripeSubscriptionId: string;
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate?: string;
  collectionMethod: string;
  opportunityId?: string;
  customerSignedDate?: Date;
  customerSignedContactId?: string;
}

export async function createSfContractFromQuote(
  input: SfContractInput,
  dryRun: boolean,
): Promise<{ contractId: string | null; log: string[] }> {
  const log: string[] = [];

  if (flags.useMockSalesforce || dryRun) {
    const mockId = dryRun ? null : `800mock${Date.now().toString(36)}`;
    log.push(
      `[${dryRun ? "DRY RUN" : "MOCK"}] Would create Contract for Stripe sub ${input.stripeSubscriptionId}`,
    );
    return { contractId: mockId, log };
  }

  const { createSObject, updateSObject } = await import("@omnibridge/salesforce");

  const contractStart = input.effectiveDate
    ? new Date(input.effectiveDate)
    : new Date();
  const contractEnd = computeContractEndDate(contractStart, input.contractTerm);
  const termMonths = contractTermMonths(input.contractTerm);

  const contractFields: Record<string, unknown> = {
    AccountId: input.sfAccountId,
    Status: "Draft",
    StartDate: contractStart.toISOString().split("T")[0],
    EndDate: contractEnd.toISOString().split("T")[0],
    ContractTerm: termMonths,
    Stripe_ID__c: input.stripeSubscriptionId,
    Stripe_Quote__c: input.sfQuoteId || undefined,
    Description: `Displai Omni Contract — Stripe Quote ${input.stripeQuoteId} — ${input.contractTerm} term, ${BILLING_FREQUENCY_LABELS[input.billingFrequency]} billing`,
    ...(input.opportunityId ? { SBQQ__Opportunity__c: input.opportunityId } : {}),
    ...(input.customerSignedDate ? { CustomerSignedDate: input.customerSignedDate.toISOString().split("T")[0] } : {}),
    ...(input.customerSignedContactId ? { CustomerSignedId: input.customerSignedContactId } : {}),
  };

  log.push(`[SF] Create Contract: ${JSON.stringify(contractFields, null, 2)}`);

  try {
    const result = await createSObject("Contract", contractFields);
    log.push(`[SF] Created Contract: ${result.id}`);

    if (input.sfQuoteId) {
      try {
        await updateSObject("Stripe_Quote__c", input.sfQuoteId, {
          Contract__c: result.id,
        });
        log.push(`[SF] Linked Stripe_Quote__c ${input.sfQuoteId} → Contract ${result.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`[SF] WARN: Could not link quote to contract: ${msg}`);
      }
    }

    return { contractId: result.id, log };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`[SF] ERROR creating contract: ${msg}`);
    return { contractId: null, log };
  }
}

export interface SfSubscriptionInput {
  contractId: string;
  sfAccountId: string;
  sfQuoteId?: string;
  sfQuoteLineIds?: string[];
  billingFrequency: BillingFrequency;
  contractTerm: ContractTerm;
  effectiveDate?: string;
  lineItems: QuoteLineItem[];
  stripeSubItemIds?: string[];
}

export async function createSfSubscriptionsFromQuote(
  input: SfSubscriptionInput,
  dryRun: boolean,
): Promise<{ subscriptionIds: string[]; log: string[] }> {
  const log: string[] = [];

  if (flags.useMockSalesforce || dryRun) {
    log.push(
      `[${dryRun ? "DRY RUN" : "MOCK"}] Would create ${input.lineItems.length} SBQQ__Subscription__c records under Contract ${input.contractId}`,
    );
    for (let i = 0; i < input.lineItems.length; i++) {
      const li = input.lineItems[i]!;
      const stripeItemId = input.stripeSubItemIds?.[i] ?? "N/A";
      log.push(`  Sub ${i + 1}: ${li.productName} | qty=${li.quantity} | Stripe Item=${stripeItemId} | SF Product=${li.sfProductId ?? "MISSING"}`);
    }
    return { subscriptionIds: [], log };
  }

  const { createSObject } = await import("@omnibridge/salesforce");

  const subscriptionIds: string[] = [];
  for (let i = 0; i < input.lineItems.length; i++) {
    const li = input.lineItems[i]!;
    const sfProductId = li.sfProductId;
    if (!sfProductId) {
      log.push(`[SF] SKIP subscription ${i + 1} (${li.productName}): no SF Product2 mapping`);
      continue;
    }

    const oneTime = !li.interval || li.interval === "one-time" || li.interval === "one_time";
    const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;
    const listConverted = oneTime
      ? li.unitAmount
      : convertPriceToFrequency(li.unitAmount, li.interval, input.billingFrequency);
    const netConverted = oneTime
      ? effectiveUnit
      : convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency);

    // Calculate subscription dates
    const contractStart = input.effectiveDate
      ? new Date(input.effectiveDate)
      : new Date();
    const contractEnd = computeContractEndDate(contractStart, input.contractTerm);

    const subFields: Record<string, unknown> = {
      SBQQ__Contract__c: input.contractId,
      SBQQ__Account__c: input.sfAccountId,
      SBQQ__Product__c: sfProductId,
      SBQQ__Quantity__c: li.quantity,
      SBQQ__ListPrice__c: listConverted / 100,
      SBQQ__NetPrice__c: (netConverted * li.quantity) / 100,
      SBQQ__ProductName__c: li.productName,
      SBQQ__StartDate__c: contractStart.toISOString().split("T")[0],
      SBQQ__EndDate__c: contractEnd.toISOString().split("T")[0],
      SBQQ__SubscriptionStartDate__c: contractStart.toISOString().split("T")[0],
      SBQQ__SubscriptionEndDate__c: contractEnd.toISOString().split("T")[0],
      ...(input.sfQuoteId ? { Stripe_Quote__c: input.sfQuoteId } : {}),
      ...(input.sfQuoteLineIds?.[i] ? { SBQQ__QuoteLine__c: input.sfQuoteLineIds[i] } : {}),
    };

    const stripeItemId = input.stripeSubItemIds?.[i];
    if (stripeItemId) {
      subFields.Stripe_ID__c = stripeItemId;
    }

    try {
      const result = await createSObject("SBQQ__Subscription__c", subFields);
      subscriptionIds.push(result.id);
      log.push(`[SF] Created SBQQ__Subscription__c ${i + 1}: ${result.id} (${li.productName})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push(`[SF] ERROR creating subscription ${i + 1} (${li.productName}): ${msg}`);
    }
  }

  return { subscriptionIds, log };
}

export async function uploadFileToSfRecord(
  sfRecordId: string,
  fileName: string,
  pdfBuffer: Buffer,
  dryRun: boolean,
): Promise<string | null> {
  if (dryRun) return null;

  const { getAccessToken } = await import("@omnibridge/salesforce");
  const { accessToken, instanceUrl } = await getAccessToken();

  const base64Body = pdfBuffer.toString("base64");
  const cvResponse = await fetch(
    `${instanceUrl}/services/data/v60.0/sobjects/ContentVersion`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Title: fileName.replace(/\.pdf$/, ""),
        PathOnClient: fileName,
        VersionData: base64Body,
        Origin: "C",
      }),
    },
  );

  if (!cvResponse.ok) {
    const text = await cvResponse.text();
    throw new Error(`SF ContentVersion create failed: ${cvResponse.status} ${text}`);
  }

  const cvResult = (await cvResponse.json()) as { id: string };
  const contentVersionId = cvResult.id;

  const cvDetail = await fetch(
    `${instanceUrl}/services/data/v60.0/sobjects/ContentVersion/${contentVersionId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const cvData = (await cvDetail.json()) as { ContentDocumentId: string };

  const linkResponse = await fetch(
    `${instanceUrl}/services/data/v60.0/sobjects/ContentDocumentLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ContentDocumentId: cvData.ContentDocumentId,
        LinkedEntityId: sfRecordId,
        ShareType: "V",
        Visibility: "AllUsers",
      }),
    },
  );

  if (!linkResponse.ok) {
    const text = await linkResponse.text();
    throw new Error(`SF ContentDocumentLink create failed: ${linkResponse.status} ${text}`);
  }

  return `${instanceUrl}/${cvData.ContentDocumentId}`;
}
