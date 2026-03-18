export const dynamic = "force-dynamic";
import { getAllQuotes, type QuoteRow } from "@/lib/queries/quotes";
import { QuoteListTable } from "../quote-list-table";
import { PageHeader } from "@/components/workspace/page-header";

export default async function AllQuotesPage() {
  let quotes: QuoteRow[] = [];
  let error: string | null = null;

  try {
    quotes = await getAllQuotes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="All Quotes"
        description="Every quote across the team"
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
