import { prisma } from "@omnibridge/db";

export function formatMoney(amount: number | null | undefined) {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return "$0";
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(amount)}`;
}

export function formatRenewalDate(date: Date | null | undefined) {
  if (!date) return "No renewal";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function pickConversationDisplayIdentity(conversation: {
  participants: Array<{
    role: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  }>;
  messages: Array<{
    direction: string;
    fromDisplay: string | null;
    fromAddress: string | null;
    toAddress: string | null;
  }>;
}) {
  for (const message of conversation.messages) {
    if (message.direction === "inbound") {
      return message.fromDisplay ?? message.fromAddress ?? "Unknown contact";
    }
  }

  const customerParticipant = conversation.participants.find(
    (participant) =>
      participant.role === "customer" &&
      (participant.name || participant.email || participant.phone),
  );

  if (customerParticipant) {
    return (
      customerParticipant.name ??
      customerParticipant.email ??
      customerParticipant.phone ??
      "Unknown contact"
    );
  }

  for (const message of conversation.messages) {
    if (message.direction === "outbound" && message.toAddress) {
      return message.toAddress;
    }
  }

  return "Unknown contact";
}

export async function getSupportConversationContext(conversation: {
  customerIndexId: string | null;
  stripeCustomerId: string | null;
  assigneeUserId: string | null;
}) {
  if (!conversation.customerIndexId && !conversation.stripeCustomerId) {
    return {
      mrr: "Unlinked",
      billing: "No billing link",
      renewal: "No renewal",
      csm: "Unassigned",
    };
  }

  const [renewal, invoices, activeItems, assignee] = await Promise.all([
    conversation.customerIndexId
      ? prisma.renewal.findFirst({
          where: { customerIndexId: conversation.customerIndexId },
          orderBy: { targetRenewalDate: "asc" },
          select: {
            targetRenewalDate: true,
            owner: { select: { name: true, email: true } },
          },
        })
      : null,
    conversation.stripeCustomerId
      ? prisma.stripeInvoice.findMany({
          where: {
            customerId: conversation.stripeCustomerId,
            status: { in: ["open", "uncollectible"] },
          },
          select: {
            status: true,
            amountDue: true,
          },
        })
      : [],
    conversation.stripeCustomerId
      ? prisma.stripeSubscriptionItem.findMany({
          where: {
            customerId: conversation.stripeCustomerId,
            subscription: {
              status: { in: ["active", "past_due", "trialing"] },
            },
          },
          select: {
            unitAmount: true,
            quantity: true,
          },
        })
      : [],
    conversation.assigneeUserId
      ? prisma.user.findUnique({
          where: { id: conversation.assigneeUserId },
          select: { name: true, email: true },
        })
      : null,
  ]);

  const mrrAmount = activeItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  const pastDueCount = invoices.filter((invoice) => invoice.status === "open").length;
  const billing =
    invoices.length > 0 ? `${pastDueCount} open · ${invoices.length} total` : "Billing healthy";

  return {
    mrr: formatMoney(mrrAmount / 100),
    billing,
    renewal: formatRenewalDate(renewal?.targetRenewalDate),
    csm:
      renewal?.owner?.name ??
      renewal?.owner?.email ??
      assignee?.name ??
      assignee?.email ??
      "Unassigned",
  };
}
