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
