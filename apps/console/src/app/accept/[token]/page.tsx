import { prisma } from "@omnibridge/db";
import { notFound } from "next/navigation";
import { AcceptQuoteClient } from "./accept-client";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
}

export default async function AcceptQuotePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { canceled } = await searchParams;

  const record = await prisma.quoteRecord.findUnique({
    where: { acceptToken: token },
  });

  if (!record) notFound();

  const lineItems = (record.lineItemsJson as {
    productName: string;
    nickname: string;
    quantity: number;
    unitAmount: number;
    currency: string;
    interval: string;
  }[] | null) ?? [];

  return (
    <AcceptQuoteClient
      token={token}
      customerName={record.customerName}
      collectionMethod={record.collectionMethod}
      paymentTerms={record.paymentTerms}
      totalAmount={record.totalAmount ?? 0}
      currency={record.currency}
      status={record.status}
      expiresAt={record.expiresAt?.toISOString() ?? null}
      lineItems={lineItems}
      isDryRun={record.dryRun}
      hasDocuSign={!!record.docusignEnvelopeId}
      signerName={record.signerName}
      wasCanceled={canceled === "true"}
    />
  );
}
