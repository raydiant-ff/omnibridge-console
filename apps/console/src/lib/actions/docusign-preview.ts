"use server";

import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";
import { downloadStripeQuotePdf } from "./stripe-quote-pdf";
import { finalizeStripeQuote } from "./quotes";

export interface PreparePdfResult {
  success: boolean;
  pdfBase64?: string;
  error?: string;
}

export async function preparePdfForPreview(
  quoteRecordId: string,
  signerName: string,
  signerEmail: string,
): Promise<PreparePdfResult> {
  await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote record not found." };

  await prisma.quoteRecord.update({
    where: { id: quoteRecordId },
    data: { signerName, signerEmail },
  });

  const isDryRun = record.dryRun;
  const isCoTerm = record.quoteType === "co_term";

  if (isDryRun) {
    return { success: true, pdfBase64: "" };
  }

  if (isCoTerm) {
    const { generateCoTermPdf } = await import("./co-term-pdf");
    const pdfBuffer = await generateCoTermPdf(record);
    return { success: true, pdfBase64: pdfBuffer.toString("base64") };
  }

  if (!flags.useMockStripe) {
    const finResult = await finalizeStripeQuote(quoteRecordId);
    if (!finResult.success) {
      return { success: false, error: finResult.error ?? "Failed to finalize Stripe quote." };
    }
  }

  try {
    const pdfBuffer = await downloadStripeQuotePdf(record.stripeQuoteId);
    return { success: true, pdfBase64: pdfBuffer.toString("base64") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to download PDF: ${msg}` };
  }
}

export interface CreateEnvelopeResult {
  success: boolean;
  envelopeId?: string;
  error?: string;
}

export async function createAndSendEnvelope(
  quoteRecordId: string,
): Promise<CreateEnvelopeResult> {
  await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote record not found." };

  if (record.docusignEnvelopeId) {
    return { success: true, envelopeId: record.docusignEnvelopeId };
  }

  if (!record.signerName || !record.signerEmail) {
    return { success: false, error: "Signer name and email are required." };
  }

  const isDryRun = record.dryRun;
  if (isDryRun) {
    const mockId = `ds_dryrun_${quoteRecordId.slice(0, 8)}`;
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { docusignEnvelopeId: mockId },
    });
    return { success: true, envelopeId: mockId };
  }

  const useMock = flags.useMockDocuSign;
  if (useMock) {
    const mockId = `ds_mock_${Date.now().toString(36)}`;
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { docusignEnvelopeId: mockId },
    });
    return { success: true, envelopeId: mockId };
  }

  try {
    const isCoTerm = record.quoteType === "co_term";
    let pdfBuffer: Buffer;

    if (isCoTerm) {
      const { generateCoTermPdf } = await import("./co-term-pdf");
      pdfBuffer = await generateCoTermPdf(record);
    } else {
      pdfBuffer = await downloadStripeQuotePdf(record.stripeQuoteId);
    }

    const webhookBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000";
    const webhookUrl = `${webhookBaseUrl}/api/docusign/webhook`;
    if (
      process.env.NODE_ENV === "production" &&
      !webhookUrl.startsWith("https://")
    ) {
      throw new Error(
        "DocuSign requires HTTPS for webhook URLs. Set NEXT_PUBLIC_BASE_URL to your production HTTPS origin.",
      );
    }

    const { createEnvelope } = await import("@omnibridge/docusign");
    const envelopeId = await createEnvelope({
      pdfBuffer,
      signerEmail: record.signerEmail,
      signerName: record.signerName,
      emailSubject: `Displai Quote for ${record.customerName}`,
      documentName: `Quote_${record.stripeQuoteId}.pdf`,
      webhookUrl,
      customFields: {
        quoteRecordId: record.id,
        stripeQuoteId: record.stripeQuoteId,
      },
    });

    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { docusignEnvelopeId: envelopeId },
    });

    return { success: true, envelopeId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create DocuSign envelope: ${msg}` };
  }
}

export async function getDocumentEditingSession(
  _docId: string,
): Promise<{ success: boolean; token?: string; error?: string }> {
  return { success: false, error: "Editing sessions are not supported with DocuSign. Use the PDF preview instead." };
}
