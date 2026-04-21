"use server";

import { requireSession } from "@omnibridge/auth";
import { buildOmniAccountSpines } from "../builders/build-omni-account-spine";
import type { OmniAccountSpine } from "../contracts/omni-account-spine";

/**
 * Get account spines for specific CustomerIndex IDs.
 * If no IDs provided, returns all spines.
 */
export async function getOmniAccountSpines(
  customerIndexIds?: string[],
): Promise<OmniAccountSpine[]> {
  await requireSession();
  return buildOmniAccountSpines(customerIndexIds);
}

/**
 * Get a single account spine by CustomerIndex ID.
 */
export async function getOmniAccountSpine(
  customerIndexId: string,
): Promise<OmniAccountSpine | null> {
  await requireSession();
  const results = await buildOmniAccountSpines([customerIndexId]);
  return results[0] ?? null;
}
