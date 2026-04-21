# Omni Docs Index

## Purpose
This folder anchors the current operating model for Omni.

Omni is being built on the local Omni dataset as the operational source of truth.
The codebase is organized around canonical Omni contracts that sit between raw mirrored data and route surfaces.
The Cursor rules, commands, and agents should all reinforce that model.

---

## Current architecture

### Layers
1. **Raw/mirror layer**
   - source-oriented data inputs
   - Salesforce mirrors
   - Stripe mirrors
   - sync metadata

2. **Canonical Omni layer**
   - shared operational contracts
   - builders
   - repo functions
   - freshness/confidence semantics

3. **Surface layer**
   - routes
   - actions
   - adapters
   - UI components

### Canonical key
- `customer_index.id` is the current `omniAccountId`

---

## Canonical contracts

### `omniAccountSpine`
Purpose:
- operational identity and commercial/account summary

### `omniSubscriptionFacts`
Purpose:
- normalized subscription truth

### `omniRenewalCandidates`
Purpose:
- candidate-level data contract for Renewals

### `omniScrubMonthlyAccounts`
Purpose:
- account/month-level table contract for Scrub

### `omniScrubAccountDetail`
Purpose:
- prepared detail payload for Scrub side panel

### `omniDataQualityIssues`
Purpose:
- generated operational issues for cleanup workflows

---

## Canonicalized surfaces

### Renewals
Status:
- migrated to canonical Omni contracts

Pattern:
- account-grouped parent rows
- candidate-level KPI math
- detail remains candidate/contract-oriented

### Scrub
Status:
- migrated to canonical Omni contracts

Pattern:
- one row per account/month
- canonical snapshot/classification logic
- prepared detail payload for side panel

---

## Transition rules
- routes do not query raw mirror tables directly
- business truth belongs in canonical contracts
- adapters own legacy/UI shape translation
- money is canonicalized in cents
- cents → dollars translation happens at adapter boundary only
- top-level barrels should reflect real consumers, not speculative API surface
- Prisma schema changes that require migrations should ship with matching migration files
- UI actions that imply side effects should be fully wired or explicitly disabled

---

## Current priorities
1. edge cleanup after canonical adoption
2. implement data quality issue generation
3. build cleanup queue
4. refine Scrub UX
5. refine Renewals UX

---

## AI operating references

### Main plan
- `docs/ai/operating-plan.md`
- `docs/ai/recommended-tool-stack.md`

### Agent lanes
- `omni-implementer` for scoped implementation
- `omni-debugger` for bug-first work
- `omni-reviewer` for production-safety review
- `omni-architect` for high-risk design and rollout decisions
- `omni-repo-auditor` for repo discovery and branch status
- `omni-ui` for shadcn-based UI and Figma-guided implementation

### Command entry points
- `.ai/commands/status.md`
- `.ai/commands/debug-start.md`
- `.ai/commands/review-check.md`
- `.ai/commands/ui-pass.md`
- `.ai/commands/ship-check.md`

---

## Suggested docs to add next
- `docs/omni-contracts.md`
- `docs/route-grains.md`
- `docs/data-quality-issues.md`
- `docs/renewals.md`
- `docs/scrub.md`

---

## Glossary

### Omni account
Current operational account grain, keyed by `customer_index.id`

### Canonical contract
A shared, product-shaped data contract in `lib/omni/contracts/*`

### Builder
Code that composes raw mirrored/source data into canonical Omni truth

### Repo function
Thin access layer that routes call to retrieve canonical data

### Adapter
Code that translates canonical shapes into route/UI-compatible shapes during migration or when presentation-specific shaping is needed
