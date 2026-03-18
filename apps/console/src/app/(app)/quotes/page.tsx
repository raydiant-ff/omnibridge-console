export const dynamic = "force-dynamic";
import { getMyQuotes, type QuoteRow } from "@/lib/queries/quotes";
import { QuoteListTable } from "./quote-list-table";
import { PageHeader } from "@/components/workspace/page-header";

export default async function QuotesPage() {
  let quotes: QuoteRow[] = [];
  let error: string | null = null;

  try {
    quotes = await getMyQuotes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My Quotes"
        description="Stripe quotes you've created"
        stats={[
          { label: "total", value: String(quotes.length) },
          { label: "open", value: String(quotes.filter((q) => q.status === "open").length) },
          { label: "accepted", value: String(quotes.filter((q) => q.status === "accepted").length) },
        ]}
      />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <QuoteListTable quotes={quotes} />
      )}
    </div>
  );
}
