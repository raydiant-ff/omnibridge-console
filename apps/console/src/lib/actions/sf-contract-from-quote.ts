"use server";

import { prisma } from "@omnibridge/db";
import type { QuoteRecord } from "@omnibridge/db";
import { 
  createSfContractFromQuote, 
  createSfSubscriptionsFromQuote,
  type SfContractInput,
  type SfSubscriptionInput,
} from "./sf-quote-mirror";
import type { QuoteLineItem } from "./quotes";

export interface CreateSfRecordsFromQuoteResult {
  success: boolean;
  contractId?: string;
  subscriptionIds?: string[];
  error?: string;
  log: string[];
}

/**
 * Creates SF Contract and Subscriptions from a QuoteRecord with all proper field mappings
 */
export async function createSfRecordsFromQuote(
  record: QuoteRecord,
  stripeSubscriptionId: string,
  customerSignedDate?: Date,
  dryRun: boolean = false,
): Promise<CreateSfRecordsFromQuoteResult> {
  const log: string[] = [];

  if (!record.sfAccountId || !record.sfQuoteId) {
    return {
      success: false,
      error: "Missing required SF Account ID or Quote ID",
      log,
    };
  }

  try {
    // Parse line items
    const lineItems: QuoteLineItem[] = record.lineItemsJson 
      ? JSON.parse(record.lineItemsJson) 
      : [];

    if (lineItems.length === 0) {
      return {
        success: false,
        error: "No line items found in quote record",
        log,
      };
    }

    // Parse SF Quote Line IDs
    const sfQuoteLineIds: string[] = record.sfQuoteLineIds 
      ? JSON.parse(record.sfQuoteLineIds as string)
      : [];

    // Get Bill-To Contact ID from account
    let customerSignedContactId: string | undefined;
    if (!dryRun) {
      try {
        const { soql } = await import("@omnibridge/salesforce");
        const accounts = await soql<{
          blng__BillToContact__c?: string;
        }>(`
          SELECT blng__BillToContact__c 
          FROM Account 
          WHERE Id = '${record.sfAccountId}' 
          LIMIT 1
        `);
        customerSignedContactId = accounts[0]?.blng__BillToContact__c || undefined;
      } catch (err) {
        log.push(`[WARN] Could not retrieve Bill-To Contact: ${err}`);
      }
    }

    // 1. Create Contract
    const contractInput: SfContractInput = {
      sfAccountId: record.sfAccountId,
      sfQuoteId: record.sfQuoteId,
      stripeQuoteId: record.stripeQuoteId,
      stripeSubscriptionId,
      contractTerm: (record.contractTerm as any) || "1yr",
      billingFrequency: (record.billingFrequency as any) || "annual",
      effectiveDate: record.createdAt.toISOString().split("T")[0],
      collectionMethod: record.collectionMethod || "send_invoice",
      opportunityId: record.opportunityId || undefined,
      customerSignedDate,
      customerSignedContactId,
    };

    const contractResult = await createSfContractFromQuote(contractInput, dryRun);
    log.push(...contractResult.log);

    if (!contractResult.contractId) {
      return {
        success: false,
        error: "Failed to create SF Contract",
        log,
      };
    }

    // 2. Create Subscriptions
    const subscriptionInput: SfSubscriptionInput = {
      contractId: contractResult.contractId,
      sfAccountId: record.sfAccountId,
      sfQuoteId: record.sfQuoteId,
      sfQuoteLineIds,
      billingFrequency: (record.billingFrequency as any) || "annual",
      contractTerm: (record.contractTerm as any) || "1yr",
      effectiveDate: record.createdAt.toISOString().split("T")[0],
      lineItems,
      stripeSubItemIds: record.stripeSubItemIds 
        ? JSON.parse(record.stripeSubItemIds as string)
        : undefined,
    };

    const subscriptionResult = await createSfSubscriptionsFromQuote(subscriptionInput, dryRun);
    log.push(...subscriptionResult.log);

    // 3. Update QuoteRecord with SF IDs
    if (!dryRun && contractResult.contractId) {
      await prisma.quoteRecord.update({
        where: { id: record.id },
        data: {
          sfContractId: contractResult.contractId,
          sfSubscriptionIds: subscriptionResult.subscriptionIds || [],
        },
      });
      log.push(`[DB] Updated QuoteRecord with SF Contract ID: ${contractResult.contractId}`);
    }

    return {
      success: true,
      contractId: contractResult.contractId,
      subscriptionIds: subscriptionResult.subscriptionIds,
      log,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`[ERROR] ${message}`);
    return {
      success: false,
      error: message,
      log,
    };
  }
}