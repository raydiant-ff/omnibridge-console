"use server";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface QuoteRecordLike {
  customerName: string;
  stripeQuoteId: string;
  contractTerm?: string | null;
  billingFrequency?: string | null;
  effectiveTiming?: string | null;
  prorationAmountCents?: number | null;
  lineItemsJson?: unknown;
  existingItemsJson?: unknown;
  parentSubscriptionId?: string | null;
  currency: string;
  totalAmount?: number | null;
  contractEndDate?: Date | null;
}

interface LineItem {
  productName: string;
  quantity: number;
  unitAmount: number;
  overrideUnitAmount?: number;
  interval: string;
  currency: string;
}

interface ExistingItem {
  productName: string;
  quantity: number;
  unitAmount: number;
  interval: string;
}

function fmt(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

const TIMING_LABELS: Record<string, string> = {
  immediate: "Immediately (charge now)",
  next_invoice: "Immediately (proration on next invoice)",
  end_of_cycle: "At next billing cycle",
};

export async function generateCoTermPdf(
  record: QuoteRecordLike,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  function drawText(
    text: string,
    x: number,
    yPos: number,
    size: number,
    f = font,
    color = black,
  ) {
    page.drawText(text, { x, y: yPos, size, font: f, color });
  }

  // Header
  drawText("Displai Systems, Inc.", margin, y, 10, font, gray);
  y -= 30;
  drawText("Subscription Amendment", margin, y, 18, fontBold);
  y -= 24;
  drawText(`Customer: ${record.customerName}`, margin, y, 11);
  y -= 16;
  drawText(`Reference: ${record.stripeQuoteId}`, margin, y, 9, font, gray);
  y -= 16;

  if (record.parentSubscriptionId) {
    drawText(
      `Subscription: ${record.parentSubscriptionId}`,
      margin,
      y,
      9,
      font,
      gray,
    );
    y -= 16;
  }

  if (record.contractEndDate) {
    drawText(
      `Contract End: ${record.contractEndDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      margin,
      y,
      9,
      font,
      gray,
    );
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 20;

  // Timing
  const timing = record.effectiveTiming ?? "immediate";
  drawText("Effective Timing", margin, y, 12, fontBold);
  y -= 16;
  drawText(TIMING_LABELS[timing] ?? timing, margin, y, 10);
  y -= 24;

  // Existing items
  const existingItems: ExistingItem[] = (record.existingItemsJson as ExistingItem[] | null) ?? [];
  if (existingItems.length > 0) {
    drawText("Current Subscription Items", margin, y, 12, fontBold);
    y -= 18;

    for (const item of existingItems) {
      const line = `${item.productName}  ×${item.quantity}  ${fmt(item.unitAmount, record.currency)}/${item.interval}`;
      drawText(line, margin + 10, y, 9);
      y -= 14;
    }
    y -= 10;
  }

  // New items
  const newItems: LineItem[] = (record.lineItemsJson as LineItem[] | null) ?? [];
  if (newItems.length > 0) {
    drawText("New Items Being Added", margin, y, 12, fontBold);
    y -= 18;

    for (const item of newItems) {
      const price = item.overrideUnitAmount ?? item.unitAmount;
      const discount =
        item.overrideUnitAmount && item.overrideUnitAmount < item.unitAmount
          ? ` (was ${fmt(item.unitAmount, item.currency)})`
          : "";
      const line = `${item.productName}  ×${item.quantity}  ${fmt(price, item.currency)}/${item.interval}${discount}`;
      drawText(line, margin + 10, y, 9);
      y -= 14;
    }
    y -= 10;
  }

  // Proration
  if (record.prorationAmountCents) {
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: gray,
    });
    y -= 18;
    drawText("Proration Estimate", margin, y, 12, fontBold);
    y -= 16;
    drawText(
      fmt(record.prorationAmountCents, record.currency),
      margin + 10,
      y,
      10,
    );
    y -= 24;
  }

  // Total
  if (record.totalAmount) {
    drawText("Total Recurring", margin, y, 12, fontBold);
    y -= 16;
    drawText(fmt(record.totalAmount, record.currency), margin + 10, y, 11);
    y -= 30;
  }

  // Signature anchors (picked up by DocuSign)
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 24;
  drawText(
    "By signing below, you agree to the subscription amendment described above.",
    margin,
    y,
    9,
  );
  y -= 24;

  drawText("Signature: /sn1/", margin, y, 8, font, rgb(1, 1, 1));
  y -= 18;
  drawText("Date: /ds1/", margin, y, 8, font, rgb(1, 1, 1));
  y -= 18;
  drawText("Name: /fn1/", margin, y, 8, font, rgb(1, 1, 1));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
