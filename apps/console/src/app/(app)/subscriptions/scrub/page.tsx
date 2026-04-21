import { Suspense } from "react";
import { PageHeader } from "@/components/workspace/page-header";
import { ScrubSection } from "./scrub-section";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function ScrubPage({ searchParams }: Props) {
  const params = await searchParams;
  // Default to previous month
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const month = params.month ?? defaultMonth;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subscription Scrub"
        description="Investigate monthly cancellations, coverage, and Salesforce correlation using mirrored subscription data."
      />

      <Suspense
        key={month}
        fallback={<div className="animate-pulse bg-muted h-96 rounded" />}
      >
        <ScrubSection month={month} />
      </Suspense>
    </div>
  );
}
