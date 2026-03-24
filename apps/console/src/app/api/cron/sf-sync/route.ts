/**
 * Cron: Salesforce mirror sync
 *
 * Scheduled via vercel.json to run every 6 hours.
 * Syncs SF contracts, contract lines, and contacts to local mirror tables.
 * Protected by CRON_SECRET header verification.
 *
 * Self-contained — does not import from "use server" files to avoid
 * build-time restrictions on non-async exports.
 */

import { NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";
import { soql, escapeSoql } from "@omnibridge/salesforce";
import { ensureCustomerIndexCoverage } from "@/lib/omni/utils/ensure-customer-index-coverage";

export const maxDuration = 300;

const CONTRACT_FIELDS = `Id, AccountId, Account.Name, Status, StatusCode, StartDate, EndDate, ContractTerm, ContractNumber, Description, OwnerId, Owner.Name, Stripe_Subscription_ID__c, Stripe_Customer_ID__c, Stripe_Status__c, Stripe_Quote__c, Stripe_Subscription_Schedule_ID__c, Collection_Method__c, Contract_MRR__c, Contract_ARR__c, SBQQ__Opportunity__c, SBQQ__Evergreen__c, DO_NOT_RENEW__c, SBQQ__RenewalTerm__c, Cancellation_Date__c, ActivatedDate, CustomerSignedDate, LastModifiedDate`;

const LINE_FIELDS = `Id, SBQQ__Contract__c, SBQQ__Account__c, SBQQ__Product__c, SBQQ__ProductName__c, SBQQ__Quantity__c, SBQQ__ListPrice__c, SBQQ__NetPrice__c, SBQQ__StartDate__c, SBQQ__EndDate__c, Status__c, SBQQ__BillingFrequency__c, Stripe_Subscription_ID__c, Stripe_Price_ID__c, Stripe_Product_ID__c, Stripe_Subscription_ID_Actual__c, Stripe_Status__c, Monthly_Value__c, ARR__c, LastModifiedDate`;

const ACCOUNT_FIELDS = `Id, Name, OwnerId, Owner.Name, Account_Team_CSM__c, Account_Team_CSM__r.Name, Industry, Type, Stripe_Customer_ID__c, BillingCity, BillingState, BillingCountry, Website`;

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function domainFromWebsite(url: unknown): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  let contractsProcessed = 0;
  let linesProcessed = 0;
  let contactsProcessed = 0;
  let accountsHydrated = 0;
  const errors: string[] = [];

  try {
    const job = await prisma.syncJob.create({
      data: {
        jobType: "sf_mirror_sync",
        status: "running",
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsErrored: 0,
        startedAt,
      },
    });

    // --- Contracts ---
    try {
      const rows = await soql<Record<string, unknown>>(
        `SELECT ${CONTRACT_FIELDS} FROM Contract WHERE Status IN ('Activated', 'Draft', 'Pending') ORDER BY LastModifiedDate DESC`,
      );
      for (const r of rows) {
        try {
          const accountId = str(r.AccountId);
          if (accountId) {
            const acct = r.Account as Record<string, unknown> | null;
            await prisma.sfAccount.upsert({
              where: { id: accountId },
              create: { id: accountId, name: str(acct?.Name) ?? "Unknown", isStub: true, syncedAt: new Date() },
              update: { syncedAt: new Date() },
            });
          }
          await prisma.sfContract.upsert({
            where: { id: r.Id as string },
            create: {
              id: r.Id as string,
              accountId: accountId ?? "",
              accountName: str((r.Account as Record<string, unknown> | null)?.Name),
              status: r.Status as string,
              statusCode: str(r.StatusCode),
              startDate: parseDate(r.StartDate),
              endDate: parseDate(r.EndDate),
              contractTerm: num(r.ContractTerm),
              contractNumber: str(r.ContractNumber),
              description: str(r.Description),
              ownerName: str((r.Owner as Record<string, unknown> | null)?.Name),
              stripeSubscriptionId: str(r.Stripe_Subscription_ID__c),
              stripeCustomerId: str(r.Stripe_Customer_ID__c),
              stripeStatus: str(r.Stripe_Status__c),
              stripeQuoteSfId: str(r.Stripe_Quote__c),
              stripeScheduleId: str(r.Stripe_Subscription_Schedule_ID__c),
              collectionMethod: str(r.Collection_Method__c),
              mrr: num(r.Contract_MRR__c),
              arr: num(r.Contract_ARR__c),
              opportunityId: str(r.SBQQ__Opportunity__c),
              evergreen: bool(r.SBQQ__Evergreen__c),
              doNotRenew: bool(r.DO_NOT_RENEW__c),
              renewalTerm: num(r.SBQQ__RenewalTerm__c),
              cancellationDate: parseDate(r.Cancellation_Date__c),
              activatedDate: parseDate(r.ActivatedDate),
              customerSignedDate: parseDate(r.CustomerSignedDate),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
            update: {
              accountId: accountId ?? undefined,
              accountName: str((r.Account as Record<string, unknown> | null)?.Name) ?? undefined,
              status: r.Status as string,
              statusCode: str(r.StatusCode) ?? undefined,
              startDate: parseDate(r.StartDate),
              endDate: parseDate(r.EndDate),
              contractTerm: num(r.ContractTerm),
              contractNumber: str(r.ContractNumber) ?? undefined,
              ownerName: str((r.Owner as Record<string, unknown> | null)?.Name) ?? undefined,
              stripeSubscriptionId: str(r.Stripe_Subscription_ID__c),
              stripeCustomerId: str(r.Stripe_Customer_ID__c),
              stripeStatus: str(r.Stripe_Status__c),
              collectionMethod: str(r.Collection_Method__c),
              mrr: num(r.Contract_MRR__c),
              arr: num(r.Contract_ARR__c),
              evergreen: bool(r.SBQQ__Evergreen__c),
              doNotRenew: bool(r.DO_NOT_RENEW__c),
              renewalTerm: num(r.SBQQ__RenewalTerm__c),
              cancellationDate: parseDate(r.Cancellation_Date__c),
              activatedDate: parseDate(r.ActivatedDate),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
          });
          contractsProcessed++;
        } catch (err) {
          errors.push(`Contract ${r.Id}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    } catch (err) {
      errors.push(`Contract query: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // --- Contract Lines ---
    try {
      const rows = await soql<Record<string, unknown>>(
        `SELECT ${LINE_FIELDS} FROM SBQQ__Subscription__c ORDER BY LastModifiedDate DESC`,
      );
      for (const r of rows) {
        try {
          await prisma.sfContractLine.upsert({
            where: { id: r.Id as string },
            create: {
              id: r.Id as string,
              contractId: r.SBQQ__Contract__c as string,
              accountId: str(r.SBQQ__Account__c),
              productId: str(r.SBQQ__Product__c),
              productName: str(r.SBQQ__ProductName__c),
              quantity: num(r.SBQQ__Quantity__c),
              listPrice: num(r.SBQQ__ListPrice__c),
              netPrice: num(r.SBQQ__NetPrice__c),
              startDate: parseDate(r.SBQQ__StartDate__c),
              endDate: parseDate(r.SBQQ__EndDate__c),
              status: str(r.Status__c),
              billingFrequency: str(r.SBQQ__BillingFrequency__c),
              stripeSubItemId: str(r.Stripe_Subscription_ID__c),
              stripePriceId: str(r.Stripe_Price_ID__c),
              stripeProductId: str(r.Stripe_Product_ID__c),
              stripeSubscriptionId: str(r.Stripe_Subscription_ID_Actual__c),
              stripeStatus: str(r.Stripe_Status__c),
              mrr: num(r.Monthly_Value__c),
              arr: num(r.ARR__c),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
            update: {
              contractId: r.SBQQ__Contract__c as string,
              productName: str(r.SBQQ__ProductName__c) ?? undefined,
              quantity: num(r.SBQQ__Quantity__c),
              listPrice: num(r.SBQQ__ListPrice__c),
              netPrice: num(r.SBQQ__NetPrice__c),
              startDate: parseDate(r.SBQQ__StartDate__c),
              endDate: parseDate(r.SBQQ__EndDate__c),
              status: str(r.Status__c) ?? undefined,
              stripeSubItemId: str(r.Stripe_Subscription_ID__c),
              stripePriceId: str(r.Stripe_Price_ID__c),
              stripeSubscriptionId: str(r.Stripe_Subscription_ID_Actual__c),
              stripeStatus: str(r.Stripe_Status__c),
              mrr: num(r.Monthly_Value__c),
              arr: num(r.ARR__c),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
          });
          linesProcessed++;
        } catch (err) {
          errors.push(`Line ${r.Id}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    } catch (err) {
      errors.push(`Line query: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // --- Contacts ---
    try {
      const rows = await soql<Record<string, unknown>>(
        `SELECT Id, AccountId, FirstName, LastName, Email, Phone, Title, Billing_Contact__c, Is_Primary__c, LastModifiedDate FROM Contact WHERE AccountId != null ORDER BY LastModifiedDate DESC`,
      );
      for (const r of rows) {
        try {
          await prisma.sfContact.upsert({
            where: { id: r.Id as string },
            create: {
              id: r.Id as string,
              accountId: r.AccountId as string,
              firstName: str(r.FirstName),
              lastName: str(r.LastName) ?? "Unknown",
              email: str(r.Email),
              phone: str(r.Phone),
              title: str(r.Title),
              isBillTo: bool(r.Billing_Contact__c),
              isPrimary: bool(r.Is_Primary__c),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
            update: {
              firstName: str(r.FirstName) ?? undefined,
              lastName: str(r.LastName) ?? undefined,
              email: str(r.Email),
              phone: str(r.Phone),
              title: str(r.Title),
              isBillTo: bool(r.Billing_Contact__c),
              isPrimary: bool(r.Is_Primary__c),
              sfLastModified: parseDate(r.LastModifiedDate),
              syncedAt: new Date(),
            },
          });
          contactsProcessed++;
        } catch (err) {
          errors.push(`Contact ${r.Id}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    } catch (err) {
      errors.push(`Contact query: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // --- Account Hydration ---
    // Hydrate stub accounts with full metadata (CSM, owner, domain, etc.)
    try {
      const contractAccounts = await prisma.sfContract.findMany({
        select: { accountId: true },
        distinct: ["accountId"],
      });
      const accountIds = contractAccounts.map((c) => c.accountId).filter(Boolean);

      const CHUNK = 150;
      for (let i = 0; i < accountIds.length; i += CHUNK) {
        const chunk = accountIds.slice(i, i + CHUNK);
        const idList = chunk.map((id) => `'${escapeSoql(id)}'`).join(",");

        let records: Record<string, unknown>[];
        try {
          records = await soql<Record<string, unknown>>(
            `SELECT ${ACCOUNT_FIELDS} FROM Account WHERE Id IN (${idList})`,
          );
        } catch (err) {
          errors.push(`Account hydration chunk ${i}: ${err instanceof Error ? err.message : "unknown"}`);
          continue;
        }

        for (const r of records) {
          try {
            await prisma.sfAccount.upsert({
              where: { id: r.Id as string },
              create: {
                id: r.Id as string,
                name: str(r.Name) ?? "Unknown",
                ownerId: str(r.OwnerId),
                ownerName: str((r.Owner as Record<string, unknown> | null)?.Name),
                csmId: str(r.Account_Team_CSM__c),
                csmName: str((r.Account_Team_CSM__r as Record<string, unknown> | null)?.Name),
                industry: str(r.Industry),
                accountType: str(r.Type),
                stripeCustomerId: str(r.Stripe_Customer_ID__c),
                billingCity: str(r.BillingCity),
                billingState: str(r.BillingState),
                billingCountry: str(r.BillingCountry),
                domain: domainFromWebsite(r.Website),
                isStub: false,
                hydratedAt: new Date(),
                syncedAt: new Date(),
              },
              update: {
                name: str(r.Name) ?? undefined,
                ownerId: str(r.OwnerId),
                ownerName: str((r.Owner as Record<string, unknown> | null)?.Name),
                csmId: str(r.Account_Team_CSM__c),
                csmName: str((r.Account_Team_CSM__r as Record<string, unknown> | null)?.Name),
                industry: str(r.Industry),
                accountType: str(r.Type),
                stripeCustomerId: str(r.Stripe_Customer_ID__c),
                billingCity: str(r.BillingCity),
                billingState: str(r.BillingState),
                billingCountry: str(r.BillingCountry),
                domain: domainFromWebsite(r.Website),
                isStub: false,
                hydratedAt: new Date(),
                syncedAt: new Date(),
              },
            });
            accountsHydrated++;
          } catch (err) {
            errors.push(`Account ${r.Id}: ${err instanceof Error ? err.message : "unknown"}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Account hydration: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // Ensure CustomerIndex coverage (moved from hot read path)
    try {
      await ensureCustomerIndexCoverage();
    } catch (err) {
      errors.push(`Coverage check: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // Update job
    const total = contractsProcessed + linesProcessed + contactsProcessed + accountsHydrated;
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        recordsProcessed: total,
        recordsCreated: total,
        recordsErrored: errors.length,
        error: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
        completedAt: new Date(),
      },
    });

    console.log(`[sf-sync] Done: ${contractsProcessed} contracts, ${linesProcessed} lines, ${contactsProcessed} contacts, ${accountsHydrated} accounts hydrated, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      contracts: contractsProcessed,
      lines: linesProcessed,
      contacts: contactsProcessed,
      accountsHydrated,
      errors: errors.length,
      duration: `${((Date.now() - startedAt.getTime()) / 1000).toFixed(1)}s`,
    });
  } catch (err) {
    console.error("[sf-sync] Fatal:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
