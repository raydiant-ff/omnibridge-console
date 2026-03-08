import { prisma } from "@omnibridge/db";

export type ProductLogSource = "stripe" | "salesforce" | "omnibridge";
export type ProductLogAction =
  | "created"
  | "deactivated"
  | "activated"
  | "updated"
  | "deleted";
export type ProductLogActorType = "webhook" | "system" | "user";

interface WriteProductLogInput {
  source: ProductLogSource;
  action: ProductLogAction;
  productId: string;
  productName?: string;
  actorType: ProductLogActorType;
  actorId?: string;
  detail?: unknown;
}

export async function writeProductLog(entry: WriteProductLogInput) {
  try {
    await prisma.productLog.create({
      data: {
        source: entry.source,
        action: entry.action,
        productId: entry.productId,
        productName: entry.productName ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        detail: entry.detail ?? undefined,
      },
    });

    sendSlackAlert(entry).catch(() => {});
  } catch (err) {
    console.error("[ProductLog] Failed to write log entry:", err);
  }
}

const SOURCE_EMOJI: Record<string, string> = {
  stripe: "💳",
  salesforce: "☁️",
  omnibridge: "🌉",
};

const ACTION_EMOJI: Record<string, string> = {
  created: "🟢",
  activated: "✅",
  deactivated: "🔴",
  deleted: "❌",
  updated: "🔄",
};

async function sendSlackAlert(entry: WriteProductLogInput) {
  const webhookUrl = process.env.SLACK_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const sourceEmoji = SOURCE_EMOJI[entry.source] ?? "📦";
  const actionEmoji = ACTION_EMOJI[entry.action] ?? "📝";
  const actor = entry.actorId ?? (entry.actorType === "user" ? "Unknown user" : "System");
  const productName = entry.productName ?? "Unknown product";

  const detail = entry.detail && typeof entry.detail === "object" ? entry.detail as Record<string, unknown> : {};

  const sfProductId = entry.source === "salesforce"
    ? entry.productId
    : (detail.sfProductId as string | undefined) ?? "—";
  const stripeProductId = entry.source === "stripe" || entry.source === "omnibridge"
    ? entry.productId
    : (detail.stripeProductId as string | undefined) ?? "—";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${actionEmoji} Product ${entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Product:*\n${productName}` },
        { type: "mrkdwn", text: `*Platform:*\n${sourceEmoji} ${entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}` },
        { type: "mrkdwn", text: `*Stripe ID:*\n\`${stripeProductId}\`` },
        { type: "mrkdwn", text: `*Salesforce ID:*\n\`${sfProductId}\`` },
        { type: "mrkdwn", text: `*Actor:*\n${actor}` },
        { type: "mrkdwn", text: `*Action:*\n${entry.action}` },
      ],
    },
  ];

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
  } catch (err) {
    console.error("[Slack] Failed to send product alert:", err);
  }
}
