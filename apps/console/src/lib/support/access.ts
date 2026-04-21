import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";

export class SupportAccessError extends Error {
  readonly status: number;

  constructor(message = "No support channel access found", status = 403) {
    super(message);
    this.name = "SupportAccessError";
    this.status = status;
  }
}

export async function requireSupportAccess() {
  const session = await requireSession();
  const userId = session.user.id;

  const accesses = await prisma.supportAgentChannelAccess.findMany({
    where: {
      userId,
    },
    select: {
      channelAccountId: true,
    },
  });

  const accountIds = [...new Set(accesses.map((access) => access.channelAccountId))];
  if (accountIds.length === 0) {
    throw new SupportAccessError();
  }

  return { userId, accountIds };
}
