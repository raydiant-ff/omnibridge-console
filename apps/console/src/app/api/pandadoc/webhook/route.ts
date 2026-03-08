import { NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";

interface PandaDocWebhookEvent {
  event: string;
  data: {
    id: string;
    name: string;
    status: string;
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

export async function POST(request: Request) {
  let events: PandaDocWebhookEvent[];
  try {
    const body = await request.json();
    events = Array.isArray(body) ? body : [body];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error("[PandaDoc Webhook] Error handling event:", err);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: PandaDocWebhookEvent) {
  const documentId = event.data?.id;
  if (!documentId) return;

  if (
    event.event === "document_state_changed" &&
    event.data.status === "document.completed"
  ) {
    await handleDocumentCompleted(documentId);
  }
}

async function handleDocumentCompleted(pandadocDocId: string) {
  const record = await prisma.quoteRecord.findFirst({
    where: { pandadocDocId },
  });

  if (!record || record.dryRun) return;

  try {
    const { getDocumentStatus } = await import("@omnibridge/pandadoc");
    const doc = await getDocumentStatus(pandadocDocId);
    if (doc.status !== "document.completed") {
      console.warn(
        `[PandaDoc Webhook] Document ${pandadocDocId} status is ${doc.status}, expected document.completed — ignoring`,
      );
      return;
    }
  } catch (err) {
    console.error("[PandaDoc Webhook] Failed to verify document status via API:", err);
    return;
  }

  console.log(`[PandaDoc Webhook] Document signed: ${pandadocDocId}, triggering quote acceptance`);

  let pdfUrl: string | null = null;

  // 1. Download and upload PDF
  try {
    const { downloadSignedPdf } = await import("@omnibridge/pandadoc");
    const pdfBuffer = await downloadSignedPdf(pandadocDocId);
    const pdfBytes = Buffer.from(pdfBuffer);

    if (record.sfQuoteId) {
      try {
        const { uploadFileToSfRecord } = await import(
          "@/lib/actions/sf-quote-mirror"
        );
        const fileUrl = await uploadFileToSfRecord(
          record.sfQuoteId,
          `Signed_Quote_${record.stripeQuoteId}.pdf`,
          pdfBytes,
          false,
        );
        pdfUrl = fileUrl;
        console.log(`[PandaDoc Webhook] PDF uploaded to SF: ${fileUrl}`);
      } catch (err) {
        console.error("[PandaDoc Webhook] SF upload error:", err);
      }
    }

    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: { pdfUrl },
    });
  } catch (err) {
    console.error("[PandaDoc Webhook] PDF download error:", err);
  }

  // 2. Validate and sync Stripe customer email before quote acceptance
  if (record.stripeCustomerId && record.sfAccountId) {
    try {
      const { validateStripeCustomerEmail } = await import("@/lib/actions/stripe-customer-sync");
      const emailResult = await validateStripeCustomerEmail(
        record.stripeCustomerId, 
        record.sfAccountId
      );
      
      if (!emailResult.success) {
        console.error(`[PandaDoc Webhook] Customer email validation failed: ${emailResult.error}`);
        return; // Don't proceed with quote acceptance
      }
      
      console.log(`[PandaDoc Webhook] Customer email validated: ${emailResult.updatedEmail}`);
    } catch (err) {
      console.error("[PandaDoc Webhook] Email validation error:", err);
      return;
    }
  }

  // 3. Accept the Stripe quote
  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();
    
    await stripe.quotes.accept(record.stripeQuoteId, {
      collection_method: record.collectionMethod || "send_invoice",
    });
    console.log(`[PandaDoc Webhook] Stripe quote accepted: ${record.stripeQuoteId}`);
  } catch (err) {
    console.error("[PandaDoc Webhook] Failed to accept Stripe quote:", err);
  }

  // 4. Update SF quote status to Signed (not Accepted - avoid quote-based Apex triggers)
  if (record.sfQuoteId) {
    try {
      const { updateSfQuoteStatus } = await import("@/lib/actions/sf-quote-mirror");
      await updateSfQuoteStatus(record.sfQuoteId, "Signed", false);
      console.log(`[PandaDoc Webhook] SF quote status updated to Signed`);
    } catch (err) {
      console.error("[PandaDoc Webhook] Failed to update SF quote status:", err);
    }
  }

  // 5. Stripe subscription creation will trigger separate Apex flow
  // When Stripe quote is accepted, it creates subscriptions automatically
  // Those Stripe subscription webhooks will trigger your existing Apex flow
  console.log(`[PandaDoc Webhook] Stripe subscription webhooks will handle SFDC mirroring`);

  // 6. Close opportunity as won
  if (record.opportunityId && record.totalAmount) {
    try {
      const { closeOpportunityWon } = await import("@/lib/actions/sf-quote-mirror");
      await closeOpportunityWon(record.opportunityId, record.totalAmount, false);
      console.log(`[PandaDoc Webhook] Opportunity closed won: ${record.opportunityId}`);
    } catch (err) {
      console.error("[PandaDoc Webhook] Failed to close opportunity:", err);
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "quote.document_signed",
      targetType: "pandadoc_document",
      targetId: pandadocDocId,
      actorUserId: null,
      payloadJson: {
        quoteRecordId: record.id,
        stripeQuoteId: record.stripeQuoteId,
        sfQuoteId: record.sfQuoteId,
        pdfUrl,
      },
    },
  });

  console.log(`[PandaDoc Webhook] Quote acceptance flow completed for ${record.stripeQuoteId}`);
}
