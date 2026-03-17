"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";

/**
 * Resolve a CustomerIndex ID from an opaque route param.
 *
 * The `/customers/[id]` route uses Salesforce Account IDs (18-char SF format)
 * as the URL param. This helper resolves that to a stable CustomerIndex.id
 * that the projection layer can use.
 *
 * Resolution order:
 * 1. CustomerIndex.sfAccountId match — the common path
 * 2. CustomerIndex.id match — for direct links using internal IDs
 * 3. On-demand upsert — if the SF account exists in the local mirror but
 *    hasn't been mapped to CustomerIndex yet (CustomerIndex is a mapping table;
 *    creating an entry on first access is correct behavior)
 *
 * Returns null if no matching account can be found.
 */
export async function resolveCustomerIndexId(routeId: string): Promise<string | null> {
  await requireSession();

  // 1. SF Account ID path (most common: customer list navigation)
  const byAccountId = await prisma.customerIndex.findUnique({
    where: { sfAccountId: routeId },
    select: { id: true },
  });
  if (byAccountId) return byAccountId.id;

  // 2. Direct CustomerIndex.id path (direct links, internal navigation)
  const byId = await prisma.customerIndex.findUnique({
    where: { id: routeId },
    select: { id: true },
  });
  if (byId) return byId.id;

  // 3. On-demand upsert from SfAccount mirror
  // CustomerIndex is a mapping table — safe to create for any known SF account.
  const sfAccount = await prisma.sfAccount.findUnique({
    where: { id: routeId },
    select: { id: true, name: true, stripeCustomerId: true, domain: true },
  });
  if (!sfAccount) return null;

  // Guard: don't claim a stripeCustomerId already owned by another CustomerIndex row
  const stripeAlreadyMapped = sfAccount.stripeCustomerId
    ? await prisma.customerIndex.findUnique({
        where: { stripeCustomerId: sfAccount.stripeCustomerId },
        select: { id: true },
      })
    : null;

  const entry = await prisma.customerIndex.upsert({
    where: { sfAccountId: sfAccount.id },
    create: {
      sfAccountId: sfAccount.id,
      sfAccountName: sfAccount.name,
      stripeCustomerId:
        !stripeAlreadyMapped && sfAccount.stripeCustomerId
          ? sfAccount.stripeCustomerId
          : undefined,
      domain: sfAccount.domain ?? undefined,
    },
    update: {},
    select: { id: true },
  });

  return entry.id;
}
