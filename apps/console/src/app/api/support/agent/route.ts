import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { generateAnthropicText, resolveAnthropicModel } from "@omnibridge/anthropic";
import { getSupportCustomerContexts } from "@/lib/projections/support-customer-context";
import { SupportAccessError } from "@/lib/support/access";
import { getSupportConversationDetail } from "@/lib/support/detail";

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

  try {
    const conversation = await getSupportConversationDetail(parsed.data.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const contextMap = await getSupportCustomerContexts([
      {
        key: conversation.id,
        customerIndexId: conversation.customerIndexId,
        stripeCustomerId: conversation.stripeCustomerId,
      },
    ]);
    const context = contextMap.get(conversation.id) ?? {
      mrr: "Unlinked",
      billing: "No billing link",
      renewal: "No renewal",
      renewalOwner: null,
    };
    const timeline = conversation.timeline.slice(-24);

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
      `- Contact: ${conversation.customer}`,
      `- Company: ${conversation.company || "Unlinked"}`,
      `- Linked customer: ${conversation.linkedCustomer ? "yes" : "no"}`,
      `- Channel: ${conversation.channel}`,
      `- Status: ${conversation.status}`,
      `- Assignee: ${conversation.assignee}`,
      `- Waiting on: ${conversation.waitingOn ?? "none"}`,
      `- Tags: ${conversation.tags.join(", ") || "none"}`,
      `- MRR: ${context.mrr}`,
      `- Billing: ${context.billing}`,
      `- Renewal: ${context.renewal}`,
      `- CSM: ${context.renewalOwner?.name ?? context.renewalOwner?.email ?? conversation.assignee}`,
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
  } catch (error) {
    if (error instanceof SupportAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
