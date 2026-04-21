import { NextResponse } from "next/server";
import {
  prisma,
  Prisma,
  SupportChannel,
  SupportConversationStatus,
  SupportExternalSystem,
  SupportMessageDirection,
  SupportMessageType,
  SupportParticipantRole,
  SupportPriority,
  SupportWaitingOn,
} from "@omnibridge/db";
import {
  fetchTicketEvents,
  fetchTickets,
  getAvochatoCredentials,
  listUsers,
  searchMessages,
  type AvochatoMessage,
  type AvochatoTicket,
  type AvochatoTicketEvent,
  type AvochatoUser,
} from "@omnibridge/avochato";
import { writeSyncEvent } from "@/lib/actions/sync-event-log";

export const maxDuration = 300;

function asDate(value: number | string | null | undefined) {
  if (typeof value === "number") {
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(millis);
  }
  if (typeof value === "string") return new Date(value);
  return new Date();
}

function normalizePhone(phone: string | null | undefined) {
  return phone ? phone.replace(/\D/g, "") : null;
}

function asJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function pickChannel(origin: string | null | undefined): SupportChannel {
  const raw = String(origin ?? "").toLowerCase();
  if (raw.includes("chat")) return SupportChannel.chat;
  if (raw.includes("mail")) return SupportChannel.email;
  return SupportChannel.sms;
}

function pickDirection(direction: string | null | undefined): SupportMessageDirection {
  const raw = String(direction ?? "").toLowerCase();
  if (raw === "out" || raw.includes("out")) return SupportMessageDirection.outbound;
  return SupportMessageDirection.inbound;
}

function buildMessageId(message: AvochatoMessage, index: number) {
  return (
    message.uuid ??
    message.external_id ??
    message.event_id ??
    message.element_id ??
    `${message.ticket_id ?? message.contact_id ?? "message"}:${index}:${String(message.created_at)}`
  );
}

function buildConversationId(message: AvochatoMessage) {
  return message.ticket_id ?? `contact:${message.contact_id ?? buildMessageId(message, 0)}`;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function readStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}

function pickConversationStatus(value: string | null | undefined): SupportConversationStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("pending")) return SupportConversationStatus.pending_customer;
  if (raw.includes("close")) return SupportConversationStatus.closed;
  return SupportConversationStatus.open;
}

function buildEventId(event: AvochatoTicketEvent, index: number) {
  return event.event_id ?? event.id ?? event.element_id ?? `event:${index}:${String(event.sent_at ?? event.created_at)}`;
}

function pickEventTimestamp(event: AvochatoTicketEvent) {
  return asDate(event.sent_at ?? event.created_at);
}

function shouldSyncTimelineEvent(event: AvochatoTicketEvent) {
  const raw = String(event.element_type ?? event.event_type ?? "").toLowerCase();
  return !raw.includes("message");
}

function pickConversationEventType(event: AvochatoTicketEvent) {
  const raw = String(event.element_type ?? event.event_type ?? "").toLowerCase();
  if (raw.includes("assign") || raw.includes("owner")) return "assigned";
  if (raw.includes("tag")) return "tagged";
  if (raw.includes("priority")) return "priority_changed";
  return "status_changed";
}

function buildEventSummary(
  event: AvochatoTicketEvent,
  userMap: Map<string, AvochatoUser>,
  currentAssigneeName: string | null,
) {
  const actorExternalId = event.user_id ?? event.sender_id ?? null;
  const actorName = actorExternalId
    ? userMap.get(actorExternalId)?.name ?? null
    : event.sender_tag ?? null;
  const rawType = String(event.element_type ?? event.event_type ?? "").toLowerCase();

  if (rawType.includes("statuschange")) {
    return {
      actorExternalId,
      actorName: actorName ?? "Avochato",
      summary: `Status changed to ${event.status ?? "updated"}`,
      detail: currentAssigneeName ? `Current owner: ${currentAssigneeName}` : null,
    };
  }

  if (rawType.includes("owner") || rawType.includes("assign")) {
    return {
      actorExternalId,
      actorName: actorName ?? "Avochato",
      summary: currentAssigneeName
        ? `Ownership assigned to ${currentAssigneeName}`
        : "Ownership changed",
      detail: actorName ? `Updated by ${actorName}` : null,
    };
  }

  if (rawType.includes("unaddressed")) {
    const unaddressed = (event as { unaddressed?: boolean }).unaddressed === true;
    return {
      actorExternalId,
      actorName: actorName ?? "Avochato",
      summary: unaddressed ? "Conversation marked unaddressed" : "Conversation addressed",
      detail: actorName ? `Changed by ${actorName}` : null,
    };
  }

  if (rawType.includes("avonote")) {
    const body = readStringField(event, "body");
    return {
      actorExternalId,
      actorName: actorName ?? "Avochato",
      summary: "Internal note added",
      detail: body,
    };
  }

  if (rawType.includes("call")) {
    const direction = readStringField(event, "direction") ?? "out";
    return {
      actorExternalId,
      actorName: actorName ?? "Avochato",
      summary: `${direction === "in" ? "Inbound" : "Outbound"} call logged`,
      detail: null,
    };
  }

  return {
    actorExternalId,
    actorName: actorName ?? "Avochato",
    summary: `Timeline update: ${event.element_type ?? event.event_type ?? "event"}`,
    detail: null,
  };
}

async function loadAllAvochatoUsers(credentials: ReturnType<typeof getAvochatoCredentials>) {
  const users: AvochatoUser[] = [];
  for (let page = 1; page <= 20; page++) {
    const pageUsers = await listUsers(credentials, page);
    if (pageUsers.length === 0) break;
    users.push(...pageUsers);
    if (pageUsers.length < 25) break;
  }
  return users;
}

async function resolveCustomerLink(messageGroup: AvochatoMessage[]) {
  const phoneCandidates = Array.from(
    new Set(
      messageGroup
        .flatMap((message) =>
          pickDirection(message.direction) === SupportMessageDirection.inbound
            ? [message.from]
            : [message.to],
        )
        .map(normalizePhone)
        .filter((value): value is string => typeof value === "string" && value.length >= 10),
    ),
  );

  for (const phone of phoneCandidates) {
    const stripeCustomer = await prisma.stripeCustomer.findFirst({
      where: {
        phone: {
          endsWith: phone.slice(-10),
        },
      },
      select: {
        id: true,
        sfAccountId: true,
      },
    });

    if (stripeCustomer) {
      const customerIndex = await prisma.customerIndex.findFirst({
        where: {
          OR: [
            { stripeCustomerId: stripeCustomer.id },
            ...(stripeCustomer.sfAccountId ? [{ sfAccountId: stripeCustomer.sfAccountId }] : []),
          ],
        },
        select: {
          id: true,
          sfAccountId: true,
          stripeCustomerId: true,
        },
      });
      if (customerIndex) return customerIndex;
    }

    const sfContact = await prisma.sfContact.findFirst({
      where: {
        OR: [
          { phone: { endsWith: phone.slice(-10) } },
          { mobilePhone: { endsWith: phone.slice(-10) } },
        ],
      },
      select: { accountId: true },
    });

    if (sfContact) {
      const customerIndex = await prisma.customerIndex.findFirst({
        where: { sfAccountId: sfContact.accountId },
        select: {
          id: true,
          sfAccountId: true,
          stripeCustomerId: true,
        },
      });
      if (customerIndex) return customerIndex;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxPages = Math.max(1, Math.min(10, Number(url.searchParams.get("pages") ?? "3")));

  const job = await prisma.syncJob.create({
    data: {
      jobType: "avochato_conversation_sync",
      status: "running",
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsErrored: 0,
      startedAt: new Date(),
    },
  });

  let conversationsProcessed = 0;
  let messagesProcessed = 0;
  let eventsProcessed = 0;
  const errors: string[] = [];

  try {
    const baseCredentials = getAvochatoCredentials();
    const accounts = await prisma.supportChannelAccount.findMany({
      where: { externalSystem: SupportExternalSystem.avochato },
      include: {
        endpoints: {
          where: { active: true },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    for (const account of accounts) {
      const credentials = {
        ...baseCredentials,
        subdomain: account.externalSubdomain ?? baseCredentials.subdomain,
      };
      const avoUsers = await loadAllAvochatoUsers(credentials);
      const avoUsersById = new Map(avoUsers.map((user) => [user.id, user]));
      const omniUsers = avoUsers.length
        ? await prisma.user.findMany({
            where: {
              email: {
                in: avoUsers.map((user) => user.email).filter(Boolean),
              },
            },
            select: {
              id: true,
              email: true,
            },
          })
        : [];
      const omniUserIdByEmail = new Map(omniUsers.map((user) => [user.email.toLowerCase(), user.id]));
      const omniUserIdByExternalAvoUserId = new Map<string, string>();
      for (const avoUser of avoUsers) {
        if (!avoUser.email) continue;
        const omniUserId = omniUserIdByEmail.get(avoUser.email.toLowerCase());
        if (omniUserId) {
          omniUserIdByExternalAvoUserId.set(avoUser.id, omniUserId);
        }
      }

      const collectedMessages: AvochatoMessage[] = [];

      for (let page = 1; page <= maxPages; page++) {
        const pageMessages = await searchMessages(credentials, { page });
        if (pageMessages.length === 0) break;
        collectedMessages.push(...pageMessages);
        if (pageMessages.length < 25) break;
      }

      const grouped = new Map<string, AvochatoMessage[]>();
      for (const message of collectedMessages) {
        const key = buildConversationId(message);
        grouped.set(key, [...(grouped.get(key) ?? []), message]);
      }

      const ticketIds = Array.from(
        new Set(
          Array.from(grouped.values())
            .map((group) => group[0]?.ticket_id)
            .filter((ticketId): ticketId is string => Boolean(ticketId)),
        ),
      );
      const ticketsById = new Map<string, AvochatoTicket>();
      for (const batch of chunkArray(ticketIds, 20)) {
        if (batch.length === 0) continue;
        const tickets = await fetchTickets(batch, credentials);
        for (const ticket of tickets) {
          ticketsById.set(ticket.id, ticket);
        }
      }

      for (const [externalConversationId, group] of grouped.entries()) {
        try {
          const sorted = [...group].sort(
            (left, right) => asDate(left.sent_at ?? left.created_at).getTime() - asDate(right.sent_at ?? right.created_at).getTime(),
          );
          const first = sorted[0];
          const latest = sorted[sorted.length - 1];
          const currentTicket = first.ticket_id ? ticketsById.get(first.ticket_id) ?? null : null;
          const customerLink = await resolveCustomerLink(sorted);
          const inboundMessages = sorted.filter(
            (message) => pickDirection(message.direction) === SupportMessageDirection.inbound,
          );
          const outboundMessages = sorted.filter(
            (message) => pickDirection(message.direction) === SupportMessageDirection.outbound,
          );
          const currentAssigneeName =
            currentTicket?.user_id ? avoUsersById.get(currentTicket.user_id)?.name ?? null : null;
          const currentAssigneeOmniUserId =
            currentTicket?.user_id
              ? omniUserIdByExternalAvoUserId.get(currentTicket.user_id) ?? null
              : null;

          const conversation = await prisma.supportConversation.upsert({
            where: {
              externalSystem_externalConversationId: {
                externalSystem: SupportExternalSystem.avochato,
                externalConversationId,
              },
            },
            update: {
              externalAccountSubdomain: account.externalSubdomain,
              channelAccountId: account.id,
              channelEndpointId: account.endpoints[0]?.id,
              customerIndexId: customerLink?.id ?? undefined,
              sfAccountId: customerLink?.sfAccountId ?? undefined,
              stripeCustomerId: customerLink?.stripeCustomerId ?? undefined,
              externalContactId: first.contact_id ?? undefined,
              channel: pickChannel(first.origin),
              status: pickConversationStatus(currentTicket?.status),
              priority: SupportPriority.normal,
              subject: latest.message?.slice(0, 120) ?? "Avochato conversation",
              assigneeUserId: currentAssigneeOmniUserId ?? undefined,
              externalAssigneeId: currentTicket?.user_id ?? undefined,
              firstMessageAt: asDate(first.sent_at ?? first.created_at),
              lastMessageAt: asDate(latest.sent_at ?? latest.created_at),
              lastInboundAt:
                inboundMessages.length > 0
                  ? asDate(inboundMessages[inboundMessages.length - 1].sent_at ?? inboundMessages[inboundMessages.length - 1].created_at)
                  : null,
              lastOutboundAt:
                outboundMessages.length > 0
                  ? asDate(outboundMessages[outboundMessages.length - 1].sent_at ?? outboundMessages[outboundMessages.length - 1].created_at)
                  : null,
              waitingOn:
                pickDirection(latest.direction) === SupportMessageDirection.inbound
                  ? SupportWaitingOn.internal
                  : SupportWaitingOn.customer,
              rawSummaryJson: {
                messageCount: sorted.length,
                lastDirection: latest.direction,
                currentAssigneeName,
              },
              payloadJson: asJsonInput(latest),
              lastSyncedAt: new Date(),
            },
            create: {
              externalSystem: SupportExternalSystem.avochato,
              externalConversationId,
              externalAccountSubdomain: account.externalSubdomain,
              channelAccountId: account.id,
              channelEndpointId: account.endpoints[0]?.id ?? null,
              customerIndexId: customerLink?.id ?? null,
              sfAccountId: customerLink?.sfAccountId ?? null,
              stripeCustomerId: customerLink?.stripeCustomerId ?? null,
              externalContactId: first.contact_id ?? null,
              channel: pickChannel(first.origin),
              status: pickConversationStatus(currentTicket?.status),
              priority: SupportPriority.normal,
              subject: latest.message?.slice(0, 120) ?? "Avochato conversation",
              assigneeUserId: currentAssigneeOmniUserId ?? null,
              externalAssigneeId: currentTicket?.user_id ?? null,
              firstMessageAt: asDate(first.sent_at ?? first.created_at),
              lastMessageAt: asDate(latest.sent_at ?? latest.created_at),
              lastInboundAt:
                inboundMessages.length > 0
                  ? asDate(inboundMessages[inboundMessages.length - 1].sent_at ?? inboundMessages[inboundMessages.length - 1].created_at)
                  : null,
              lastOutboundAt:
                outboundMessages.length > 0
                  ? asDate(outboundMessages[outboundMessages.length - 1].sent_at ?? outboundMessages[outboundMessages.length - 1].created_at)
                  : null,
              waitingOn:
                pickDirection(latest.direction) === SupportMessageDirection.inbound
                  ? SupportWaitingOn.internal
                  : SupportWaitingOn.customer,
              rawSummaryJson: {
                messageCount: sorted.length,
                lastDirection: latest.direction,
                currentAssigneeName,
              },
              payloadJson: asJsonInput(latest),
              lastSyncedAt: new Date(),
            },
            select: { id: true },
          });
          conversationsProcessed++;

          for (const [index, message] of sorted.entries()) {
            const externalMessageId = buildMessageId(message, index);
            await prisma.supportMessage.upsert({
              where: {
                conversationId_externalMessageId: {
                  conversationId: conversation.id,
                  externalMessageId,
                },
              },
              update: {
                direction: pickDirection(message.direction),
                channel: pickChannel(message.origin),
                messageType: SupportMessageType.text,
                body: message.message ?? undefined,
                fromAddress: message.from ?? undefined,
                toAddress: message.to ?? undefined,
                sentAt: asDate(message.sent_at ?? message.created_at),
                deliveryState: message.status ?? undefined,
                authorUserId: message.sender_id
                  ? omniUserIdByExternalAvoUserId.get(message.sender_id) ?? undefined
                  : undefined,
                payloadJson: asJsonInput(message),
              },
              create: {
                conversationId: conversation.id,
                externalMessageId,
                direction: pickDirection(message.direction),
                channel: pickChannel(message.origin),
                messageType: SupportMessageType.text,
                body: message.message ?? null,
                fromAddress: message.from ?? null,
                toAddress: message.to ?? null,
                sentAt: asDate(message.sent_at ?? message.created_at),
                deliveryState: message.status ?? null,
                authorUserId: message.sender_id
                  ? omniUserIdByExternalAvoUserId.get(message.sender_id) ?? null
                  : null,
                payloadJson: asJsonInput(message),
              },
            });
            messagesProcessed++;

            const participantKey =
              message.contact_id ??
              message.sender_id ??
              (pickDirection(message.direction) === SupportMessageDirection.inbound
                ? message.from
                : message.to) ??
              `${conversation.id}:${index}`;

            await prisma.supportParticipant.upsert({
              where: {
                id: `${conversation.id}:${participantKey}`,
              },
              update: {
                role:
                  message.sender_type === "User" || message.sender_type === "Avochato"
                    ? SupportParticipantRole.agent
                    : SupportParticipantRole.customer,
                externalContactId: message.contact_id ?? undefined,
                externalUserId: message.sender_id ?? undefined,
                name:
                  message.sender_type === "User" || message.sender_type === "Avochato"
                    ? message.sender_id
                      ? avoUsersById.get(message.sender_id)?.name ?? "Avochato Agent"
                      : "Avochato Agent"
                    : null,
                phone:
                  pickDirection(message.direction) === SupportMessageDirection.inbound
                    ? message.from ?? null
                    : message.to ?? null,
              },
              create: {
                id: `${conversation.id}:${participantKey}`,
                conversationId: conversation.id,
                role:
                  message.sender_type === "User" || message.sender_type === "Avochato"
                    ? SupportParticipantRole.agent
                    : SupportParticipantRole.customer,
                externalContactId: message.contact_id ?? null,
                externalUserId: message.sender_id ?? null,
                name:
                  message.sender_type === "User" || message.sender_type === "Avochato"
                    ? message.sender_id
                      ? avoUsersById.get(message.sender_id)?.name ?? "Avochato Agent"
                      : "Avochato Agent"
                    : null,
                phone:
                  pickDirection(message.direction) === SupportMessageDirection.inbound
                    ? message.from ?? null
                    : message.to ?? null,
              },
            });
          }

          if (first.ticket_id) {
            const timelineEvents: AvochatoTicketEvent[] = [];
            for (let page = 1; page <= 3; page++) {
              const pageEvents = await fetchTicketEvents(first.ticket_id, credentials, page);
              if (pageEvents.length === 0) break;
              timelineEvents.push(...pageEvents);
              if (pageEvents.length < 30) break;
            }

            const syncableEvents = timelineEvents
              .filter(shouldSyncTimelineEvent)
              .sort(
                (left, right) =>
                  pickEventTimestamp(left).getTime() - pickEventTimestamp(right).getTime(),
              );

            for (const [index, event] of syncableEvents.entries()) {
              const externalEventId = buildEventId(event, index);
              const { actorExternalId, actorName, summary, detail } = buildEventSummary(
                event,
                avoUsersById,
                currentAssigneeName,
              );
              await prisma.supportConversationEvent.upsert({
                where: {
                  id: `${conversation.id}:${externalEventId}`,
                },
                update: {
                  externalEventId,
                  type: pickConversationEventType(event),
                  actorUserId: actorExternalId
                    ? omniUserIdByExternalAvoUserId.get(actorExternalId) ?? undefined
                    : undefined,
                  externalActorId: actorExternalId ?? undefined,
                  payloadJson: asJsonInput({
                    ...event,
                    actorName,
                    currentAssigneeName,
                    summary,
                    detail,
                  }),
                  createdAt: pickEventTimestamp(event),
                },
                create: {
                  id: `${conversation.id}:${externalEventId}`,
                  conversationId: conversation.id,
                  externalEventId,
                  type: pickConversationEventType(event),
                  actorUserId: actorExternalId
                    ? omniUserIdByExternalAvoUserId.get(actorExternalId) ?? null
                    : null,
                  externalActorId: actorExternalId ?? null,
                  payloadJson: asJsonInput({
                    ...event,
                    actorName,
                    currentAssigneeName,
                    summary,
                    detail,
                  }),
                  createdAt: pickEventTimestamp(event),
                },
              });
              eventsProcessed++;
            }
          }

          writeSyncEvent({
            source: "avochato",
            eventType: "conversation.synced",
            externalId: externalConversationId,
            objectType: "support_conversation",
            objectId: conversation.id,
            action: "synced",
            actorType: "system",
            actorName: account.externalSubdomain ?? account.name,
            payload: {
              account: account.externalSubdomain,
              messages: sorted.length,
            },
          }).catch(() => {});
        } catch (error) {
          errors.push(
            `${account.externalSubdomain ?? account.name} / ${externalConversationId}: ${
              error instanceof Error ? error.message : "unknown"
            }`,
          );
        }
      }
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        recordsProcessed: conversationsProcessed + messagesProcessed + eventsProcessed,
        recordsCreated: 0,
        recordsUpdated: eventsProcessed,
        recordsErrored: errors.length,
        error: errors.length > 0 ? errors.join("\n").slice(0, 5000) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      stats: {
        conversationsProcessed,
        messagesProcessed,
        eventsProcessed,
        errors: errors.length,
      },
      note:
        "This is the first recent-message backfill from Avochato into Omni support tables. It currently derives conversations from ticket/message history and uses deterministic phone-based customer linking where possible.",
    });
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        recordsProcessed: conversationsProcessed + messagesProcessed,
        recordsErrored: errors.length + 1,
        error: error instanceof Error ? error.message : "unknown error",
      },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
        stats: {
          conversationsProcessed,
          messagesProcessed,
        },
      },
      { status: 500 },
    );
  }
}
