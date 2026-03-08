"use server";

import { prisma } from "@omnibridge/db";

export interface ProductLogEntry {
  id: string;
  source: string;
  action: string;
  productId: string;
  productName: string | null;
  actorType: string;
  actorId: string | null;
  actorLabel: string;
  detail: unknown;
  createdAt: string;
}

export async function getProductLogs(
  source?: string | string[],
  limit = 200,
): Promise<ProductLogEntry[]> {
  const where = Array.isArray(source)
    ? { source: { in: source } }
    : source
      ? { source }
      : undefined;

  const rows = await prisma.productLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const possibleDbIds = rows
    .filter((r) => r.actorType === "user" && r.actorId && isCuid(r.actorId))
    .map((r) => r.actorId!);

  const users =
    possibleDbIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: possibleDbIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  return rows.map((r) => {
    const actorLabel = resolveActorLabel(r, userMap);

    return {
      id: r.id,
      source: r.source,
      action: r.action,
      productId: r.productId,
      productName: r.productName,
      actorType: r.actorType,
      actorId: r.actorId,
      actorLabel,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

function resolveActorLabel(
  row: { actorType: string; actorId: string | null; detail: unknown; source: string },
  userMap: Map<string, string | null>,
): string {
  if (row.actorType === "user" && row.actorId) {
    const fromDb = userMap.get(row.actorId);
    if (fromDb) return fromDb;
  }

  const fromDetail = extractTriggeredBy(row.detail);
  if (fromDetail) return fromDetail;

  if (row.actorId) return row.actorId;

  if (row.source === "omnibridge") return "OmniBridge User";
  if (row.source === "stripe") return "Stripe Dashboard";
  if (row.source === "salesforce") return "Salesforce User";

  return "System";
}

function extractTriggeredBy(detail: unknown): string | null {
  if (detail && typeof detail === "object" && "triggeredBy" in detail) {
    return (detail as { triggeredBy?: string }).triggeredBy ?? null;
  }
  return null;
}

function isCuid(value: string): boolean {
  return /^c[a-z0-9]{24,}$/.test(value);
}
