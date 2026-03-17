import { prisma } from "@omnibridge/db";

/**
 * Write an audit entry to the sync_events table.
 * Fire-and-forget — callers should .catch() if needed.
 */
export async function writeSyncEvent(params: {
  source: string;
  eventType: string;
  externalId?: string;
  objectType?: string;
  objectId?: string;
  action?: string;
  actorType?: string;
  actorId?: string | null;
  actorName?: string | null;
  success?: boolean;
  error?: string;
  payload?: unknown;
}) {
  await prisma.syncEvent.upsert({
    where: {
      source_externalId: {
        source: params.source,
        externalId: params.externalId ?? "",
      },
    },
    create: {
      source: params.source,
      eventType: params.eventType,
      externalId: params.externalId,
      objectType: params.objectType,
      objectId: params.objectId,
      action: params.action,
      actorType: params.actorType,
      actorId: params.actorId,
      actorName: params.actorName,
      success: params.success ?? true,
      error: params.error,
      payload: params.payload as any,
    },
    update: {
      eventType: params.eventType,
      objectType: params.objectType,
      objectId: params.objectId,
      action: params.action,
      actorType: params.actorType,
      actorId: params.actorId,
      actorName: params.actorName,
      success: params.success ?? true,
      error: params.error,
      payload: params.payload as any,
    },
  });
}
