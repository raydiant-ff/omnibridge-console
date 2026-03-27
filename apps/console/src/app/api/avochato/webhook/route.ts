import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  prisma,
  Prisma,
  SupportChannel,
  SupportConversationEventType,
  SupportConversationStatus,
  SupportExternalSystem,
  SupportMessageDirection,
  SupportMessageType,
  SupportParticipantRole,
  SupportPriority,
  SupportWaitingOn,
} from "@omnibridge/db";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const num = asNumber(value);
  if (num !== null) {
    const millis = num < 10_000_000_000 ? num * 1000 : num;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const str = asString(value);
  if (!str) return null;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function verifyWebhookToken(request: Request): NextResponse | null {
  const configured = process.env.AVOCHATO_WEBHOOK_TOKEN;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Avochato Webhook] AVOCHATO_WEBHOOK_TOKEN must be configured in production");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    return null;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken =
    request.headers.get("x-avochato-webhook-token") ??
    request.headers.get("x-omni-webhook-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const provided = queryToken ?? headerToken;
  if (!provided || provided !== configured) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  return null;
}

function hashPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function pickChannel(value: unknown): SupportChannel {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("chat")) return SupportChannel.chat;
  if (raw.includes("mail") || raw.includes("email")) return SupportChannel.email;
  return SupportChannel.sms;
}

function pickStatus(value: unknown): SupportConversationStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("pending") && raw.includes("customer")) {
    return SupportConversationStatus.pending_customer;
  }
  if (raw.includes("pending") && raw.includes("internal")) {
    return SupportConversationStatus.pending_internal;
  }
  if (raw.includes("resolve")) return SupportConversationStatus.resolved;
  if (raw.includes("close")) return SupportConversationStatus.closed;
  if (raw.includes("spam")) return SupportConversationStatus.spam;
  return SupportConversationStatus.open;
}

function pickPriority(value: unknown): SupportPriority {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("urgent")) return SupportPriority.urgent;
  if (raw.includes("high")) return SupportPriority.high;
  if (raw.includes("low")) return SupportPriority.low;
  return SupportPriority.normal;
}

function pickWaitingOn(value: unknown): SupportWaitingOn {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("customer")) return SupportWaitingOn.customer;
  if (raw.includes("internal")) return SupportWaitingOn.internal;
  return SupportWaitingOn.none;
}

function pickEventType(value: unknown): SupportConversationEventType {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("assign")) return SupportConversationEventType.assigned;
  if (raw.includes("priority")) return SupportConversationEventType.priority_changed;
  if (raw.includes("tag")) return SupportConversationEventType.tagged;
  if (raw.includes("link")) return SupportConversationEventType.linked_customer;
  if (raw.includes("recover")) return SupportConversationEventType.sync_recovered;
  if (raw.includes("error") || raw.includes("fail")) return SupportConversationEventType.sync_error;
  return SupportConversationEventType.status_changed;
}

function pickMessageDirection(value: unknown): SupportMessageDirection {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "out" || raw.includes("outbound")) return SupportMessageDirection.outbound;
  if (raw.includes("system")) return SupportMessageDirection.system;
  return SupportMessageDirection.inbound;
}

async function resolveCustomerLink(payload: JsonRecord) {
  const contact = asRecord(payload.contact) ?? asRecord(payload.person) ?? null;
  const sfObjectId =
    asString(contact?.salesforce_object_id) ??
    asString(payload.salesforce_object_id) ??
    null;
  const stripeCustomerId =
    asString(payload.stripe_customer_id) ??
    asString(contact?.stripe_customer_id) ??
    null;

  if (sfObjectId) {
    const customer = await prisma.customerIndex.findFirst({
      where: { sfAccountId: sfObjectId },
      select: { id: true, sfAccountId: true, stripeCustomerId: true },
    });
    if (customer) return customer;
  }

  if (stripeCustomerId) {
    const customer = await prisma.customerIndex.findFirst({
      where: { stripeCustomerId },
      select: { id: true, sfAccountId: true, stripeCustomerId: true },
    });
    if (customer) return customer;
  }

  return null;
}

export async function POST(request: Request) {
  const tokenFailure = verifyWebhookToken(request);
  if (tokenFailure) return tokenFailure;

  const rawBody = await request.text();
  let payload: JsonRecord;
  try {
    payload = JSON.parse(rawBody) as JsonRecord;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rootMessage = asRecord(payload.message);
  const rootTicket = asRecord(payload.ticket);
  const rootContact = asRecord(payload.contact) ?? asRecord(payload.person);
  const eventName =
    asString(payload.event_type) ??
    asString(payload.event) ??
    asString(payload.type) ??
    "webhook.received";

  const externalEventId =
    asString(payload.id) ??
    asString(rootMessage?.id) ??
    asString(rootTicket?.id) ??
    hashPayload(rawBody);

  const idempotencyKey = `avochato_webhook:${externalEventId}`;
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        scope: "avochato_webhook",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ received: true, deduplicated: true });
    }
    throw err;
  }

  const subdomain =
    asString(asRecord(payload.account)?.subdomain) ??
    asString(payload.subdomain) ??
    null;
  const accountName =
    asString(asRecord(payload.account)?.name) ??
    subdomain ??
    "Avochato Inbox";
  const accountPhone =
    asString(asRecord(payload.account)?.phone) ??
    asString(payload.phone) ??
    null;

  const supportAccount = subdomain
    ? await prisma.supportChannelAccount.upsert({
        where: { externalSubdomain: subdomain },
        update: {
          name: accountName,
          phone: accountPhone,
          metadataJson: asJsonInput(asRecord(payload.account) ?? payload),
        },
        create: {
          externalSystem: SupportExternalSystem.avochato,
          externalSubdomain: subdomain,
          externalAccountId: asString(asRecord(payload.account)?.id),
          name: accountName,
          phone: accountPhone,
          metadataJson: asJsonInput(asRecord(payload.account) ?? payload),
        },
      })
    : null;

  const externalConversationId =
    asString(rootTicket?.id) ??
    asString(payload.ticket_id) ??
    asString(payload.conversation_id) ??
    null;

  const externalMessageId =
    asString(rootMessage?.id) ??
    (externalConversationId ? `synthetic:${externalEventId}` : null);

  const sentAt =
    parseDate(rootMessage?.sent_at) ??
    parseDate(rootMessage?.created_at) ??
    parseDate(payload.created_at) ??
    new Date();

  const customerLink = await resolveCustomerLink(payload);

  let conversationId: string | null = null;
  if (externalConversationId) {
    const conversation = await prisma.supportConversation.upsert({
      where: {
        externalSystem_externalConversationId: {
          externalSystem: SupportExternalSystem.avochato,
          externalConversationId,
        },
      },
      update: {
        externalAccountSubdomain: subdomain,
        channelAccountId: supportAccount?.id,
        customerIndexId: customerLink?.id ?? undefined,
        sfAccountId: customerLink?.sfAccountId ?? undefined,
        stripeCustomerId: customerLink?.stripeCustomerId ?? undefined,
        externalContactId:
          asString(rootContact?.id) ?? asString(payload.contact_id) ?? undefined,
        channel: pickChannel(rootMessage?.origin ?? payload.origin ?? payload.channel),
        status: pickStatus(rootTicket?.status ?? payload.status),
        priority: pickPriority(payload.priority ?? rootTicket?.priority),
        subject:
          asString(rootTicket?.subject) ??
          asString(payload.subject) ??
          asString(rootMessage?.message) ??
          undefined,
        externalAssigneeId:
          asString(rootTicket?.user_id) ?? asString(payload.user_id) ?? undefined,
        lastMessageAt: sentAt,
        lastInboundAt:
          pickMessageDirection(rootMessage?.direction ?? payload.direction) ===
          SupportMessageDirection.inbound
            ? sentAt
            : undefined,
        lastOutboundAt:
          pickMessageDirection(rootMessage?.direction ?? payload.direction) ===
          SupportMessageDirection.outbound
            ? sentAt
            : undefined,
        waitingOn: pickWaitingOn(payload.waiting_on),
        tagsJson: asJsonInput(payload.tags ?? rootTicket?.tags),
        payloadJson: asJsonInput(payload),
        lastWebhookAt: new Date(),
        lastSyncedAt: new Date(),
      },
      create: {
        externalSystem: SupportExternalSystem.avochato,
        externalConversationId,
        externalAccountSubdomain: subdomain,
        channelAccountId: supportAccount?.id,
        customerIndexId: customerLink?.id ?? null,
        sfAccountId: customerLink?.sfAccountId ?? null,
        stripeCustomerId: customerLink?.stripeCustomerId ?? null,
        externalContactId: asString(rootContact?.id) ?? asString(payload.contact_id),
        channel: pickChannel(rootMessage?.origin ?? payload.origin ?? payload.channel),
        status: pickStatus(rootTicket?.status ?? payload.status),
        priority: pickPriority(payload.priority ?? rootTicket?.priority),
        subject:
          asString(rootTicket?.subject) ??
          asString(payload.subject) ??
          asString(rootMessage?.message) ??
          "Avochato conversation",
        externalAssigneeId: asString(rootTicket?.user_id) ?? asString(payload.user_id),
        firstMessageAt: sentAt,
        lastMessageAt: sentAt,
        lastInboundAt:
          pickMessageDirection(rootMessage?.direction ?? payload.direction) ===
          SupportMessageDirection.inbound
            ? sentAt
            : null,
        lastOutboundAt:
          pickMessageDirection(rootMessage?.direction ?? payload.direction) ===
          SupportMessageDirection.outbound
            ? sentAt
            : null,
        waitingOn: pickWaitingOn(payload.waiting_on),
        tagsJson: asJsonInput(payload.tags ?? rootTicket?.tags),
        payloadJson: asJsonInput(payload),
        lastWebhookAt: new Date(),
        lastSyncedAt: new Date(),
      },
      select: { id: true },
    });

    conversationId = conversation.id;
  }

  if (conversationId && externalMessageId) {
    await prisma.supportMessage.upsert({
      where: {
        conversationId_externalMessageId: {
          conversationId,
          externalMessageId,
        },
      },
      update: {
        direction: pickMessageDirection(rootMessage?.direction ?? payload.direction),
        channel: pickChannel(rootMessage?.origin ?? payload.origin ?? payload.channel),
        messageType: SupportMessageType.text,
        body: asString(rootMessage?.message) ?? asString(payload.message),
        subject: asString(payload.subject),
        fromDisplay: asString(rootMessage?.from) ?? asString(payload.from),
        toAddress: asString(rootMessage?.to) ?? asString(payload.to),
        sentAt,
        deliveryState: asString(rootMessage?.status) ?? asString(payload.status),
        payloadJson: asJsonInput(rootMessage ?? payload),
      },
      create: {
        conversationId,
        externalMessageId,
        direction: pickMessageDirection(rootMessage?.direction ?? payload.direction),
        channel: pickChannel(rootMessage?.origin ?? payload.origin ?? payload.channel),
        messageType: SupportMessageType.text,
        body: asString(rootMessage?.message) ?? asString(payload.message),
        subject: asString(payload.subject),
        fromDisplay: asString(rootMessage?.from) ?? asString(payload.from),
        toAddress: asString(rootMessage?.to) ?? asString(payload.to),
        sentAt,
        deliveryState: asString(rootMessage?.status) ?? asString(payload.status),
        payloadJson: asJsonInput(rootMessage ?? payload),
      },
    });
  }

  if (conversationId && rootContact) {
    const role =
      asBoolean(payload.internal) || asBoolean(rootContact.internal)
        ? SupportParticipantRole.agent
        : SupportParticipantRole.customer;
    const uniqueExternalContactId =
      asString(rootContact.id) ??
      asString(payload.contact_id) ??
      `synthetic:${conversationId}:${asString(rootContact.phone) ?? asString(rootContact.email) ?? "contact"}`;

    await prisma.supportParticipant.upsert({
      where: {
        id: `${conversationId}:${uniqueExternalContactId}`,
      },
      update: {
        role,
        externalUserId: asString(rootContact.user_id),
        name: asString(rootContact.name),
        email: asString(rootContact.email),
        phone: asString(rootContact.phone),
      },
      create: {
        id: `${conversationId}:${uniqueExternalContactId}`,
        conversationId,
        role,
        externalContactId: asString(rootContact.id),
        externalUserId: asString(rootContact.user_id),
        name: asString(rootContact.name),
        email: asString(rootContact.email),
        phone: asString(rootContact.phone),
      },
    });
  }

  if (conversationId) {
    await prisma.supportConversationEvent.create({
      data: {
        conversationId,
        externalEventId,
        type: pickEventType(eventName),
        externalActorId:
          asString(payload.user_id) ??
          asString(rootTicket?.user_id) ??
          asString(rootContact?.user_id),
        payloadJson: asJsonInput(payload),
      },
    });
  } else {
    await prisma.auditLog.create({
      data: {
        action: "support.avochato.webhook_unmatched",
        targetType: "avochato_webhook",
        targetId: externalEventId,
        payloadJson: asJsonInput(payload),
      },
    });
  }

  return NextResponse.json({
    received: true,
    conversationId,
    externalEventId,
  });
}
