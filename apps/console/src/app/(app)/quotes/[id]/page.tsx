import { notFound } from "next/navigation";
import { getQuoteDetail, getQuoteAuditTimeline } from "@/lib/queries/quotes";
import { QuoteDetailView } from "./quote-detail";

export default async function QuoteDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [quote, timeline] = await Promise.all([
    getQuoteDetail(id),
    getQuoteAuditTimeline(id),
  ]);

  if (!quote) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <QuoteDetailView quote={quote} timeline={timeline} />
    </div>
  );
}
