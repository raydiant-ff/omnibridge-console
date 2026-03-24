import { prisma } from "@omnibridge/db";

function buildFrequencyMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export async function ensureCustomerIndexCoverage(): Promise<void> {
  const sfAccounts = await prisma.sfAccount.findMany({
    where: { isStub: false },
    select: {
      id: true,
      name: true,
      domain: true,
      stripeCustomerId: true,
    },
  });

  if (sfAccounts.length === 0) return;

  const sfAccountIds = sfAccounts.map((account) => account.id);
  const stripeIds = sfAccounts
    .map((account) => account.stripeCustomerId)
    .filter((id): id is string => id != null);

  const existingEntries = await prisma.customerIndex.findMany({
    where: {
      OR: [
        { sfAccountId: { in: sfAccountIds } },
        ...(stripeIds.length > 0 ? [{ stripeCustomerId: { in: stripeIds } }] : []),
      ],
    },
    select: {
      id: true,
      sfAccountId: true,
      stripeCustomerId: true,
    },
  });

  const existingBySfAccountId = new Map(
    existingEntries
      .filter((entry): entry is typeof entry & { sfAccountId: string } => entry.sfAccountId != null)
      .map((entry) => [entry.sfAccountId, entry]),
  );
  const existingByStripeCustomerId = new Map(
    existingEntries
      .filter((entry): entry is typeof entry & { stripeCustomerId: string } => entry.stripeCustomerId != null)
      .map((entry) => [entry.stripeCustomerId, entry]),
  );

  const stripeIdFrequency = buildFrequencyMap(stripeIds);

  const missingAccounts = sfAccounts.filter((account) => !existingBySfAccountId.has(account.id));
  if (missingAccounts.length > 0) {
    await prisma.customerIndex.createMany({
      data: missingAccounts.map((account) => ({
        sfAccountId: account.id,
        sfAccountName: account.name,
        domain: account.domain,
        stripeCustomerId:
          account.stripeCustomerId &&
          !existingByStripeCustomerId.has(account.stripeCustomerId) &&
          (stripeIdFrequency.get(account.stripeCustomerId) ?? 0) === 1
            ? account.stripeCustomerId
            : undefined,
      })),
      skipDuplicates: true,
    });
  }

  const staleEntries = sfAccounts.filter((account) => existingBySfAccountId.has(account.id));

  for (const account of staleEntries) {
    const entry = existingBySfAccountId.get(account.id);
    if (!entry) continue;

    const canAttachStripe =
      !!account.stripeCustomerId &&
      !entry.stripeCustomerId &&
      !existingByStripeCustomerId.has(account.stripeCustomerId) &&
      (stripeIdFrequency.get(account.stripeCustomerId) ?? 0) === 1;

    await prisma.customerIndex.update({
      where: { id: entry.id },
      data: {
        sfAccountName: account.name,
        domain: account.domain,
        ...(canAttachStripe ? { stripeCustomerId: account.stripeCustomerId } : {}),
      },
    });
  }
}
