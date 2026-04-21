# OmniBridge Golden Path — Contributor Guide

This document defines the approved architecture for all new product work in OmniBridge.
Read this before opening a PR that adds a query, action, or UI component.

---

## Reads: use the projection layer

All product-facing data reads must go through `lib/projections/`.

| File | What it returns |
|---|---|
| `lib/projections/customer-view.ts` | `CustomerView` — account workspace composite |
| `lib/projections/subscription-view.ts` | `SubscriptionView` — subscription + contract composite |
| `lib/projections/invoice-view.ts` | `InvoiceView` — invoice + customer composite |
| `lib/projections/quote-view.ts` | `QuoteView` — quote + contact + account composite |
| `lib/projections/renewal-view.ts` | `RenewalView` — renewal workspace composite |

Add new projections here. Do NOT query Prisma models directly from page components or Server Actions.

---

## Guardrails: always use these helpers

Defined in `lib/repo/`:

| Helper | Rule |
|---|---|
| `SF_ACCOUNT_BASE_WHERE` | Spread into every `prisma.sfAccount` where clause — excludes stub records |
| `computeDaysToExpiry(endDate)` | Always compute from `endDate` — never read `SfContract.daysTillExpiry` |
| `classifyRenewalUrgency(days)` | Always derive urgency from computed days — never store it |

---

## Mutations: use server actions

All mutations go in `lib/actions/`. Every action must:

1. Call `requireSession()` (auth gate)
2. Use lazy dynamic imports for external clients: `const { getStripeClient } = await import("@omnibridge/stripe")`
3. Return `{ success: boolean; error?: string }` — never throw to the caller
4. Write to `prisma.auditLog` with actor, action, target, requestId

---

## UI: use the approved component system

New UI components belong in:

| Directory | Purpose |
|---|---|
| `components/shell/` | Page-level layout shells |
| `components/layout/` | Layout primitives |
| `components/panels/` | Detail panels and drawers |
| `components/states/` | Loading, empty, and error states |
| `components/data/` | Data display primitives (tables, grids) |
| `components/omni/` | Domain-specific composite components |

`components/workspace/` is **frozen** — do not add components there. Existing consumers are stable.

---

## Tooling stance

Default team stance for implementation:

- use local repo-native work as the primary coding lane
- keep `shadcn` as the UI primitive system
- use Figma for design source, inspection, and code linking
- treat Cursor as optional infrastructure, not required product machinery
- do not use Cursor cloud/background agents as a default workflow

If using AI support:

- use explicit debug, review, and UI lanes from `docs/ai/operating-plan.md`
- keep Bugbot advisory only if enabled
- keep final judgment for billing, auth, webhook, and source-of-truth changes in the local repo workflow

---

## Domain rules (non-negotiable)

- **Stripe is billing source of truth.** Never use `SfContract.stripeStatus` as authoritative billing state — use `StripeSubscription.status`.
- **`SfAccount.isStub`** must be filtered out of every customer-facing query via `SF_ACCOUNT_BASE_WHERE`.
- **`escapeSoql()`** from `@omnibridge/salesforce` is required for any user-provided value in SOQL.
- **Idempotency**: webhooks use `IdempotencyKey` + `ProductLog`. Never create duplicate side effects.
- **`AuditLog.actorUserId` is nullable** — webhook/system actions use `null`, not fake user IDs.

---

## What NOT to do

| Don't | Do instead |
|---|---|
| Query Prisma directly from a page component | Use a projection from `lib/projections/` |
| Read `SfContract.daysTillExpiry` | Call `computeDaysToExpiry(contract.endDate)` |
| Read `SfContract.stripeStatus` | Join `StripeSubscription` and read `.status` |
| Add components to `components/workspace/` | Use the approved component directories above |
| Extend `cs-renewals.ts`, `cs-dashboard.ts`, `customer-signals.ts` | Build new reads in `lib/projections/` |
| Wire pages to `customers/[id]/360/mock-data.ts` | Delete mock-data.ts and wire to projection layer |
