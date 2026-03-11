"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";

export interface QuoteRow {
  id: string;
  stripeQuoteId: string;
  acceptToken: string;
  customerName: string;
  stripeCustomerId: string;
  collectionMethod: string;
  status: string;
  totalAmount: number | null;
  currency: string;
  expiresAt: string | null;
  createdByName: string | null;
  createdAt: string;
  sfQuoteId: string | null;
  docusignEnvelopeId: string | null;
  stripeSubscriptionId: string | null;
}

export interface QuoteDetail extends QuoteRow {
  sfAccountId: string | null;
  opportunityId: string | null;
  sfQuoteNumber: string | null;
  stripeQuoteNumber: string | null;
  stripeCustomerId: string;
  stripeScheduleId: string | null;
  stripeSubItemIds: unknown;
  sfContractId: string | null;
  sfSubscriptionIds: unknown;
  contractTerm: string | null;
  billingFrequency: string | null;
  contractEndDate: string | null;
  acceptedAt: string | null;
  lineItemsJson: unknown;
}

export interface AuditTimelineEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorName: string | null;
  payloadJson: unknown;
  createdAt: string;
}

export async function getMyQuotes(): Promise<QuoteRow[]> {
  const session = await requireSession();
  const userId = session.user.id;

  const rows = await prisma.quoteRecord.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { creator: { select: { name: true, email: true } } },
  });

  return rows.map(mapRow);
}

export async function getAllQuotes(): Promise<QuoteRow[]> {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") {
    throw new Error("Forbidden: admin access required.");
  }

  const rows = await prisma.quoteRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { creator: { select: { name: true, email: true } } },
  });

  return rows.map(mapRow);
}

export async function getQuoteDetail(
  quoteRecordId: string,
): Promise<QuoteDetail | null> {
  await requireSession();

  const row = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
    include: { creator: { select: { name: true, email: true } } },
  });

  if (!row) return null;

  return {
    ...mapRow(row),
    sfAccountId: row.sfAccountId,
    opportunityId: row.opportunityId,
    sfQuoteNumber: row.sfQuoteNumber,
    stripeQuoteNumber: row.stripeQuoteNumber,
    stripeCustomerId: row.stripeCustomerId,
    stripeScheduleId: row.stripeScheduleId,
    stripeSubItemIds: row.stripeSubItemIds,
    sfContractId: row.sfContractId,
    sfSubscriptionIds: row.sfSubscriptionIds,
    contractTerm: row.contractTerm,
    billingFrequency: row.billingFrequency,
    contractEndDate: row.contractEndDate?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    lineItemsJson: row.lineItemsJson,
  };
}

export async function getQuoteAuditTimeline(
  quoteRecordId: string,
): Promise<AuditTimelineEntry[]> {
  await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
    select: { stripeQuoteId: true },
  });
  if (!record) return [];

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { targetId: record.stripeQuoteId },
        { payloadJson: { path: ["quoteRecordId"], equals: quoteRecordId } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true, email: true } } },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    actorName: log.actor?.name ?? log.actor?.email ?? null,
    payloadJson: log.payloadJson,
    createdAt: log.createdAt.toISOString(),
  }));
}

function mapRow(row: {
  id: string;
  stripeQuoteId: string;
  acceptToken: string;
  customerName: string;
  stripeCustomerId: string;
  collectionMethod: string;
  status: string;
  totalAmount: number | null;
  currency: string;
  expiresAt: Date | null;
  createdAt: Date;
  sfQuoteId: string | null;
  docusignEnvelopeId: string | null;
  stripeSubscriptionId: string | null;
  creator: { name: string | null; email: string };
}): QuoteRow {
  return {
    id: row.id,
    stripeQuoteId: row.stripeQuoteId,
    acceptToken: row.acceptToken,
    customerName: row.customerName,
    stripeCustomerId: row.stripeCustomerId,
    collectionMethod: row.collectionMethod,
    status: row.status,
    totalAmount: row.totalAmount,
    currency: row.currency,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdByName: row.creator.name ?? row.creator.email,
    createdAt: row.createdAt.toISOString(),
    sfQuoteId: row.sfQuoteId,
    docusignEnvelopeId: row.docusignEnvelopeId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}
