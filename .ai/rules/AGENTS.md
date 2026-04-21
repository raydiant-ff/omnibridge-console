# AGENTS.md

## Mission
This repo powers Omni, a set of operational work surfaces built on top of the local Omni dataset.

The purpose of Omni is not to mirror source systems blindly. It is to create better operational truth and workflow UX for:
- renewals
- subscription scrub/churn investigation
- account-level operational views
- future CS queues
- future data cleanup queues
- future support workflows

## Source of truth
For now, the source of operational truth is the **local Omni dataset** and the canonical Omni layer built on top of it.

Do not assume Atlas is authoritative for current product work.
Do not block work on Atlas readiness.

## Repo operating model

### Layer 1 — raw/mirror inputs
Examples:
- `sf_*`
- `stripe_*`
- sync metadata tables

These are source-oriented inputs.

### Layer 2 — canonical Omni contracts
Location:
- `apps/console/src/lib/omni/contracts/`
- `apps/console/src/lib/omni/builders/`
- `apps/console/src/lib/omni/repo/`

This is the shared operational truth layer.

### Layer 3 — surfaces
Routes, actions, adapters, and UI components.

Routes should consume canonical Omni contracts and adapted UI shapes.
Routes should not directly query mirror tables.

## Current canonical key
Use `customer_index.id` as the current canonical `omniAccountId`.

This is the operational account grain for current surfaces.

## Canonical contracts in use
Current core contracts:
- `omniAccountSpine`
- `omniSubscriptionFacts`
- `omniRenewalCandidates`
- `omniScrubMonthlyAccounts`
- `omniScrubAccountDetail`
- `omniDataQualityIssues`

## Current status

### Canonicalized routes
- Renewals
- Scrub

These routes should remain on canonical Omni contracts.
Do not reintroduce route-local business truth.

### Transitional edge
Adapters may still exist to convert canonical contracts into legacy UI-compatible route shapes.
That is acceptable during transition.

However:
- old query modules should not remain in the route path
- old query modules should not remain the source of route-edge types

## Working rules

### 1. No direct route access to mirror tables
If a route needs new truth, create or extend a canonical Omni contract.

### 2. Canonical contracts own business truth
Examples:
- money normalization
- snapshot logic
- classification logic
- SF correlation summaries
- freshness semantics
- confidence flags

### 3. Adapter boundary owns legacy UI shaping
Examples:
- cents → dollars translation
- route-edge prop compatibility
- legacy display shape preservation during migration

### 4. One pass, one job
Do not mix:
- canonical migration
- UI redesign
- logic reinterpretation
- route expansion

### 5. Public barrels must reflect real consumers
Top-level barrels should export symbols that already have a non-local consumer, or symbols whose first real consumer lands in the same PR.

Do not advertise speculative API surface from `index.ts` files just because the implementation exists.

### 6. Schema and migrations must stay paired
If `packages/db/prisma/schema.prisma` changes in a way that requires a migration:
- stage the matching migration in the same branch, or
- revert the schema change before merge

Do not leave Prisma schema ahead of migrations.

### 7. UI actions must be truthful
If a control implies persistence, messaging, or another external side effect, it must be:
- fully wired, or
- explicitly disabled with clear explanatory copy

Do not ship active-looking placeholder actions.

### 8. Parameter names must reflect true grain
Prefer:
- `omniAccountId`
- `candidateId`
- `subscriptionId`

Avoid vague names like:
- `customerId`
- `id`

unless the context is truly unambiguous.

### 9. Governance files require explicit review
Treat changes under:
- `.ai/rules/`
- `.ai/agents/`
- `.ai/commands/`

as team workflow policy decisions, not generic untracked cleanup.

## AI operating lanes

Use specialized lanes instead of treating every task as generic implementation work.

### Primary lanes
- `omni-implementer` for scoped feature work and narrow refactors
- `omni-debugger` for reproductions, runtime failures, regressions, and webhook issues
- `omni-reviewer` for code review, regression analysis, and high-risk diff checks
- `omni-architect` for architecture, rollout planning, and cross-domain source-of-truth decisions
- `omni-repo-auditor` for repo status, changed-files analysis, and implementation discovery
- `omni-ui` for shadcn-based UI work, Tailwind/global CSS refinement, and Figma-to-code implementation

### Command entry points
- use `.ai/commands/debug-start.md` to start a debug-first workflow
- use `.ai/commands/review-check.md` to start a review-first workflow
- use `.ai/commands/ui-pass.md` to start a UI/design implementation pass
- use `.ai/commands/status.md` for repo inventory
- use `.ai/commands/ship-check.md` before declaring work ready

### Escalation rules
- if billing, auth, webhooks, quoting, subscriptions, invoices, or cross-system effects are involved, prefer `omni-reviewer` before merge
- if the architecture is unclear, route to `omni-architect` before editing
- if the task is a bug hunt, route to `omni-debugger` before speculative rewrites
- if the work is visual or design-driven, route to `omni-ui` and keep product logic stable unless explicitly requested

## Current priority order
1. stabilize canonical adoption edge
2. implement real data quality issue generation
3. build cleanup queue
4. refine Scrub presentation
5. refine Renewals readability
6. build next operational surfaces

## Task template
For any non-trivial task, always identify:

1. **Goal**
2. **Surface or layer affected**
3. **Grain**
4. **Canonical contract(s) used**
5. **Adapter boundary needed**
6. **Freshness/confidence semantics**
7. **Non-goals**
8. **Validation commands**

## Output expectations
When completing a task, report:
- files created/changed
- what changed
- what intentionally did not change
- validation results
- open questions or blockers
- any architectural risk introduced
- which lane or command was used, when relevant

## Validation
Run when relevant:
- `npx tsc --noEmit`
- `pnpm lint`
- `pnpm build`

Preserve parity scripts where they exist.
Do not remove safety checks casually.

## What to protect
Treat these as protected architecture:
- canonical Omni contracts
- builder/repo separation
- adapter boundaries
- table-first route patterns for operational surfaces
- cents-based canonical money semantics

## What to avoid
- drifting back to raw-table route logic
- making a route “look better” by smuggling in new truth logic
- inventing a universal customer hierarchy prematurely
- adding new surfaces before stabilizing the current operational core
