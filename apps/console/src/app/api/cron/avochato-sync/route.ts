import { NextResponse } from "next/server";
import {
  Prisma,
  prisma,
  SupportChannel,
  SupportExternalSystem,
} from "@omnibridge/db";
import { listAccounts, listUsers, whoAmI } from "@omnibridge/avochato";
import { writeSyncEvent } from "@/lib/actions/sync-event-log";

export const maxDuration = 300;

function asJsonInput(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const errors: string[] = [];
  let accountsProcessed = 0;
  let endpointsProcessed = 0;
  let accessesProcessed = 0;

  const job = await prisma.syncJob.create({
    data: {
      jobType: "avochato_access_sync",
      status: "running",
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsErrored: 0,
      startedAt,
    },
  });

  try {
    const [identity, accounts, users] = await Promise.all([
      whoAmI(),
      listAccounts(),
      listUsers(),
    ]);

    const omniUser = await prisma.user.findUnique({
      where: { email: identity.user.email.toLowerCase() },
      select: { id: true },
    });

    for (const account of accounts) {
      try {
        const supportAccount = await prisma.supportChannelAccount.upsert({
          where: { externalSubdomain: account.subdomain },
          update: {
            externalAccountId: account.id,
            name: account.name || account.subdomain,
            phone: account.phone,
            metadataJson: asJsonInput(account),
          },
          create: {
            externalSystem: SupportExternalSystem.avochato,
            externalAccountId: account.id,
            externalSubdomain: account.subdomain,
            name: account.name || account.subdomain,
            phone: account.phone,
            metadataJson: asJsonInput(account),
          },
        });
        accountsProcessed++;

        if (account.phone) {
          await prisma.supportChannelEndpoint.upsert({
            where: {
              channelAccountId_externalEndpointId: {
                channelAccountId: supportAccount.id,
                externalEndpointId: account.phone,
              },
            },
            update: {
              channel: SupportChannel.sms,
              label: account.name || account.subdomain,
              address: account.phone,
              active: true,
              metadataJson: asJsonInput(account),
            },
            create: {
              channelAccountId: supportAccount.id,
              externalSystem: SupportExternalSystem.avochato,
              externalEndpointId: account.phone,
              channel: SupportChannel.sms,
              label: account.name || account.subdomain,
              address: account.phone,
              active: true,
              metadataJson: asJsonInput(account),
            },
          });
          endpointsProcessed++;
        }

        if (omniUser) {
          const existingAccess = await prisma.supportAgentChannelAccess.findFirst({
            where: {
              userId: omniUser.id,
              channelAccountId: supportAccount.id,
              channelEndpointId: null,
            },
            select: { id: true },
          });

          if (existingAccess) {
            await prisma.supportAgentChannelAccess.update({
              where: { id: existingAccess.id },
              data: {
                externalUserId: identity.user.id,
                externalRole: "owner",
                assignedOnly: false,
                canReply: true,
                canAssign: true,
              },
            });
          } else {
            await prisma.supportAgentChannelAccess.create({
              data: {
                userId: omniUser.id,
                channelAccountId: supportAccount.id,
                channelEndpointId: null,
                externalUserId: identity.user.id,
                externalRole: "owner",
                assignedOnly: false,
                canReply: true,
                canAssign: true,
              },
            });
          }
          accessesProcessed++;
        }

        writeSyncEvent({
          source: "avochato",
          eventType: "account.synced",
          externalId: account.id,
          objectType: "support_channel_account",
          objectId: supportAccount.id,
          action: "synced",
          actorType: "system",
          actorId: identity.user.id,
          actorName: identity.user.email,
          payload: account,
        }).catch(() => {});
      } catch (error) {
        errors.push(
          `Account ${account.subdomain}: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        recordsProcessed: accountsProcessed + endpointsProcessed + accessesProcessed,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsErrored: errors.length,
        error: errors.length > 0 ? errors.join("\n").slice(0, 5000) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      identity: {
        email: identity.user.email,
        name: identity.user.name,
        accountSubdomain: identity.account.subdomain,
      },
      stats: {
        accountsProcessed,
        endpointsProcessed,
        accessesProcessed,
        usersVisible: users.length,
        errors: errors.length,
      },
      note:
        "This sync bootstraps inbox/account visibility and the current credential's Omni access. Per-agent inbox permissions still need a fuller external-to-Omni mapping strategy.",
    });
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        recordsProcessed: accountsProcessed + endpointsProcessed + accessesProcessed,
        recordsErrored: errors.length + 1,
        error: error instanceof Error ? error.message : "unknown error",
      },
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
        stats: {
          accountsProcessed,
          endpointsProcessed,
          accessesProcessed,
        },
      },
      { status: 500 },
    );
  }
}
