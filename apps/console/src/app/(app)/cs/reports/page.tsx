export const dynamic = "force-dynamic";
import { requireSession } from "@omnibridge/auth";
import { getAllOmniRenewalCandidates } from "@/lib/omni/repo";
import { adaptRenewalCandidate } from "@/lib/omni/adapters/renewals";
import type { RenewalCandidate } from "@/lib/omni/adapters/renewals";
import { RenewalsReportTable } from "./renewals-report-table";

export default async function CsReportsPage() {
  await requireSession();

  let candidates: RenewalCandidate[] = [];
  let error: string | null = null;

  try {
    const raw = await getAllOmniRenewalCandidates();
    candidates = raw.map(adaptRenewalCandidate);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load renewals data.";
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <RenewalsReportTable candidates={candidates} />
      )}
    </div>
  );
}
