import { getRenewalCandidates } from "@/lib/queries/cs-renewals";
import { RenewalsDashboard } from "./renewals-dashboard";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RenewalsPage() {
  const month = currentMonth();
  let data: Awaited<ReturnType<typeof getRenewalCandidates>> | null = null;
  let error: string | null = null;

  try {
    data = await getRenewalCandidates(month, null);
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
        <RenewalsDashboard initialMonth={month} initialData={data} />
      ) : null}
    </div>
  );
}
