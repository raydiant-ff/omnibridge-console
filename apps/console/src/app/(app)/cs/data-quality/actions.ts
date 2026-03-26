"use server";

import { requireSession } from "@omnibridge/auth";
import { getOmniDataQualityIssues, getWorkspaceTrustSummary } from "@/lib/omni/repo";
import type { DqQueueData } from "./types";

export async function fetchDataQualityIssues(): Promise<DqQueueData> {
  await requireSession();
  const [report, trust] = await Promise.all([
    getOmniDataQualityIssues(),
    getWorkspaceTrustSummary(),
  ]);

  const filteredIssues = report.issues.filter(
    (issue) => issue.sourceSystem === "stripe" || issue.sourceSystem === "salesforce",
  );

  const filteredReport = {
    ...report,
    issues: filteredIssues,
    totalCount: filteredIssues.length,
    criticalCount: filteredIssues.filter((issue) => issue.severity === "critical").length,
    highCount: filteredIssues.filter((issue) => issue.severity === "high").length,
    mediumCount: filteredIssues.filter((issue) => issue.severity === "medium").length,
    lowCount: filteredIssues.filter((issue) => issue.severity === "low").length,
  };

  return { report: filteredReport, trust };
}
