import { formatDistanceToNowStrict } from "date-fns";
import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { asRecord, asStringArray, getSupportConversationContext, pickConversationDisplayIdentity } from "./shared";
import type { SupportWorkspaceConversation, SupportWorkspaceTimelineItem } from "./types";

function statusToWorkspace(value: string): SupportWorkspaceConversation["status"] {
  if (value === "pending_customer") return "pending_customer";
  if (value === "pending_internal") return "pending_internal";
  return "open";
}

function priorityToWorkspace(value: string): SupportWorkspaceConversation["priority"] {
  if (value === "urgent") return "urgent";
  if (value === "high") return "high";
  return "normal";
}

function channelToWorkspace(value: string): SupportWorkspaceConversation["channel"] {
  if (value === "email") return "email";
  if (value === "chat") return "chat";
  return "sms";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimelineEvent(event: {
  id: string;
  type: string;
  createdAt: Date;
  payloadJson: unknown;
  actor: { name: string | null; email: string | null } | null;
}): SupportWorkspaceTimelineItem {
  const payload = asRecord(event.payloadJson);
  const actorName =
    event.actor?.name ??
    event.actor?.email ??
    (typeof payload?.actorName === "string" ? payload.actorName : null);
  const title =
    (typeof payload?.summary === "string" && payload.summary.length > 0
      ? payload.summary
      : null) ??
    (event.type === "assigned"
      ? "Ownership updated"
      : event.type === "priority_changed"
        ? "Priority updated"
        : event.type === "tagged"
          ? "Tags updated"
          : "Conversation updated");
  const detail =
    typeof payload?.detail === "string" && payload.detail.length > 0 ? payload.detail : null;

  return {
    id: event.id,
    kind: "event",
    sentAt: formatTime(event.createdAt),
    sentAtIso: event.createdAt.toISOString(),
    title,
    detail,
    actor: actorName,
  };
}


export async function getSupportWorkspaceData(): Promise<SupportWorkspaceConversation[]> {
  const session = await requireSession();
  const userId = session.user.id;

  const accesses = await prisma.supportAgentChannelAccess.findMany({
    where: {
      userId,
    },
    select: {
      channelAccountId: true,
      channelEndpointId: true,
    },
  });

  const accountIds = [...new Set(accesses.map((access) => access.channelAccountId))];
  if (accountIds.length === 0) {
    return [];
  }

  const conversations = await prisma.supportConversation.findMany({
    where: {
      channelAccountId: { in: accountIds },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: {
      customer: {
        select: {
          sfAccountName: true,
          domain: true,
        },
      },
      assignee: {
        select: { name: true, email: true },
      },
      participants: {
        orderBy: { createdAt: "asc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        take: 100,
      },
    },
  });

  const mapped = await Promise.all(
    conversations.map(async (conversation) => {
      const latestMessage = conversation.messages[conversation.messages.length - 1];
      const context = await getSupportConversationContext(conversation);
      const rawSummary = asRecord(conversation.rawSummaryJson);
      const assigneeName =
        conversation.assignee?.name ??
        conversation.assignee?.email ??
        (typeof rawSummary?.currentAssigneeName === "string" ? rawSummary.currentAssigneeName : null) ??
        "Unassigned";
      const timeline = [
        ...conversation.messages.map((message) => ({
          id: message.id,
          kind: "message" as const,
          author:
            message.author?.name ??
            message.author?.email ??
            message.fromDisplay ??
            message.fromAddress ??
            (message.direction === "inbound" ? "Customer" : "Agent"),
          role: message.direction === "inbound" ? "customer" as const : "agent" as const,
          sentAt: formatTime(message.sentAt),
          sentAtIso: message.sentAt.toISOString(),
          body: message.body ?? message.subject ?? "No message body captured.",
        })),
        ...conversation.events.map((event) => formatTimelineEvent(event)),
      ].sort((left, right) => {
        return new Date(left.sentAtIso).getTime() - new Date(right.sentAtIso).getTime();
      });
      const displayCustomer = pickConversationDisplayIdentity(conversation);

      return {
        id: conversation.id,
        customer: displayCustomer,
        company:
          conversation.customer?.sfAccountName ??
          conversation.customer?.domain ??
          "",
        linkedCustomer: Boolean(
          conversation.customerIndexId ??
            conversation.sfAccountId ??
            conversation.stripeCustomerId,
        ),
        subject:
          conversation.subject ??
          latestMessage?.body?.slice(0, 96) ??
          "Support conversation",
        preview:
          latestMessage?.body ??
          latestMessage?.subject ??
          "No message preview available yet.",
        channel: channelToWorkspace(conversation.channel),
        status: statusToWorkspace(conversation.status),
        priority: priorityToWorkspace(conversation.priority),
        assignee: assigneeName,
        lastActivity: formatDistanceToNowStrict(conversation.lastMessageAt, { addSuffix: true }),
        waitingOn:
          conversation.waitingOn === "customer"
            ? "customer"
            : conversation.waitingOn === "internal"
              ? "internal"
              : "none",
        tags: asStringArray(conversation.tagsJson),
        mrr: context.mrr,
        billing: context.billing,
        renewal: context.renewal,
        csm: context.csm,
        messages: timeline.filter((item): item is SupportWorkspaceConversation["messages"][number] => item.kind === "message"),
        timeline,
      } satisfies SupportWorkspaceConversation;
    }),
  );

  return mapped;
}
