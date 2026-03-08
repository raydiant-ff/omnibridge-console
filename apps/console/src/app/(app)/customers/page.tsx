import Link from "next/link";
import { searchCustomersUnified, getMyAccounts, getAllAccountsAdmin } from "@/lib/queries/customers";
import { revalidateCustomers } from "@/lib/actions/revalidate";
import { RefreshButton } from "@/components/refresh-button";
import { SearchForm } from "./search-form";
import { AccountsTable } from "./accounts-table";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

const SOURCE_LABELS = {
  local: { label: "Local DB", variant: "outline" as const },
  salesforce: { label: "Salesforce", variant: "default" as const },
  stripe: { label: "Stripe", variant: "secondary" as const },
};

async function getSessionRole(): Promise<string> {
  try {
    const { requireSession } = await import("@omnibridge/auth");
    const session = await requireSession();
    return (session.user as { role?: string }).role ?? "member";
  } catch {
    return "member";
  }
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const isSearching = query.length >= 2;

  const role = await getSessionRole();
  const isAdmin = role === "admin";

  const [myAccounts, allAccounts, searchResults] = await Promise.all([
    isSearching ? Promise.resolve([]) : getMyAccounts().catch(() => []),
    isSearching || !isAdmin ? Promise.resolve(null) : getAllAccountsAdmin().catch(() => null),
    isSearching ? searchCustomersUnified(query) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Your accounts and cross-system customer search.
          </p>
        </div>
        <RefreshButton action={revalidateCustomers} />
      </div>

      <SearchForm defaultValue={query} />

      {isSearching ? (
        <SearchResults query={query} customers={searchResults} />
      ) : (
        <AccountsTable myAccounts={myAccounts} allAccounts={allAccounts} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function SearchResults({
  query,
  customers,
}: {
  query: string;
  customers: Awaited<ReturnType<typeof searchCustomersUnified>>;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {customers.length} result{customers.length !== 1 ? "s" : ""} for
        &ldquo;{query}&rdquo;
      </p>

      {customers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stripe ID</TableHead>
                <TableHead>Salesforce ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const src = SOURCE_LABELS[c.source];
                const detailHref =
                  c.source === "local" ? `/customers/${c.id}` : null;

                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {detailHref ? (
                        <Link
                          href={detailHref}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.domain ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={src.variant}>{src.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.stripeCustomerId ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.stripeCustomerId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.sfAccountId ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.sfAccountId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">No customers found</p>
          <p className="text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      )}
    </>
  );
}
