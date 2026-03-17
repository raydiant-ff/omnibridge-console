"use server";

import { prisma, Prisma } from "@omnibridge/db";
import type { Stripe } from "@omnibridge/stripe";
import { requireSession } from "@omnibridge/auth";

/**
 * Upsert a Stripe Customer into the local mirror.
 * Safe to call from webhooks and backfill scripts.
 */
export async function upsertStripeCustomer(customer: Stripe.Customer) {
  const sfAccountId =
    customer.metadata?.salesforce_account_id ??
    customer.metadata?.sf_account_id ??
    null;

  const rawPm = (customer as any).default_payment_method
    ?? customer.invoice_settings?.default_payment_method
    ?? null;
  const defaultPm =
    typeof rawPm === "string" ? rawPm : rawPm?.id ?? null;

  const data = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    description: customer.description,
    currency: customer.currency,
    balance: customer.balance ?? 0,
    delinquent: customer.delinquent ?? false,
    defaultPaymentMethod: defaultPm,
    sfAccountId,
    metadata: (customer.metadata ?? {}) as Prisma.JsonObject,
    raw: customer as unknown as Prisma.JsonObject,
    syncedAt: new Date(),
  };

  await prisma.stripeCustomer.upsert({
    where: { id: customer.id },
    create: {
      id: customer.id,
      ...data,
      stripeCreated: new Date(customer.created * 1000),
    },
    update: data,
  });
}

export interface SyncStripeCustomerEmailResult {
  success: boolean;
  error?: string;
  updatedEmail?: string;
}

/**
 * Core email sync logic — no session required, safe for webhook contexts.
 */
async function syncEmailFromSalesforce(
  stripeCustomerId: string,
  sfAccountId: string,
): Promise<SyncStripeCustomerEmailResult> {
  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const { soql, escapeSoql } = await import("@omnibridge/salesforce");

    const stripe = getStripeClient();

    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (typeof customer === 'string' || customer.deleted) {
      return { success: false, error: "Stripe customer not found or deleted" };
    }

    if (customer.email) {
      return { success: true, updatedEmail: customer.email };
    }

    const accounts = await soql<{
      Id: string;
      Name: string;
      Bill_To_Email__c?: string;
    }>(`
      SELECT Id, Name, Bill_To_Email__c 
      FROM Account 
      WHERE Id = '${escapeSoql(sfAccountId)}' 
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
 * Session-gated version for user-facing server actions.
 */
export async function syncStripeCustomerEmail(
  stripeCustomerId: string,
  sfAccountId: string,
): Promise<SyncStripeCustomerEmailResult> {
  await requireSession();
  return syncEmailFromSalesforce(stripeCustomerId, sfAccountId);
}

/**
 * Validates that a Stripe customer has an email before quote acceptance.
 * Safe to call from webhooks (no session required).
 */
export async function validateStripeCustomerEmail(
  stripeCustomerId: string,
  sfAccountId: string,
): Promise<SyncStripeCustomerEmailResult> {
  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (typeof customer === 'string' || customer.deleted) {
      return { success: false, error: "Stripe customer not found" };
    }

    if (customer.email) {
      return { success: true, updatedEmail: customer.email };
    }

    return await syncEmailFromSalesforce(stripeCustomerId, sfAccountId);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
