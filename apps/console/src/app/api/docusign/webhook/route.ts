import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@omnibridge/db";
import { createSfQuoteEvent } from "@/lib/actions/sf-quote-event";

function verifyHmac(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");
  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, signatureBuf);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const hmacSecret = process.env.DOCUSIGN_HMAC_SECRET;
  if (hmacSecret) {
    const sig = request.headers.get("x-docusign-signature-1");
    if (!verifyHmac(rawBody, sig, hmacSecret)) {
      console.warn("[DocuSign Webhook] HMAC verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[DocuSign Webhook] DOCUSIGN_HMAC_SECRET not configured in production");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  } else {
    console.warn("[DocuSign Webhook] HMAC verification skipped — DOCUSIGN_HMAC_SECRET not set");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const envelopeId =
    (payload.data as Record<string, unknown> | undefined)?.envelopeId ??
    (payload as Record<string, unknown>).envelopeId;
  if (typeof envelopeId === "string") {
    const envelopeStatus = (
      ((payload.data as Record<string, unknown> | undefined)?.status ??
        (payload as Record<string, unknown>).status) as string | undefined
    )?.toLowerCase();
    const idempotencyKey = `docusign_webhook:${envelopeId}:${envelopeStatus ?? "unknown"}`;
    try {
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          scope: "docusign_webhook",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json({ received: true, deduplicated: true });
      }
      throw err;
    }
  }

  try {
    await handleEvent(payload);
  } catch (err) {
    console.error("[DocuSign Webhook] Error handling event:", err);
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(payload: Record<string, unknown>) {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const envelopeId = data.envelopeId as string | undefined;
  const envelopeStatus = (data.status as string)?.toLowerCase?.();

  if (!envelopeId) return;

  if (envelopeStatus === "completed") {
    await handleEnvelopeCompleted(envelopeId);
  } else if (envelopeStatus === "declined") {
    await handleEnvelopeDeclined(envelopeId);
  } else if (envelopeStatus === "voided") {
    await handleEnvelopeVoided(envelopeId);
  }
}

async function handleEnvelopeCompleted(envelopeId: string) {
  const record = await prisma.quoteRecord.findFirst({
    where: { docusignEnvelopeId: envelopeId },
  });

  if (!record || record.dryRun) return;

  if (record.status !== "open" && record.status !== "sent") {
    console.log(
      `[DocuSign Webhook] Record ${record.id} already in "${record.status}" — skipping`,
    );
    return;
  }

  console.log(`[DocuSign Webhook] Envelope completed: ${envelopeId}`);

  let pdfUrl: string | null = null;

  try {
    const { downloadSignedDocument } = await import("@omnibridge/docusign");
    const pdfBuffer = await downloadSignedDocument(envelopeId);

    if (record.sfQuoteId) {
      try {
        const { uploadFileToSfRecord } = await import(
          "@/lib/actions/sf-quote-mirror"
        );
        const fileUrl = await uploadFileToSfRecord(
          record.sfQuoteId,
          `Signed_Quote_${record.stripeQuoteId}.pdf`,
          pdfBuffer,
          false,
        );
        pdfUrl = fileUrl;
        console.log(`[DocuSign Webhook] PDF uploaded to SF: ${fileUrl}`);
      } catch (err) {
        console.error("[DocuSign Webhook] SF upload error:", err);
      }
    }
  } catch (err) {
    console.error("[DocuSign Webhook] PDF download error:", err);
  }

  if (record.shippingAddressJson && record.stripeCustomerId) {
    try {
      const shippingAddress = record.shippingAddressJson as Record<string, string>;
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      await stripe.customers.update(record.stripeCustomerId, {
        shipping: {
          name:
            shippingAddress.name ||
            shippingAddress.company ||
            record.customerName,
          phone: shippingAddress.phone || undefined,
          address: {
            line1: shippingAddress.line1,
            line2: shippingAddress.line2 || undefined,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country,
          },
        },
      });
      console.log(
        `[DocuSign Webhook] Shipping address pushed to Stripe customer ${record.stripeCustomerId}`,
      );
    } catch (err) {
      console.error(
        "[DocuSign Webhook] Failed to push shipping to Stripe:",
        err,
      );
    }
  }

  await prisma.quoteRecord.update({
    where: { id: record.id },
    data: { status: "signed", pdfUrl },
  });

  if (record.sfQuoteId) {
    try {
      const { updateSfQuoteStatus } = await import(
        "@/lib/actions/sf-quote-mirror"
      );
      await updateSfQuoteStatus(record.sfQuoteId, "Signed", false);
      console.log(`[DocuSign Webhook] SF quote status updated to Signed`);
    } catch (err) {
      console.error(
        "[DocuSign Webhook] Failed to update SF quote status:",
        err,
      );
    }
  }

  if (record.opportunityId && record.totalAmount) {
    try {
      const { closeOpportunityWon } = await import(
        "@/lib/actions/sf-quote-mirror"
      );
      await closeOpportunityWon(
        record.opportunityId,
        record.totalAmount,
        false,
      );
      console.log(
        `[DocuSign Webhook] Opportunity closed won: ${record.opportunityId}`,
      );
    } catch (err) {
      console.error(
        "[DocuSign Webhook] Failed to close opportunity:",
        err,
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "quote.document_signed",
      targetType: "docusign_envelope",
      targetId: envelopeId,
      actorUserId: null,
      payloadJson: {
        quoteRecordId: record.id,
        stripeQuoteId: record.stripeQuoteId,
        sfQuoteId: record.sfQuoteId,
        pdfUrl,
      },
    },
  });

  if (record.sfQuoteId) {
    createSfQuoteEvent({
      sfQuoteId: record.sfQuoteId,
      action: "quote.document_signed",
      occurredAt: new Date(),
      source: "docusign",
      details: { envelopeId, pdfUrl },
    }).catch((err) =>
      console.error("[SF Event] quote.document_signed failed:", err),
    );
  }

  console.log(
    `[DocuSign Webhook] Document signing recorded for ${record.stripeQuoteId}`,
  );
}

async function handleEnvelopeDeclined(envelopeId: string) {
  const record = await prisma.quoteRecord.findFirst({
    where: { docusignEnvelopeId: envelopeId },
  });

  if (!record || record.dryRun) return;

  console.log(`[DocuSign Webhook] Envelope declined: ${envelopeId}`);

  await prisma.quoteRecord.update({
    where: { id: record.id },
    data: { status: "declined" },
  });

  await prisma.auditLog.create({
    data: {
      action: "quote.document_declined",
      targetType: "docusign_envelope",
      targetId: envelopeId,
      actorUserId: null,
      payloadJson: {
        quoteRecordId: record.id,
        stripeQuoteId: record.stripeQuoteId,
      },
    },
  });
}

async function handleEnvelopeVoided(envelopeId: string) {
  const record = await prisma.quoteRecord.findFirst({
    where: { docusignEnvelopeId: envelopeId },
  });

  if (!record || record.dryRun) return;

  console.log(`[DocuSign Webhook] Envelope voided: ${envelopeId}`);

  await prisma.quoteRecord.update({
    where: { id: record.id },
    data: { status: "voided" },
  });

  await prisma.auditLog.create({
    data: {
      action: "quote.document_voided",
      targetType: "docusign_envelope",
      targetId: envelopeId,
      actorUserId: null,
      payloadJson: {
        quoteRecordId: record.id,
        stripeQuoteId: record.stripeQuoteId,
      },
    },
  });
}
