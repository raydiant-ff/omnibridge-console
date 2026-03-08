"use server";

import { requireSession } from "@omnibridge/auth";
import type { Role } from "@omnibridge/auth";
import { flags } from "@/lib/feature-flags";

const VALID_STAGES = [
  "Discovery & Qualification",
  "Customer Evaluation",
  "Pricing & Negotiation",
  "Contract Sent",
  "Closed Won",
  "Closed Lost",
] as const;

const ADMIN_ONLY_STAGES: string[] = ["Closed Won", "Closed Lost"];
const AUTOMATION_ONLY_STAGES: string[] = ["Contract Sent"];

export interface CreateOpportunityInput {
  accountId: string;
  accountName: string;
  name: string;
  stageName: string;
}

export interface CreateOpportunityResult {
  success: boolean;
  error?: string;
  opportunityId?: string;
}

export async function createOpportunityAction(
  input: CreateOpportunityInput,
): Promise<CreateOpportunityResult> {
  const session = await requireSession();
  const role = (session.user as { role?: Role }).role;

  if (!input.name.trim()) {
    return { success: false, error: "Opportunity name is required." };
  }
  if (!input.accountId) {
    return { success: false, error: "Account is required." };
  }
  if (!input.stageName) {
    return { success: false, error: "Stage is required." };
  }
  if (AUTOMATION_ONLY_STAGES.includes(input.stageName)) {
    return { success: false, error: `"${input.stageName}" can only be set automatically.` };
  }
  if (ADMIN_ONLY_STAGES.includes(input.stageName) && role !== "admin") {
    return { success: false, error: `Only admins can set stage to "${input.stageName}".` };
  }
  if (!VALID_STAGES.includes(input.stageName as typeof VALID_STAGES[number])) {
    return { success: false, error: `Invalid stage: "${input.stageName}".` };
  }

  if (flags.useMockSalesforce) {
    await new Promise((r) => setTimeout(r, 500));
    return {
      success: true,
      opportunityId: "006MOCK" + Math.random().toString(36).slice(2, 10),
    };
  }

  try {
    const { createOpportunity } = await import("@omnibridge/salesforce");

    const defaultCloseDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const result = await createOpportunity({
      Name: input.name.trim(),
      AccountId: input.accountId,
      StageName: input.stageName,
      CloseDate: defaultCloseDate,
    });

    if (!result.success) {
      const msg = result.errors?.map((e) => e.message).join("; ") ?? "Unknown Salesforce error";
      return { success: false, error: msg };
    }

    return { success: true, opportunityId: result.id };
  } catch (err) {
    console.error("[createOpportunity] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create opportunity.",
    };
  }
}
