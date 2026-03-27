# Omni Composite V1 Engineering Handoff

## Purpose

This document summarizes the current composite Omni build so Engineering can:

- understand the business intent behind the work
- locate the main technical implementation areas quickly
- test the current state safely
- understand the recommended branch reconciliation path

Date: 2026-03-26
Working branch during implementation: `work/composite-v1-integration`

---

## Branch Recommendation

### Business scope

We now have a meaningful composite of:

- design system and shell cleanup
- Customer Success workspace v1
- renewals / queue / data-quality workspace work
- support workspace v1
- Avochato support ingestion
- Anthropic-backed support AI agent

This is enough to test as one product slice, but it is **not** a good candidate to land directly on `main` yet because the current working tree is still a large, uncommitted integration state.

### Technical scope

Recommended path:

1. create a dedicated integration branch from the current composite state
2. validate the composite on that branch end to end
3. checkpoint the work with one or more reviewable commits
4. only then decide whether to:
   - merge into `main`
   - or break the work into smaller PRs against `main`

Recommended branch name:

- `work/composite-v1-integration`

Why not `main` directly:

- the repo currently has a large dirty worktree
- there are multiple cross-cutting areas in flight
- Support/Avochato/AI work is now mixed with CS/design/perf work
- we need one safe place to test the combined behavior before promotion

### Branch audit summary

Business scope:

- The composite branch already contains the meaningful product work from the design-system and renewals workspace branches.
- One historical branch, `recovery/main-wip-2026-03-17`, remains outside the composite, but it is an older preservation snapshot from the PandaDoc-to-DocuSign transition and not a safe candidate for blind merge.

Technical scope:

- Branches reviewed:
  - `main`
  - `feat/v0-design-system`
  - `recovery/design-foundation-2026-03-17`
  - `recovery/main-wip-2026-03-17`
  - `work/post-merge-stabilization`
  - `work/renewals-queue-workspace`
- Result:
  - `feat/v0-design-system` is already contained in the composite branch
  - `work/renewals-queue-workspace` is already contained in the composite branch
  - `recovery/design-foundation-2026-03-17` is already contained through mainline history
  - `work/post-merge-stabilization` has no unique commits beyond `main`
  - `recovery/main-wip-2026-03-17` has one unique WIP preservation commit (`d9e5e19`) that predates and overlaps newer quote/DocuSign work; it should remain as a forensic recovery branch, not an integration target

---

## Current Composite Scope

### Internal Vercel Deploy

#### Business scope

The composite branch is now suitable for internal hosted testing instead of relying on slow local-only demos.

Current hosted behavior:

- internal production is live on `https://omnibridge-console.vercel.app`
- authenticated app routes correctly protect access by redirecting unauthenticated users to `/login`
- the old deployment-specific URL previously used for demos should be treated as historical only; new releases should use the stable production alias

#### Technical scope

Deployment notes for Engineering:

- Vercel project root directory is `apps/console`
- the project is using the composite branch code, but the repo is still being worked from `work/composite-v1-integration`
- Vercel env vars were loaded from local console env and adjusted for hosted auth/base URL behavior
- production-only build fixes were required in several files before Vercel would build cleanly:
  - [customers.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/lib/queries/customers.ts)
  - [support/queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
  - [support/support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
  - [avochato webhook route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/avochato/webhook/route.ts)
  - [avochato access sync route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-sync/route.ts)
  - [avochato conversation sync route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-conversations-sync/route.ts)
  - [customers-shell.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(workspace)/customers/customers-shell.tsx)
  - [stat-strip.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/omni/stat-strip.tsx)
  - [turbo.json](/Users/franciscofiedler/OmniBridge-v2/turbo.json)
- deploy-context cleanup was added in:
  - [.vercelignore](/Users/franciscofiedler/OmniBridge-v2/.vercelignore)
  - [apps/console/.vercelignore](/Users/franciscofiedler/OmniBridge-v2/apps/console/.vercelignore)
  - [apps/console/.gitignore](/Users/franciscofiedler/OmniBridge-v2/apps/console/.gitignore)

Recommended next step for Engineering:

1. keep using the stable project alias for internal testing
2. move the deploy-fix files into a reviewed checkpoint commit
3. decide whether to make this project’s production branch track the composite branch temporarily or keep production deploys manual during the evaluation period

### 1. Shell + Design System V1

#### Business scope

The app has been moved toward a more consistent internal workspace language:

- stronger typography
- more deliberate card hierarchy
- standardized table surfaces
- standardized sidebar/app shell rhythm
- better local browseability for testing

#### Technical scope

Primary files:

- [globals.css](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/globals.css)
- [sidebar.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/sidebar.tsx)
- [app-header.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/app-header.tsx)
- [app-shell.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/shell/app-shell.tsx)
- [workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/shell/workspace.tsx)
- [page-header.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/workspace/page-header.tsx)
- [stat-strip.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/omni/stat-strip.tsx)
- [data-table.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/components/ui/data-table.tsx)

Notable behavior:

- local browse mode support for easier product review
- support-specific compact Omni rail treatment in `/support`
- shared metric/table primitives now drive multiple pages

---

### 2. Customer Success Workspace V1

#### Business scope

The CS surface has been converted from a flat dashboard into a real operational workspace with:

- portfolio / risk / freshness top band
- object blocks for Opportunities, Quotes, Subscriptions, Invoices, Contracts, Payments
- a priority accounts work queue
- CS Queue and Data Quality operational surfaces

The prioritization logic is now more aligned with actual CSM work:

- billing pressure
- renewals within the current month
- linkage gaps
- data-quality issues

and **not** generic renewal pressure from unreliable `cancel_at` semantics.

#### Technical scope

Primary files:

- [actions.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/actions.ts)
- [cs-dashboard.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/cs-dashboard.tsx)
- [types.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/types.ts)
- [cs-queue.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/queue/cs-queue.tsx)
- [data-quality-queue.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/data-quality/data-quality-queue.tsx)
- [renewals-kpi-strip.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/renewals/renewals-kpi-strip.tsx)
- [sf-sync route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/sf-sync/route.ts)

Important product decisions:

- Salesforce quote metrics replace Omni quote metrics for CS quote visibility
- `Need Attention` excludes broad renewal-pressure logic
- Data Quality now focuses on Stripe/Salesforce degradation, not future Omni cross-system placeholders

---

### 3. Support Workspace V1

#### Business scope

Support is being built as an operational workspace **inside Omni**, not as a separate app.

Current direction:

- channel-mode support workspace
- conversation list
- live thread view
- customer 360 context
- AI agent assist panel

The current implementation is intended as the first practical operator surface, not the final UX.

#### Technical scope

Primary files:

- [support/page.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/page.tsx)
- [support/queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [support/shared.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/shared.ts)
- [support/types.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/types.ts)
- [support/support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-v1-plan.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-v1-plan.md)

Important UX behavior already in place:

- conversation list and thread are support-mode filtered
- thread opens anchored to newest activity
- timeline events from Avochato are shown inline
- Customer 360 only shows Omni customer context when a real match exists
- AI Agent panel supports model toggle between Sonnet and Opus

---

### 4. Avochato Integration Foundation

#### Business scope

Support transport for `sms` and `chat` is being built on Avochato.

Core product boundary:

- Avochato = transport state and channel visibility
- Omni = support workflow, customer context, assignment layer
- Gmail email integration will be separate later

#### Technical scope

Primary files:

- [avochato package](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/src/index.ts)
- [avochato webhook route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/avochato/webhook/route.ts)
- [avochato bootstrap sync](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-sync/route.ts)
- [avochato conversation sync](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-conversations-sync/route.ts)
- [support implementation log](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

Current data model is persisted in Prisma and already migrated.

Key support tables:

- `SupportChannelAccount`
- `SupportChannelEndpoint`
- `SupportAgentChannelAccess`
- `SupportConversation`
- `SupportMessage`
- `SupportParticipant`
- `SupportConversationEvent`

Current status:

- Avochato accounts/endpoints/access have been synced
- conversations/messages are mirrored into Omni
- timeline events are ingested and rendered

---

### 5. Anthropic Support AI Agent

#### Business scope

The Support AI pane is now a real assistive workflow, not mock UI.

Current role:

- summarize threads
- recommend next steps
- help operators reason about billing / support context

This is currently assistive only. It does **not** autonomously send customer replies.

#### Technical scope

Primary files:

- [anthropic package](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/src/index.ts)
- [support agent route](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/support/agent/route.ts)
- [support AI pane](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)

Current behavior:

- Anthropic API key is read from local env
- `Sonnet` and `Opus` model presets are supported
- the route loads support conversation + stitched Omni context
- an `AuditLog` row is written for each agent prompt

This is still prompt-context based and does not yet use tool calling.

---

### 6. Performance + DX Work

#### Business scope

A series of changes were made to improve local usability and reduce dev friction while iterating on the workspaces.

#### Technical scope

Areas touched:

- static import hoists in selected action/query files
- TypeScript config cleanup
- named exports replacing wide barrel patterns
- local auth/dev browse improvements

Primary files include:

- [base.json](/Users/franciscofiedler/OmniBridge-v2/packages/typescript-config/base.json)
- [package.json](/Users/franciscofiedler/OmniBridge-v2/apps/console/package.json)
- [index.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/lib/omni/index.ts)
- several files in:
  - [lib/actions](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/lib/actions)
  - [lib/queries](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/lib/queries)

---

## Current Validation State

### Business scope

The composite is usable for product review and operator flow testing, especially in:

- `/cs`
- `/cs/queue`
- `/cs/data-quality`
- `/customers`
- `/support`

### Technical scope

Validation used so far:

- focused ESLint on changed slices
- manual route verification in local dev
- live Avochato sync checks
- live Anthropic prompt checks

What has **not** happened yet:

- one full repo `pnpm lint`
- one full repo `pnpm build`
- one clean checkpoint commit for the current working tree

Those should happen before promotion toward `main`.

---

## Immediate Engineering Testing Checklist

### Business scope

These are the highest-value flows to validate as a composite:

1. CS dashboard top-band accuracy and priority queue logic
2. CS Queue and Data Quality operator flows
3. Support conversation rendering and timeline visibility
4. Customer 360 matching behavior in Support
5. AI Agent Sonnet/Opus behavior in Support

### Technical scope

Suggested verification:

1. `pnpm --filter @omnibridge/console dev`
2. visit:
   - `/cs`
   - `/cs/queue`
   - `/cs/data-quality`
   - `/customers`
   - `/support`
3. run:
   - `pnpm exec eslint ...` on touched slices first
4. then run:
   - `pnpm lint`
   - `pnpm build`

For Support specifically:

- rerun Avochato sync if needed
- verify support conversations load from DB, not fallback mocks
- verify `/api/support/agent` returns live model output

---

## Recommended Next Move

### Business scope

Create a single staging branch for the full composite and treat it as the integration candidate for Engineering review.

### Technical scope

Recommended sequence:

1. create `work/composite-v1-integration`
2. checkpoint the current working tree into reviewable commits
3. run:
   - `pnpm lint`
   - `pnpm build`
4. resolve issues
5. let Engineering review from the integration branch
6. only then promote to `main`

That is the safest path to get one coherent testable branch without risking a messy direct landing on `main`.
