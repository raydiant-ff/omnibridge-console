import { getAllQuotes, type QuoteRow } from "@/lib/queries/quotes";
import { QuoteListTable } from "../quote-list-table";

export default async function AllQuotesPage() {
  let quotes: QuoteRow[] = [];
  let error: string | null = null;

  try {
    quotes = await getAllQuotes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Quotes</h1>
        <p className="text-sm text-muted-foreground">
          Every quote across the team. Admin view.
        </p>
      </div>

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
