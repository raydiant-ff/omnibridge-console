"use server";

import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";

export interface SigningSessionResult {
  sessionId: string | null;
  hasPandaDoc: boolean;
  dryRun: boolean;
  dryRunLog?: string[];
  error?: string;
}

export async function getSigningSession(
  acceptToken: string,
): Promise<SigningSessionResult> {
  const record = await prisma.quoteRecord.findUnique({
    where: { acceptToken },
  });

  if (!record) {
    return { sessionId: null, hasPandaDoc: false, dryRun: false, error: "Quote not found." };
  }

  if (!record.pandadocDocId || !record.signerEmail) {
    return { sessionId: null, hasPandaDoc: false, dryRun: record.dryRun };
  }

  if (record.dryRun) {
    return {
      sessionId: null,
      hasPandaDoc: true,
      dryRun: true,
      dryRunLog: [
        `[DRY RUN] Would create PandaDoc signing session for document ${record.pandadocDocId}`,
        `[DRY RUN] Signer: ${record.signerName} <${record.signerEmail}>`,
        `[DRY RUN] Customer would see embedded signing iframe`,
      ],
    };
  }

  if (flags.useMockPandaDoc) {
    return {
      sessionId: `mock_session_${Date.now()}`,
      hasPandaDoc: true,
      dryRun: false,
    };
  }

  try {
    const { createSigningSession } = await import("@omnibridge/pandadoc");
    const session = await createSigningSession(
      record.pandadocDocId,
      record.signerEmail,
    );
    return {
      sessionId: session.id,
      hasPandaDoc: true,
      dryRun: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sessionId: null,
      hasPandaDoc: true,
      dryRun: false,
      error: `Failed to create signing session: ${msg}`,
    };
  }
}
