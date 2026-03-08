"use server";

import { requireSession } from "@omnibridge/auth";

export interface SyncStripeCustomerEmailResult {
  success: boolean;
  error?: string;
  updatedEmail?: string;
}

/**
 * Ensures a Stripe customer has a valid email address by syncing from Salesforce Account
 */
export async function syncStripeCustomerEmail(
  stripeCustomerId: string,
  sfAccountId: string,
): Promise<SyncStripeCustomerEmailResult> {
  await requireSession();

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const { soql } = await import("@omnibridge/salesforce");
    
    const stripe = getStripeClient();

    // Get current Stripe customer
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (typeof customer === 'string' || customer.deleted) {
      return { success: false, error: "Stripe customer not found or deleted" };
    }

    // If customer already has email, return success
    if (customer.email) {
      return { success: true, updatedEmail: customer.email };
    }

    // Query SF Account for Bill_To_Email__c (the single source of truth)
    const accounts = await soql<{
      Id: string;
      Name: string;
      Bill_To_Email__c?: string;
    }>(`
      SELECT Id, Name, Bill_To_Email__c 
      FROM Account 
      WHERE Id = '${sfAccountId}' 
      LIMIT 1
    `);

    const account = accounts[0];
    if (!account) {
      return { success: false, error: "Salesforce Account not found" };
    }

    const billingEmail = account.Bill_To_Email__c;
    if (!billingEmail) {
      return { 
        success: false, 
        error: "No Bill-To Email found on Account. Please select a Bill-To Contact in the quote process to populate Bill_To_Email__c field." 
      };
    }

    // Update Stripe customer with email
    await stripe.customers.update(stripeCustomerId, {
      email: billingEmail,
    });

    return { success: true, updatedEmail: billingEmail };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to sync customer email: ${message}` };
  }
}

/**
 * Validates that a Stripe customer has an email before quote acceptance
 */
export async function validateStripeCustomerEmail(
  stripeCustomerId: string,
  sfAccountId: string,
): Promise<SyncStripeCustomerEmailResult> {
  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    // Check if customer has email
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (typeof customer === 'string' || customer.deleted) {
      return { success: false, error: "Stripe customer not found" };
    }

    if (customer.email) {
      return { success: true, updatedEmail: customer.email };
    }

    // If no email, try to sync from Salesforce
    return await syncStripeCustomerEmail(stripeCustomerId, sfAccountId);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}