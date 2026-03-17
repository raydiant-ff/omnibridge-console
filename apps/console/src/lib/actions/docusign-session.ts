"use server";

import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";

export interface SigningSessionResult {
  signingUrl: string | null;
  integrationKey: string | null;
  jsBundleUrl: string | null;
  hasDocuSign: boolean;
  dryRun: boolean;
  dryRunLog?: string[];
  error?: string;
}

export async function getDocuSignSigningUrl(
  acceptToken: string,
): Promise<SigningSessionResult> {
  const record = await prisma.quoteRecord.findUnique({
    where: { acceptToken },
  });

  if (!record) {
    return {
      signingUrl: null,
      integrationKey: null,
      jsBundleUrl: null,
      hasDocuSign: false,
      dryRun: false,
      error: "Quote not found.",
    };
  }

  if (!record.docusignEnvelopeId || !record.signerEmail) {
    return {
      signingUrl: null,
      integrationKey: null,
      jsBundleUrl: null,
      hasDocuSign: false,
      dryRun: record.dryRun,
    };
  }

  if (record.dryRun) {
    return {
      signingUrl: null,
      integrationKey: null,
      jsBundleUrl: null,
      hasDocuSign: true,
      dryRun: true,
      dryRunLog: [
        `[DRY RUN] Would create DocuSign signing session for envelope ${record.docusignEnvelopeId}`,
        `[DRY RUN] Signer: ${record.signerName} <${record.signerEmail}>`,
        `[DRY RUN] Customer would see DocuSign Focused View`,
      ],
    };
  }

  if (flags.useMockDocuSign) {
    return {
      signingUrl: `https://demo.docusign.net/mock-signing/${Date.now()}`,
      integrationKey: "mock-integration-key",
      jsBundleUrl: "https://js-d.docusign.com/bundle.js",
      hasDocuSign: true,
      dryRun: false,
    };
  }

  try {
    const {
      createRecipientView,
      getIntegrationKey,
      getDocuSignJsBundleUrl,
    } = await import("@omnibridge/docusign");

    const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const returnUrl = `${siteUrl}/accept/${acceptToken}?event=signing_complete`;

    const signingUrl = await createRecipientView({
      envelopeId: record.docusignEnvelopeId,
      signerEmail: record.signerEmail,
      signerName: record.signerName ?? record.customerName,
      returnUrl,
    });

    return {
      signingUrl,
      integrationKey: getIntegrationKey(),
      jsBundleUrl: getDocuSignJsBundleUrl(),
      hasDocuSign: true,
      dryRun: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      signingUrl: null,
      integrationKey: null,
      jsBundleUrl: null,
      hasDocuSign: true,
      dryRun: false,
      error: `Failed to create signing session: ${msg}`,
    };
  }
}
