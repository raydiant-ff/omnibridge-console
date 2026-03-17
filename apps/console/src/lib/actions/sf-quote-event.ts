"use server";

import { flags } from "@/lib/feature-flags";

export interface SfQuoteEventInput {
  sfQuoteId: string;
  action: string;
  occurredAt: Date;
  actor?: string | null;
  source?: "omnibridge" | "stripe" | "docusign";
  details?: Record<string, unknown> | null;
  omniAuditLogId?: string | null;
}

/**
 * Write a single lifecycle event to the Stripe_Quote_Event__c related list
 * on the Salesforce Stripe_Quote__c record. Idempotent via Omni_Audit_Log_ID__c
 * external ID — safe to call repeatedly without duplication.
 */
export async function createSfQuoteEvent(
  input: SfQuoteEventInput,
): Promise<{ id: string | null; log: string[] }> {
  const log: string[] = [];

  if (flags.useMockSalesforce) {
    const mockId = `SQEmock${Date.now().toString(36)}`;
    log.push(`[MOCK] Would create Stripe_Quote_Event__c for "${input.action}" on ${input.sfQuoteId}`);
    return { id: mockId, log };
  }

  const { createSObject, escapeSoql } = await import("@omnibridge/salesforce");

  // Idempotency: skip if this audit log ID was already synced
  if (input.omniAuditLogId) {
    try {
      const { soql } = await import("@omnibridge/salesforce");
      const existing = await soql<{ Id: string }>(
        `SELECT Id FROM Stripe_Quote_Event__c WHERE Omni_Audit_Log_ID__c = '${escapeSoql(input.omniAuditLogId)}' LIMIT 1`,
      );
      if (existing.length > 0) {
        log.push(`[SF] Stripe_Quote_Event__c already exists for audit log ${input.omniAuditLogId} — skipping`);
        return { id: existing[0]!.Id, log };
      }
    } catch {
      log.push(`[SF] WARN: Could not check idempotency for audit log ${input.omniAuditLogId}`);
    }
  }

  const detailsStr = input.details
    ? JSON.stringify(input.details, null, 2)
    : null;

  const fields: Record<string, unknown> = {
    Stripe_Quote__c: input.sfQuoteId,
    Action__c: input.action,
    Occurred_At__c: input.occurredAt.toISOString(),
    Source__c: input.source ?? "omnibridge",
    ...(input.actor ? { Actor__c: input.actor } : {}),
    ...(detailsStr ? { Details__c: detailsStr } : {}),
    ...(input.omniAuditLogId ? { Omni_Audit_Log_ID__c: input.omniAuditLogId } : {}),
  };

  try {
    const result = await createSObject("Stripe_Quote_Event__c", fields);
    log.push(`[SF] Created Stripe_Quote_Event__c: ${result.id} (${input.action})`);
    return { id: result.id, log };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`[SF] ERROR creating Stripe_Quote_Event__c: ${msg}`);
    return { id: null, log };
  }
}

/**
 * Bulk-sync all audit log entries for a given quote record to Salesforce.
 * Called after the SF quote is created so historical events are captured too.
 */
export async function syncQuoteTimelineToSalesforce(
  sfQuoteId: string,
  events: SfQuoteEventInput[],
): Promise<{ synced: number; skipped: number; errors: number; log: string[] }> {
  const log: string[] = [];
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events) {
    const { id, log: eventLog } = await createSfQuoteEvent({ ...event, sfQuoteId });
    log.push(...eventLog);
    if (id === null) {
      errors++;
    } else if (eventLog.some((l) => l.includes("already exists"))) {
      skipped++;
    } else {
      synced++;
    }
  }

  log.push(`[SF] Timeline sync complete: ${synced} created, ${skipped} skipped, ${errors} errors`);
  return { synced, skipped, errors, log };
}
