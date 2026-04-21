import { formatDistanceToNowStrict } from "date-fns";
import { prisma } from "@omnibridge/db";
import { getSupportCustomerContexts } from "@/lib/projections/support-customer-context";
import { SupportAccessError, requireSupportAccess } from "@/lib/support/access";
import { asRecord, asStringArray, pickConversationDisplayIdentity } from "@/lib/support/format";
import type { SupportWorkspaceConversationSummary } from "./types";

function statusToWorkspace(value: string): SupportWorkspaceConversationSummary["status"] {
  if (value === "pending_customer") return "pending_customer";
  if (value === "pending_internal") return "pending_internal";
  return "open";
}

function priorityToWorkspace(value: string): SupportWorkspaceConversationSummary["priority"] {
  if (value === "urgent") return "urgent";
  if (value === "high") return "high";
  return "normal";
}

function channelToWorkspace(value: string): SupportWorkspaceConversationSummary["channel"] {
  if (value === "email") return "email";
  if (value === "chat") return "chat";
  return "sms";
}

export async function getSupportWorkspaceData(): Promise<SupportWorkspaceConversationSummary[]> {
  let accountIds: string[];
  try {
    ({ accountIds } = await requireSupportAccess());
  } catch (error) {
    if (error instanceof SupportAccessError) {
      return [];
    }
    throw error;
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
        select: {
          role: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const latestMessages = conversations.length > 0
    ? await prisma.supportMessage.findMany({
        where: {
          conversationId: {
            in: conversations.map((conversation) => conversation.id),
          },
        },
        orderBy: [{ conversationId: "asc" }, { sentAt: "desc" }],
        distinct: ["conversationId"],
        select: {
          conversationId: true,
          direction: true,
          body: true,
          subject: true,
          fromDisplay: true,
          fromAddress: true,
          toAddress: true,
        },
      })
    : [];

  const contexts = await getSupportCustomerContexts(
    conversations.map((conversation) => ({
      key: conversation.id,
      customerIndexId: conversation.customerIndexId,
      stripeCustomerId: conversation.stripeCustomerId,
    })),
  );
  const latestMessageByConversationId = new Map(
    latestMessages.map((message) => [message.conversationId, message]),
  );

  const mapped = conversations.map((conversation) => {
      const latestMessage = latestMessageByConversationId.get(conversation.id);
      const context = contexts.get(conversation.id) ?? {
        mrr: "Unlinked",
        billing: "No billing link",
        renewal: "No renewal",
        renewalOwner: null,
      };
      const rawSummary = asRecord(conversation.rawSummaryJson);
      const assigneeName =
        conversation.assignee?.name ??
        conversation.assignee?.email ??
        (typeof rawSummary?.currentAssigneeName === "string" ? rawSummary.currentAssigneeName : null) ??
        "Unassigned";
      const displayCustomer = pickConversationDisplayIdentity({
        participants: conversation.participants,
        messages: latestMessage ? [latestMessage] : [],
      });

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
        csm:
          context.renewalOwner?.name ??
          context.renewalOwner?.email ??
          assigneeName ??
          "Unassigned",
      } satisfies SupportWorkspaceConversationSummary;
    });

  return mapped;
}
