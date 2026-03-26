# Support + Avochato Implementation Log

This is the living build log for the Omni Support domain and Avochato integration.

From this point forward, every meaningful implementation change should be reflected here with:

- **Business scope**
- **Technical scope**
- **Files touched**
- **Validation**
- **Open risks / follow-ups**

---

## Product Boundary

### Business scope

Omni Support is being built as an operational workspace inside Omni.

Near-term channel ownership:

- **Avochato** for `sms` and `chat`
- **Gmail** later for `email`

Source-of-truth split:

- **Avochato** = transport and delivery state for SMS/chat
- **Omni** = workflow, assignment, context, and normalized support model
- **Stripe / Salesforce mirrors** = customer context for agents
- **Atlas** = future analytical/read-model layer, not a blocker for Support v1

### Technical scope

The implementation is centered on:

- a dedicated support schema in Prisma
- an `@omnibridge/avochato` integration package
- webhook-driven ingest into Omni tables
- a support UI that reads from Omni, not directly from Avochato

---

## Current Decisions

### Business scope

1. Support is staying **inside Omni**, not a separate app.
2. Avochato permissions should define the **hard visibility boundary** for conversations.
3. Omni should own **assignment logic**, then sync that assignment back to Avochato.
4. Email will be a **separate Gmail integration later**, not part of the first Avochato transport layer.
5. Customer association should be:
   - deterministic first
   - AI-assisted only for ambiguous fallback cases

### Technical scope

1. Canonical local models:
   - `SupportConversation`
   - `SupportMessage`
   - `SupportParticipant`
   - `SupportConversationEvent`
   - `SupportChannelAccount`
   - `SupportChannelEndpoint`
   - `SupportAgentChannelAccess`
2. Webhooks are the primary ingest path.
3. Polling / API reads are for:
   - initial sync
   - replay / repair
   - explicit operational actions
4. We will not make `/support` depend on Atlas.

---

## Change Log

### 2026-03-25 — Support domain foundation

#### Business scope

Established the foundational support data model and Avochato integration boundary so Omni can begin ingesting and working real SMS/chat conversations without waiting on Atlas.

This also formalized a key product decision:

- use Avochato for SMS/chat only
- keep Gmail as a separate future email integration
- preserve enough structure to support channel-aware permissions and customer linking

#### Technical scope

Added the first implementation foundation:

- new `@omnibridge/avochato` integration package
- new support-domain models and enums in Prisma
- first webhook route for Avochato ingest
- db export updates for the new support types
- migration SQL generated for the support schema
- support planning doc updated to reflect the current architecture

#### Files touched

- [schema.prisma](/Users/franciscofiedler/OmniBridge-v2/packages/db/prisma/schema.prisma)
- [migration.sql](/Users/franciscofiedler/OmniBridge-v2/packages/db/prisma/migrations/20260325223500_add_support_domain/migration.sql)
- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/db/src/index.ts)
- [package.json](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/package.json)
- [tsconfig.json](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/tsconfig.json)
- [.eslintrc.js](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/.eslintrc.js)
- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/src/index.ts)
- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/avochato/webhook/route.ts)
- [support-v1-plan.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-v1-plan.md)

#### Validation

- Prisma schema validated successfully
- Prisma client regenerated successfully
- ESLint passed on:
  - the new Avochato package
  - the new webhook route
  - the updated db exports

#### Open risks / follow-ups

- Migration has been generated but not yet applied
- Webhook payload normalization is best-effort until real Avochato payloads are observed
- Avochato webhook docs do not clearly expose signed-request verification, so v1 uses token-gated webhook access
- We still need:
  - inbox/user sync
  - support UI data wiring
  - deterministic customer-linking logic

### 2026-03-25 — Avochato access bootstrap sync

#### Business scope

Added the first real sync path for Avochato account visibility so Omni can begin mirroring the inbox/account boundaries that should govern which support users can see which conversations.

This is intentionally an **access bootstrap**, not the full conversation sync yet.

It helps answer:

- which Avochato inbox/account are we connected to?
- what accounts are visible through the current credentials?
- how do we start mirroring that boundary into Omni?

#### Technical scope

Added a cron-style route that:

- verifies `CRON_SECRET`
- calls the Avochato client for:
  - `whoAmI`
  - `listAccounts`
  - `listUsers`
- upserts `SupportChannelAccount`
- creates an SMS endpoint record from account phone data when available
- maps the current Avochato credential user to an Omni user by email
- creates `SupportAgentChannelAccess` for that matched Omni user
- writes sync metadata into `SyncJob`
- writes per-account sync events into `SyncEvent`

This is not yet a complete permission sync. It only establishes the current credential’s access footprint and the account/endpoints that credential can see.

#### Files touched

- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-sync/route.ts)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- route linting completed successfully
- route composes cleanly against the new Avochato integration and support schema

#### Open risks / follow-ups

- This does **not** yet fully mirror per-agent inbox permissions for the whole support team
- It currently maps the credential owner into Omni by email, which is useful but incomplete
- We still need:
  - real conversation/message sync
  - fuller user/permission reconciliation
  - webhook production verification with real Avochato payloads
  - customer-linking logic

### 2026-03-25 — Support migration applied

#### Business scope

The support schema is now actually present in the live dev database, which means we can begin storing real support conversations, permissions, and message history instead of staying in planning mode.

This moves Support from “designed in code” to “backed by real persistence.”

#### Technical scope

Applied the generated support-domain SQL migration directly to the current development database and then marked the migration as applied in Prisma history.

This was done with direct SQL execution because the existing Supabase development database already has unrelated schema drift, which prevents a standard `prisma migrate dev` flow from running cleanly.

#### Files touched

- [migration.sql](/Users/franciscofiedler/OmniBridge-v2/packages/db/prisma/migrations/20260325223500_add_support_domain/migration.sql)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- support migration SQL executed successfully
- migration `20260325223500_add_support_domain` marked as applied in Prisma history

#### Open risks / follow-ups

- current local env does **not** yet expose:
  - `AVOCHATO_AUTH_ID`
  - `AVOCHATO_AUTH_SECRET`
  - `AVOCHATO_DEFAULT_SUBDOMAIN`
  - `AVOCHATO_WEBHOOK_TOKEN`
- because of that, the first live Avochato sync could not yet be executed
- next practical step is to add those env vars, then run:
  - `/api/cron/avochato-sync`

### 2026-03-25 — Local Avochato credentials wired

#### Business scope

Moved the Avochato integration from “schema-ready” to “credential-ready” so Omni can start proving real inbox visibility and account access against the live support transport layer.

This is the first step that lets us validate:

- which Avochato account we are actually connected to
- which support inbox/account boundary the current credentials can access
- whether Omni can now start bootstrapping channel visibility from real Avochato data

#### Technical scope

- added the local Avochato auth pair and webhook token to `apps/console/.env.local`
- discovered and fixed a module-resolution issue by declaring `@omnibridge/avochato` as a dependency of `@omnibridge/console`
- next immediate step is to rerun `/api/cron/avochato-sync` and capture the returned account/subdomain identity

#### Files touched

- [package.json](/Users/franciscofiedler/OmniBridge-v2/apps/console/package.json)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- Next.js route resolution failure identified and traced to missing workspace dependency declaration

#### Open risks / follow-ups

- `AVOCHATO_DEFAULT_SUBDOMAIN` is still intentionally unset until the first live sync confirms the canonical subdomain for this credential
- first live sync still needs to be rerun after dependency graph refresh

### 2026-03-25 — First live Avochato bootstrap sync

#### Business scope

Verified that the Avochato credentials are real and can see the live support transport footprint that Omni will need to govern.

The first successful bootstrap sync confirmed:

- Avochato credential owner: `francisco.fiedler@displai.ai`
- canonical account subdomain: `raydiant`
- visible Avochato accounts: `8`

### 2026-03-25 — Support identity and overflow hardening

#### Business scope

Adjusted the Support workspace so agents see the correct conversation identity and the UI stays stable on real Avochato threads.

Two product-level fixes were made:

- thread and conversation headers now prefer the real incoming customer identity instead of accidentally showing an agent name
- long subject / preview text now wraps safely so cards do not break their borders or push adjacent layout

This keeps the operator surface trustworthy and prevents confusing “agent-as-customer” presentation in live support threads.

#### Technical scope

- changed support conversation identity selection to prefer the first inbound sender display name / phone number before falling back to participant records
- removed the raw Avochato account subdomain fallback from the support company label so unmatched threads do not present transport metadata as customer context
- tightened overflow handling in the conversation list and selected thread header using wrap-friendly text classes and constrained badge layout
- suppressed empty company rows in the conversation list when no matched company context is available

#### Files touched

- [queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint passed
- `/support` returns `200`

#### Open risks / follow-ups

- customer identity still depends on transport payload quality, so a future pass should normalize phone display formatting for unmatched SMS threads
- if Avochato threads contain very long unbroken payload fragments, we may still want a dedicated utility class for message-body wrapping

### 2026-03-25 — Conversation list width stabilization

#### Business scope

Refined the Support conversation list so operators can reliably scan conversations without the selected card visually breaking its border or ambiguously presenting an agent name as the key secondary label.

This keeps the queue more trustworthy and easier to triage during live support work.

#### Technical scope

- replaced the left-column conversation list scroll surface with a simpler native overflow container to avoid width distortion from the previous scroll wrapper
- constrained conversation cards to the available column width more aggressively
- changed the lower metadata row from a bare agent name to an explicit `Owner: ...` label so agent attribution is still present without reading like the customer identity

#### Files touched

- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint passed
- `/support` returns `200`

#### Open risks / follow-ups

- if long Avochato subjects still force awkward wrapping, the next step should be a tighter max-width on the selected-state card header specifically

### 2026-03-25 — Anthropic support agent foundation

#### Business scope

Started the first real AI assistant path inside Omni Support using Anthropic-backed inference.

This gives support operators a live `AI Agent` pane that can reason over:

- the selected support thread
- current support workflow state
- matched Omni customer context when available
- billing / renewal / assignment context

The first version is intentionally read-only and assistive. It helps agents summarize cases, suggest next steps, and draft internal guidance without sending anything to customers automatically.

#### Technical scope

- added a new `@omnibridge/anthropic` integration package as a thin wrapper around Anthropic's Messages API
- added `apps/console/src/app/api/support/agent/route.ts` with:
  - session enforcement
  - support-channel access enforcement
  - selected conversation lookup
  - compact support context building
  - Anthropic request / response handling
  - audit logging through `AuditLog`
- extracted shared support helpers into `support/shared.ts` so the support read model and the new AI route can reuse the same conversation identity and 360 context logic
- connected the existing `AI Agent` pane in `/support` to the new route so agents can ask live questions and receive Claude responses

#### Files touched

- [package.json](/Users/franciscofiedler/OmniBridge-v2/apps/console/package.json)
- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/src/index.ts)
- [package.json](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/package.json)
- [tsconfig.json](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/tsconfig.json)
- [.eslintrc.js](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/.eslintrc.js)
- [shared.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/shared.ts)
- [queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/support/agent/route.ts)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint passed
- `/support` returns `200`
- `/api/support/agent` accepts authenticated requests once `ANTHROPIC_API_KEY` is loaded into the dev server env

#### Open risks / follow-ups

- this first version is non-streaming, so responses arrive as a single payload
- the AI pane is not yet persisted as part of the support conversation record
- `Copy response` is a stopgap; note insertion and draft-reply insertion should be wired into the support workflow later
- tool use is not enabled yet; the agent is currently context-only, not action-taking
- visible Avochato users: `15`

This is the first proof that Omni can mirror real Avochato channel boundaries instead of staying on mock data.

#### Technical scope

- wired local Avochato credentials into `apps/console/.env.local`
- added `AVOCHATO_DEFAULT_SUBDOMAIN=raydiant` after the first successful identity check
- fixed `@omnibridge/console` workspace dependency wiring for `@omnibridge/avochato`
- identified and fixed a Prisma null-composite-key issue in `SupportAgentChannelAccess` sync by replacing `upsert` with a null-safe `findFirst` + `update/create` path

#### Files touched

- [package.json](/Users/franciscofiedler/OmniBridge-v2/apps/console/package.json)
- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-sync/route.ts)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- first live sync returned:
  - account subdomain `raydiant`
  - `8` accounts processed
  - `8` endpoints processed
  - `15` users visible
- support channel accounts and endpoints were created successfully

#### Open risks / follow-ups

- the first sync exposed an access-write bug around nullable `channelEndpointId`; the route has been fixed but needs to be rerun to populate `SupportAgentChannelAccess`
- conversation and message ingest are still pending on webhook payload flow and/or backfill

### 2026-03-25 — Avochato conversation backfill + live Support read

#### Business scope

Omni Support is no longer just a UI scaffold. It now ingests recent live Avochato thread history into the support domain and renders `/support` from those normalized records instead of relying only on mock conversations.

This gives us the first working product loop:

- Avochato owns SMS/chat transport
- Omni mirrors recent conversation history locally
- Omni enforces visibility through synced channel access
- `/support` reads the normalized support tables

This is still an early operational read model, not a finished support product:

- some conversations link cleanly to Omni customers already
- others remain unlinked and need stronger phone/email/account reconciliation

#### Technical scope

Added:

- a recent-message backfill sync route:
  - `/api/cron/avochato-conversations-sync`
- first server-side support query layer for `/support`
- typed support workspace DTOs
- `/support` now loads live normalized conversations and only falls back to mock data if no live records are available

The backfill route currently:

- iterates visible Avochato accounts
- pulls recent messages page-by-page
- derives conversations from `ticket_id` / `contact_id`
- upserts:
  - `SupportConversation`
  - `SupportMessage`
  - `SupportParticipant`
- links customers deterministically where possible via:
  - Stripe customer phone
  - Salesforce contact phone/mobile phone
- records sync job status in `SyncJob`

The support page query currently:

- uses the signed-in Omni user via `requireSession()`
- filters visible support data through `SupportAgentChannelAccess`
- maps normalized support rows into the support workspace UI shape
- derives a first-pass 360 context from existing mirrors:
  - MRR from active Stripe subscription items
  - billing from open/uncollectible Stripe invoices
  - renewal from `Renewal.targetRenewalDate`
  - CSM from renewal owner or conversation assignee

#### Files touched

- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-conversations-sync/route.ts)
- [queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [types.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/types.ts)
- [page.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/page.tsx)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/src/index.ts)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- live conversation sync completed successfully
- first backfill result:
  - `84` support conversations
  - `541` support messages
  - `84` support participants
- sync job completed with:
  - `625` records processed
  - `0` errors
- `/support` returns `200`
- focused ESLint passed on:
  - conversation sync route
  - support queries
  - support page
  - support workspace
  - support DTOs
  - updated Avochato integration types

#### Open risks / follow-ups

- conversation derivation is currently based on Avochato message/ticket ids because the ticket listing endpoint did not return useful records for the default subdomain in our first probe
- customer linking is still partial; unlinked threads need:
  - better email matching
  - stronger phone normalization
  - Salesforce object id / Stripe id matching when available
- `/support` still uses a UI fallback if no live rows exist; we should remove that once the support domain is consistently populated
- next important step is webhook-driven incremental freshness, so the support workspace stops relying on backfill cadence

### 2026-03-25 — Ticket timeline events + assignee context

#### Business scope

Omni Support now starts preserving the operational timeline that agents actually care about inside Avochato, not just the raw inbound/outbound messages.

That means the support thread can now evolve toward showing:

- status changes
- ownership / assignee changes where available
- internal notes
- call records
- actor attribution and timestamps

This is important because the message transcript alone does not explain how a conversation moved between agents or why its state changed.

#### Technical scope

Extended the Avochato sync layer so conversation backfill now:

- fetches Avochato users per inbox for actor-name resolution
- fetches current ticket details for current status / assignee context
- fetches ticket event history from `/v1/tickets/:ids/events`
- filters out message events so we don’t duplicate the chat transcript
- upserts normalized `SupportConversationEvent` rows
- stores human-friendly event summaries and actor names in `payloadJson`
- maps current assignee into the conversation summary when possible

Also extended the Support read model and UI so `/support` now builds a single timeline from:

- `SupportMessage`
- `SupportConversationEvent`

and renders timeline events inline inside the thread.

#### Files touched

- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/avochato/src/index.ts)
- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/avochato-conversations-sync/route.ts)
- [queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [types.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/types.ts)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- real Avochato `ticket events` payload inspected successfully against a live ticket
- focused ESLint run planned after code wiring
- support conversation sync should be rerun after this change to populate the first timeline rows

#### Open risks / follow-ups

- Avochato clearly documents status/ticket events, but assignment-change payload shape still needs more live-ticket verification
- current event typing is intentionally broad; richer event taxonomy can come later if the UI needs it
- webhook ingest should eventually reuse the same timeline normalization so backfill and live updates do not drift

### 2026-03-25 — Support workspace alignment + matched-customer 360 rules

#### Business scope

Tightened the support workspace so agents can keep the full thread in front of them without the page fighting scroll, while also making the Customer 360 panel more trustworthy.

Two product rules were clarified in this pass:

- the thread header should prioritize the contact identity first
- Customer 360 should only show Omni customer context after a real customer match, never raw Avochato-only placeholders

#### Technical scope

Updated the support UI and DTO shape so:

- the middle thread pane is a real independently scrolling surface
- timeline items are rendered incrementally as the agent scrolls deeper into the thread
- conversation cards handle long subjects without clipping on the right edge
- the thread header now shows the contact identity first, with the subject beneath it
- `linkedCustomer` is now part of the workspace conversation shape
- Customer 360 shows an explicit empty state when no matched Omni customer exists

#### Files touched

- [types.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/types.ts)
- [queries.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/queries.ts)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint run planned after the UI patch
- `/support` should continue to render with real support data and fixed internal scrolling

#### Open risks / follow-ups

- thread pagination is currently client-side incremental rendering, not server-side cursor pagination yet
- once reply/send actions are live, the thread pane should auto-scroll to the newest item when an outbound message is created

### 2026-03-26 — Bottom-anchored support thread scrolling

#### Business scope

Adjusted the thread behavior so agents land on the newest activity by default instead of opening a conversation at the oldest visible content.

This better matches how support teams work in practice:

- latest messages and recent timeline actions should always be in view first
- older history should appear only when the agent intentionally scrolls upward

#### Technical scope

Updated the support thread pane so:

- the visible timeline window is now anchored to the end of the thread
- the thread scroll container defaults to the bottom on conversation change
- scrolling near the top loads older history while preserving the reader’s position

This keeps the page non-scrollable while making the middle pane behave more like a real messaging surface.

#### Files touched

- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint run planned after the scroll update

#### Open risks / follow-ups

- the thread currently lazy-loads older items from already-fetched timeline data; a future upgrade can move this to true server-side cursor pagination for very long conversations

### 2026-03-26 — AI Agent model toggle and cleanup

#### Business scope

Made the Support AI pane more usable for real operator testing by:

- letting agents switch between `Sonnet` and `Opus` directly in the box
- removing the last bit of fake AI-thread behavior so the pane starts clean on each conversation
- making it obvious which model generated each response

This gives the team a cheap default model for normal testing and a heavier reasoning mode for harder support cases without leaving Omni.

#### Technical scope

Extended the Anthropic helper with preset resolution for:

- default model = `Sonnet`
- complex model = `Opus`

Then threaded an optional `model` field through the Support AI route and updated the `/support` pane to:

- render a compact Sonnet/Opus toggle in the header
- include the selected model in each request
- tag assistant responses with the chosen model
- reset to an empty conversation state per thread instead of shipping any seeded sample exchange

#### Files touched

- [index.ts](/Users/franciscofiedler/OmniBridge-v2/packages/integrations/anthropic/src/index.ts)
- [route.ts](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/support/agent/route.ts)
- [support-workspace.tsx](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/support/support-workspace.tsx)
- [support-avochato-implementation-log.md](/Users/franciscofiedler/OmniBridge-v2/docs/support-avochato-implementation-log.md)

#### Validation

- focused ESLint passed on the touched Anthropic/support files
- `/api/support/agent` returned `200` with a live Anthropic response after the change

#### Open risks / follow-ups

- model choice is currently session-local UI state and is not yet persisted per user
- the route still relies on prompt-stuffed context only; tool use is the next major upgrade

---

## Next Recommended Steps

### Business scope

1. Start ingesting real Avochato conversations into Omni.
2. Ensure each support user only sees conversations for the Avochato inboxes / numbers they are allowed to access.
3. Begin customer auto-linking with deterministic rules before introducing AI ranking.

### Technical scope

1. Apply the support migration.
2. Add an Avochato inbox/user sync job.
3. Add support read queries against:
   - `SupportConversation`
   - `SupportMessage`
4. Wire `/support` to live support tables.
5. Add customer-linking logic:
   - Salesforce object id
   - Stripe customer id
   - phone match
   - email match
   - AI fallback suggestions later
