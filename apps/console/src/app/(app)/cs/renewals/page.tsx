export const dynamic = "force-dynamic";
import { fetchRenewalsForMonth } from "./actions";
import { RenewalsDashboard } from "./renewals-dashboard";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account } = await searchParams;
  const month = currentMonth();
  let data: Awaited<ReturnType<typeof fetchRenewalsForMonth>> | null = null;
  let error: string | null = null;

  try {
    data = await fetchRenewalsForMonth(month, null);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load renewals.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <RenewalsDashboard initialMonth={month} initialData={data} initialAccountFilter={account ?? null} />
      ) : null}
    </div>
  );
}
