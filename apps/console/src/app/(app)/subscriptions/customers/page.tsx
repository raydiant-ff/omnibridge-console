import Link from "next/link";
import { searchCustomersUnified } from "@/lib/queries/customers";
import { SearchForm } from "./search-form";
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

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const customers = query.length >= 2 ? await searchCustomersUnified(query) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Search across local database, Salesforce Accounts, and Stripe Customers.
        </p>
      </div>

      <SearchForm defaultValue={query} />

      {query.length >= 2 && (
        <>
          <p className="text-sm text-muted-foreground">
            {customers.length} result{customers.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
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
                    const detailHref = c.source === "local"
                      ? `/subscriptions/customers/${c.id}`
                      : null;

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
      )}
    </div>
  );
}
