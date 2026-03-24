/**
 * Omni canonical data layer — top-level barrel.
 *
 * Architecture:
 *   contracts/  — pure TypeScript interfaces (the "what")
 *   builders/   — query + transform logic (the "how")
 *   repo/       — auth-gated public API (the "who can")
 *
 * Routes should import from `@/lib/omni/repo` for data access.
 * Types should be imported from `@/lib/omni/contracts`.
 */

// Re-export repo (public API)
export * from "./repo";

// Re-export contracts (types)
export * from "./contracts";
