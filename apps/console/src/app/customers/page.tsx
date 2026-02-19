import Link from "next/link";
import { searchCustomers } from "@/lib/queries/customers";
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

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const customers = query.length >= 2 ? await searchCustomers(query) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Search by account name, domain, or Stripe/Salesforce ID.
        </p>
      </div>

      <SearchForm defaultValue={query} />

      {query.length >= 2 && (
        <>
          <p className="text-sm text-muted-foreground">
            {customers.length} result{customers.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>

          {customers.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Stripe</TableHead>
                    <TableHead>Salesforce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.sfAccountName ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.domain ?? "—"}
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
                  ))}
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
