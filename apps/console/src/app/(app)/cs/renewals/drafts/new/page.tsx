"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * /cs/renewals/drafts/new?candidateId=sub:xxx
 *
 * Client page that calls the draft creation API and redirects to the draft editor.
 */
export default function NewDraftPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-3 py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <NewDraftInner />
    </Suspense>
  );
}

function NewDraftInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const candidateId = searchParams.get("candidateId");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      router.replace("/cs/renewals");
      return;
    }

    let cancelled = false;

    async function createDraft() {
      try {
        const res = await fetch("/api/renewals/drafts/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to create draft");
        }

        const { draftId } = await res.json();
        if (!cancelled) {
          router.replace(`/cs/renewals/drafts/${draftId}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to create draft");
        }
      }
    }

    createDraft();

    return () => {
      cancelled = true;
    };
  }, [candidateId, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
        <a href="/cs/renewals" className="text-sm text-primary hover:underline">
          Back to Renewals
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Creating renewal draft...</p>
    </div>
  );
}
