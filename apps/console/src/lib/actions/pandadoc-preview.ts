"use server";

import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";
import {
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
} from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "./quotes";

export interface CreatePandaDocResult {
  success: boolean;
  pandadocDocId?: string;
  error?: string;
}

export async function createPandaDocForQuote(
  quoteRecordId: string,
  signerName: string,
  signerEmail: string,
): Promise<CreatePandaDocResult> {
  const session = await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote record not found." };

  if (record.pandadocDocId) {
    return { success: true, pandadocDocId: record.pandadocDocId };
  }

  const templateId = process.env.PANDADOC_TEMPLATE_ID;
  if (!templateId) {
    return { success: false, error: "PANDADOC_TEMPLATE_ID is not configured." };
  }

  if (record.dryRun) {
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { signerName, signerEmail },
    });
    return { success: true, pandadocDocId: `pd_dryrun_${quoteRecordId.slice(0, 8)}` };
  }

  if (flags.useMockPandaDoc) {
    const mockId = `pd_mock_${Date.now()}`;
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { pandadocDocId: mockId, signerName, signerEmail },
    });
    return { success: true, pandadocDocId: mockId };
  }

  try {
    const lineItems: QuoteLineItem[] = record.lineItemsJson
      ? JSON.parse(record.lineItemsJson)
      : [];

    const paymentTermsLabel = record.paymentTerms ?? "Prepay";
    const currency = record.currency ?? "usd";

    const signerParts = signerName.trim().split(/\s+/);
    const firstName = signerParts[0] ?? "";
    const lastName = signerParts.slice(1).join(" ") || firstName;

    const pricingRows = lineItems.map((li) => {
      const listPrice = li.unitAmount / 100;
      const hasDiscount =
        li.overrideUnitAmount != null && li.overrideUnitAmount < li.unitAmount;
      const discountAmount = hasDiscount
        ? (li.unitAmount - li.overrideUnitAmount!) / 100
        : 0;

      return {
        options: { optional: false, optional_selected: false, qty_editable: false },
        data: {
          Name: li.productName,
          Description: `${li.nickname} — ${li.interval}`,
          Price: listPrice,
          QTY: li.quantity,
          ...(hasDiscount
            ? { Discount: { value: discountAmount, type: "absolute" as const } }
            : {}),
        },
      };
    });

    const dateFmt = (d: Date | null | undefined) =>
      d?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "N/A";

    const contractTermLabel = record.contractTerm
      ? CONTRACT_TERM_LABELS[record.contractTerm as ContractTerm] ?? record.contractTerm
      : "N/A";

    const billingFreqLabel = record.billingFrequency
      ? BILLING_FREQUENCY_LABELS[record.billingFrequency as BillingFrequency] ?? record.billingFrequency
      : "N/A";

    const collectionLabel =
      record.collectionMethod === "send_invoice" ? "Invoice" : "Prepay";

    const tokens = [
      { name: "Opportunity Number", value: record.opportunityId || "N/A" },
      { name: "Quote Number", value: record.stripeQuoteId },
      { name: "Payment Terms", value: paymentTermsLabel },
      { name: "Quote Date", value: dateFmt(new Date()) },
      { name: "Expiry Date", value: dateFmt(record.expiresAt) },
      { name: "Customer Name", value: record.customerName },
      { name: "Sales Rep", value: signerName },
      { name: "Contract Term", value: contractTermLabel },
      { name: "Billing Frequency", value: billingFreqLabel },
      { name: "Contract End Date", value: dateFmt(record.contractEndDate) },
      { name: "Collection Method", value: collectionLabel },
    ];

    const {
      createDocumentFromTemplate,
      waitForDocumentDraft,
      getDocumentDetails,
    } = await import("@omnibridge/pandadoc");

    const doc = await createDocumentFromTemplate({
      templateId,
      name: `Quote — ${record.customerName} — ${record.stripeQuoteId}`,
      recipients: [
        {
          email: signerEmail,
          first_name: firstName,
          last_name: lastName,
          role: "Client",
        },
      ],
      tokens,
      pricingTables: [
        {
          name: "Pricing Table 1",
          data_merge: true,
          options: { currency: currency.toUpperCase() },
          sections: [
            {
              title: "Products",
              default: true,
              rows: pricingRows,
            },
          ],
        },
      ],
      metadata: {
        source: "displai_omni",
        stripe_quote_id: record.stripeQuoteId,
      },
      tags: ["displai_omni", "quote"],
    });

    await waitForDocumentDraft(doc.id);

    try {
      const totalAmount = record.totalAmount ?? 0;
      const expectedTotal = totalAmount / 100;
      const details = await getDocumentDetails(doc.id);
      const pdGrandTotal = parseFloat(details.grand_total?.amount ?? "0");
      if (Math.abs(pdGrandTotal - expectedTotal) > 0.01) {
        console.warn(
          `[PandaDoc] PRICE MISMATCH — PandaDoc $${pdGrandTotal.toFixed(2)} vs Stripe $${expectedTotal.toFixed(2)}`,
        );
      }
    } catch {
      // price validation is best-effort
    }

    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { pandadocDocId: doc.id, signerName, signerEmail },
    });

    if (!record.dryRun) {
      try {
        const { getStripeClient } = await import("@omnibridge/stripe");
        const stripe = getStripeClient();
        await stripe.quotes.update(record.stripeQuoteId, {
          metadata: { pandadoc_doc_id: doc.id },
        });
      } catch (err) {
        console.warn("[PandaDoc] Failed to push pandadoc_doc_id to Stripe metadata:", err);
      }

      if (record.sfQuoteId) {
        try {
          const { updateSObject } = await import("@omnibridge/salesforce");
          await updateSObject("Stripe_Quote__c", record.sfQuoteId, {
            PandaDoc_Document_ID__c: doc.id,
          });
        } catch (err) {
          console.warn("[PandaDoc] Failed to push PandaDoc_Document_ID__c to SF:", err);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "quote.pandadoc_created",
        targetType: "pandadoc_document",
        targetId: doc.id,
        payloadJson: { quoteRecordId, pandadocDocId: doc.id, signerName, signerEmail },
      },
    });

    return { success: true, pandadocDocId: doc.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create PandaDoc document: ${msg}` };
  }
}

export interface DocumentPdfResult {
  success: boolean;
  pdfBase64?: string;
  error?: string;
}

export async function getDocumentPdf(
  pandadocDocId: string,
): Promise<DocumentPdfResult> {
  await requireSession();

  if (!pandadocDocId) {
    return { success: false, error: "No PandaDoc document ID." };
  }

  if (flags.useMockPandaDoc) {
    return { success: true, pdfBase64: "" };
  }

  try {
    const { downloadDocumentPdf } = await import("@omnibridge/pandadoc");
    const buffer = await downloadDocumentPdf(pandadocDocId);
    const base64 = Buffer.from(buffer).toString("base64");
    return { success: true, pdfBase64: base64 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to download PDF: ${msg}` };
  }
}

export interface EditingSessionResult {
  success: boolean;
  token?: string;
  error?: string;
}

export async function getDocumentEditingSession(
  pandadocDocId: string,
): Promise<EditingSessionResult> {
  const session = await requireSession();

  if (!pandadocDocId) {
    return { success: false, error: "No PandaDoc document ID." };
  }

  if (flags.useMockPandaDoc) {
    return { success: true, token: `mock_etoken_${Date.now()}` };
  }

  const editorEmail = process.env.PANDADOC_EDITOR_EMAIL ?? session.user.email;
  if (!editorEmail) {
    return { success: false, error: "No editor email available for editing session." };
  }

  try {
    const { createDocumentEditingSession } = await import("@omnibridge/pandadoc");
    const editSession = await createDocumentEditingSession(pandadocDocId, editorEmail);
    return { success: true, token: editSession.token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create editing session: ${msg}` };
  }
}

export interface SendDocumentResult {
  success: boolean;
  error?: string;
}

export async function sendPandaDocAfterPreview(
  pandadocDocId: string,
  quoteRecordId: string,
): Promise<SendDocumentResult> {
  const session = await requireSession();

  if (!pandadocDocId) {
    return { success: false, error: "No PandaDoc document ID." };
  }

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) {
    return { success: false, error: "Quote record not found." };
  }

  if (record.dryRun) {
    return { success: true };
  }

  if (flags.useMockPandaDoc) {
    return { success: true };
  }

  try {
    const { sendDocument } = await import("@omnibridge/pandadoc");
    await sendDocument(
      pandadocDocId,
      false,
      `Your quote from Displai`,
      "Please review and sign the attached quote.",
    );

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "quote.pandadoc_sent",
        targetType: "pandadoc_document",
        targetId: pandadocDocId,
        payloadJson: { quoteRecordId, pandadocDocId },
      },
    });

    if (record.sfQuoteId) {
      try {
        const { updateSfQuoteStatus } = await import("./sf-quote-mirror");
        await updateSfQuoteStatus(record.sfQuoteId, "Sent", false);
      } catch (err) {
        console.warn("[PandaDoc] Failed to update SF quote status to Sent:", err);
      }
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to send document: ${msg}` };
  }
}
