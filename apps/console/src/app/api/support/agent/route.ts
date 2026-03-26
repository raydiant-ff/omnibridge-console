import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { generateAnthropicText, resolveAnthropicModel } from "@omnibridge/anthropic";
import { asRecord, asStringArray, getSupportConversationContext, pickConversationDisplayIdentity } from "@/app/(app)/support/shared";

const requestSchema = z.object({
  conversationId: z.string().min(1),
  prompt: z.string().min(1).max(4000),
  model: z.enum(["sonnet", "opus"]).optional(),
});

function formatTimelineItem(item: {
  kind: "message" | "event";
  sentAtIso: string;
  title?: string;
  author?: string;
  role?: string;
  body?: string;
  detail?: string | null;
}) {
  const sentAt = new Date(item.sentAtIso).toISOString();
  if (item.kind === "message") {
    return `- [${sentAt}] ${item.role === "customer" ? "Customer" : "Agent"} (${item.author}): ${item.body}`;
  }

  return `- [${sentAt}] System event: ${item.title}${item.detail ? ` — ${item.detail}` : ""}`;
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const accesses = await prisma.supportAgentChannelAccess.findMany({
    where: { userId: session.user.id },
    select: { channelAccountId: true },
  });
  const accountIds = [...new Set(accesses.map((access) => access.channelAccountId))];

  if (accountIds.length === 0) {
    return NextResponse.json({ error: "No support channel access found" }, { status: 403 });
  }

  const conversation = await prisma.supportConversation.findFirst({
    where: {
      id: parsed.data.conversationId,
      channelAccountId: { in: accountIds },
    },
    include: {
      customer: {
        select: {
          id: true,
          sfAccountName: true,
          sfAccountId: true,
          stripeCustomerId: true,
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
        include: {
          actor: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 40,
      },
      messages: {
        include: {
          author: { select: { name: true, email: true } },
        },
        orderBy: { sentAt: "asc" },
        take: 80,
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const context = await getSupportConversationContext(conversation);
  const rawSummary = asRecord(conversation.rawSummaryJson);
  const assigneeName =
    conversation.assignee?.name ??
    conversation.assignee?.email ??
    (typeof rawSummary?.currentAssigneeName === "string" ? rawSummary.currentAssigneeName : null) ??
    "Unassigned";
  const displayCustomer = pickConversationDisplayIdentity(conversation);

  const timeline = [
    ...conversation.messages.map((message) => ({
      kind: "message" as const,
      sentAtIso: message.sentAt.toISOString(),
      author:
        message.author?.name ??
        message.author?.email ??
        message.fromDisplay ??
        message.fromAddress ??
        (message.direction === "inbound" ? "Customer" : "Agent"),
      role: message.direction === "inbound" ? "customer" : "agent",
      body: message.body ?? message.subject ?? "No message body captured.",
    })),
    ...conversation.events.map((event) => {
      const payload = asRecord(event.payloadJson);
      return {
        kind: "event" as const,
        sentAtIso: event.createdAt.toISOString(),
        title:
          (typeof payload?.summary === "string" && payload.summary.length > 0
            ? payload.summary
            : null) ?? "Conversation updated",
        detail:
          typeof payload?.detail === "string" && payload.detail.length > 0 ? payload.detail : null,
      };
    }),
  ]
    .sort((left, right) => new Date(left.sentAtIso).getTime() - new Date(right.sentAtIso).getTime())
    .slice(-24);

  const systemPrompt = `You are Omni's internal Support AI Agent.

You help support agents reason about customer threads using Omni context from support, billing, and renewal systems.

Rules:
- Use only the provided context. If something is unclear or missing, say so explicitly.
- Separate confirmed facts from inferences.
- Be concise, operational, and calm.
- Do not invent payment outcomes, account ownership, renewal details, or customer history.
- Do not produce legal, contractual, or financial guarantees.
- When useful, recommend the next 1-3 operator steps.
- If asked for a customer-safe draft, write it in a professional support tone and avoid overclaiming.
`;

  const userPrompt = [
    `Operator request: ${parsed.data.prompt}`,
    "",
    "Conversation context:",
    `- Contact: ${displayCustomer}`,
    `- Company: ${conversation.customer?.sfAccountName ?? conversation.customer?.domain ?? "Unlinked"}`,
    `- Linked customer: ${conversation.customer ? "yes" : "no"}`,
    `- Channel: ${conversation.channel}`,
    `- Status: ${conversation.status}`,
    `- Assignee: ${assigneeName}`,
    `- Waiting on: ${conversation.waitingOn ?? "none"}`,
    `- Tags: ${asStringArray(conversation.tagsJson).join(", ") || "none"}`,
    `- MRR: ${context.mrr}`,
    `- Billing: ${context.billing}`,
    `- Renewal: ${context.renewal}`,
    `- CSM: ${context.csm}`,
    "",
    "Recent thread activity:",
    ...timeline.map((item) => formatTimelineItem(item)),
  ].join("\n");

  const result = await generateAnthropicText({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    model: resolveAnthropicModel(parsed.data.model),
    maxTokens: 900,
    temperature: 0.3,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: "support.ai_agent.prompted",
      targetType: "SupportConversation",
      targetId: conversation.id,
      customerId: conversation.customerIndexId ?? undefined,
      payloadJson: {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        stopReason: result.stopReason,
        modelPreset: parsed.data.model ?? "sonnet",
        prompt: parsed.data.prompt,
        responsePreview: result.text.slice(0, 500),
      },
    },
  });

  return NextResponse.json({
    reply: result.text,
    model: result.model,
  });
}
