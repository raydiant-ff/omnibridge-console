# Omni Support v1

## Goal

Build a support workspace inside Omni that lets agents triage and respond to customer conversations with full account context, without waiting for Atlas to become the shared read model.

This is an **operational workflow module**, not a reporting product.

The support workspace should:
- centralize inbound support conversations
- show account, billing, and CRM context next to the conversation
- support assignment, prioritization, tagging, and notes
- create a clean path for Avochato SMS/chat and a later Gmail email integration

## Why Now

Atlas is currently a blocker for the shared source-of-truth/read-model strategy. Support is less blocked because its core value is:
- conversation handling
- agent workflow
- contextual triage
- operational follow-up

That means Support can move forward in Omni now, as long as we keep the boundaries clear:
- **Omni** = workflow and action surface
- **mirrors** = current operational read model
- **Atlas** = future shared read model for analytics and department dashboards

## Product Decision

Build Support **inside Omni**, not as a separate app.

Reasons:
- support agents benefit heavily from existing customer context
- we already have customer, billing, contract, renewal, and audit primitives here
- building a separate app would force us to rebuild identity, context stitching, and navigation
- support should be a modular domain inside Omni, not a disconnected helpdesk

## Scope

### In for v1

- support inbox
- conversation list
- thread view
- customer context side panel
- assignment
- status
- priority
- channel label
- internal notes
- tags
- basic search and filters
- audit trail for actions taken in Omni
- Avochato-backed SMS and live chat support
- inbox/number-aware agent permissions mirrored from Avochato

### Out for v1

- advanced analytics/reporting
- AI summarization/assist
- SLA engine
- auto-routing
- macros/templates
- CSAT
- knowledge base
- full omnichannel history backfill
- outbound campaigns
- Gmail email integration

## Source-of-Truth Strategy

### Near term

- **Avochato** is the source of truth for SMS/chat transport and message delivery state
- **Gmail** will later be the source of truth for email transport
- **Omni** stores a normalized support read/write model for agent workflow
- **Stripe/Salesforce mirrors** provide customer context for the right-side panel

### Long term

- Atlas may eventually provide shared read models for customer/account health
- Support should be built so its context layer can swap from current mirrors to Atlas-backed reads later

### Rule

Do not make support depend on Atlas right now.

## Channel Strategy

### Avochato

- use for `sms` and `chat`
- treat Avochato inboxes / numbers as the hard permission boundary
- mirror those permissions into Omni and never show a user threads from inboxes or numbers they cannot access in Avochato

### Gmail

- implement later as a separate integration, not as an Avochato sub-feature
- model it under the same Omni support domain so the UI can eventually show unified support work without sharing the same transport adapter

## Assignment Strategy

### Recommendation

- **Omni owns routing and assignment logic**
- **Avochato gets updated with the chosen assignee**

Why:
- Omni can route with richer context than Avochato alone:
  - billing state
  - CSM ownership
  - renewal timing
  - Stripe/Salesforce degradation
- Avochato auto-assignment is useful, but should be fallback behavior, not the primary workflow engine

### Fallback

- keep Avochato auto-assignment available as a backup if Omni routing is unavailable
- always reconcile assignment drift via webhook + periodic sync

## User Roles

Relevant existing role support:
- `support`
- `admin`

Potential future read-only viewers:
- `csm`
- `finance`

v1 recommendation:
- `support` and `admin` can use the workspace fully
- `csm` can view support context later, but should not be in initial scope unless needed

## Primary UX

### Main route

- `/support`

### Supporting routes

- `/support/[conversationId]`
- `/support/inbox`
- `/support/unassigned`
- `/support/urgent`
- `/support/mine`

These can all be implemented as filtered states of one main workspace.

## Core Layout

Three-pane operational layout:

1. **Left rail / queue controls**
- inbox segments
- saved filters
- channel filters
- status filters
- assignment filters

2. **Conversation list**
- customer/contact name
- channel
- last message snippet
- last activity time
- assignee
- priority
- unread / waiting / open state

3. **Conversation workspace**
- thread in the center
- customer/account context panel on the right

This should feel closer to an operations inbox than a CRM form.

## Automatic Association Strategy

Support channels should automatically associate a thread to the right Omni customer whenever possible.

### Deterministic matching first

1. explicit Salesforce / Stripe identifiers from the transport payload
2. exact phone-number match to a known customer/contact
3. exact email match to a known customer/contact
4. exact domain + contact-name heuristic when email exists but direct contact match fails

### AI-assisted fallback second

If deterministic matching fails:
- use an AI-assisted ranking step to suggest likely customer matches
- do not silently auto-link on low-confidence guesses
- show a support-side confirmation workflow for ambiguous matches

### Rule

AI should help with **ranking and suggestion**, not replace hard-linking rules for v1.

## Customer Context Panel

The right-side panel is the reason Support belongs in Omni.

It should include:
- customer name
- domain
- Stripe customer id
- Salesforce account id
- account owner / CSM
- active subscriptions
- MRR / ARR
- open invoices / past due invoices
- renewal timing
- recent support notes
- recent audit events
- quick links to:
  - customer 360
  - CS dashboard item
  - renewals
  - quotes

This panel should be mostly read-only in v1.

## Data Model

Add a dedicated support domain. Do not overload `WorkItem` for all of this.

### New models

#### `SupportConversation`

Purpose:
- normalized conversation thread record

Suggested fields:
- `id`
- `externalSystem` (`avochato`)
- `externalConversationId`
- `customerIndexId` nullable
- `sfAccountId` nullable
- `stripeCustomerId` nullable
- `channel` (`sms`, `email`, `chat`)
- `status` (`open`, `pending_customer`, `pending_internal`, `resolved`, `closed`, `spam`)
- `priority` (`low`, `normal`, `high`, `urgent`)
- `subject` nullable
- `assigneeUserId` nullable
- `lastMessageAt`
- `firstMessageAt`
- `lastInboundAt` nullable
- `lastOutboundAt` nullable
- `waitingOn` (`customer`, `internal`, `none`) nullable
- `tagsJson` or separate join table later
- `rawSummaryJson` nullable
- `createdAt`
- `updatedAt`
- `channelAccountId` nullable
- `channelEndpointId` nullable
- `externalAccountSubdomain` nullable
- `syncState`
- `lastWebhookAt` nullable
- `lastSyncedAt` nullable

#### `SupportMessage`

Purpose:
- normalized message timeline

Suggested fields:
- `id`
- `conversationId`
- `externalMessageId`
- `direction` (`inbound`, `outbound`, `system`)
- `channel`
- `messageType` (`text`, `email`, `chat`, `note`, `event`)
- `body`
- `bodyHtml` nullable
- `subject` nullable
- `fromDisplay`
- `fromAddress`
- `toAddress`
- `sentAt`
- `deliveryState` nullable
- `authorUserId` nullable
- `payloadJson`
- `createdAt`

#### `SupportParticipant`

Purpose:
- track customer/contact/channel identities on a thread

Suggested fields:
- `id`
- `conversationId`
- `role` (`customer`, `agent`, `cc`, `system`)
- `externalContactId` nullable
- `name`
- `email` nullable
- `phone` nullable
- `sfContactId` nullable
- `stripeCustomerId` nullable
- `createdAt`

#### `SupportConversationEvent`

Purpose:
- audit important workflow changes

Suggested fields:
- `id`
- `conversationId`
- `type` (`assigned`, `status_changed`, `priority_changed`, `tagged`, `linked_customer`, `sync_error`)
- `actorUserId` nullable
- `payloadJson`
- `createdAt`

#### `SupportChannelAccount`

Purpose:
- mirror an Avochato inbox/account boundary into Omni

Suggested fields:
- `id`
- `externalSystem`
- `externalAccountId`
- `externalSubdomain`
- `name`
- `phone`
- `metadataJson`

#### `SupportChannelEndpoint`

Purpose:
- mirror a concrete transport endpoint such as an Avochato number or later a Gmail mailbox

Suggested fields:
- `id`
- `channelAccountId`
- `externalSystem`
- `externalEndpointId`
- `channel`
- `label`
- `address`
- `active`
- `metadataJson`

#### `SupportAgentChannelAccess`

Purpose:
- mirror which agents can access which inboxes / endpoints

Suggested fields:
- `id`
- `userId`
- `channelAccountId`
- `channelEndpointId` nullable
- `externalUserId`
- `externalRole`
- `assignedOnly`
- `canReply`
- `canAssign`
- `createdAt`
- `updatedAt`

### Existing models to reuse

- `User`
- `CustomerIndex`
- `AuditLog`
- `CustomerNote`
- `WorkItem`

Use `WorkItem` only for follow-up tasks that arise from support, not as the primary conversation model.

## Integration Boundary: Avochato

Treat Avochato as a **channel adapter**, not your source of business context.

### What Avochato should provide

- inbound/outbound messages
- conversation ids
- participant/contact info
- message timestamps
- delivery status
- channel type
- webhook events

### What Omni should own

- conversation assignment
- support queue state
- contextual account linking
- internal notes
- tags and workflow status
- follow-up tasks
- operator-facing customer context

### Ingestion model

Preferred v1:
- webhook-driven sync into Omni tables
- periodic reconciliation job for missed events

Do not make the support inbox query Avochato live on every page load.

## Linking Conversations to Accounts

This is one of the most important pieces.

### Matching order

1. explicit external identifiers if available
2. phone number match
3. email/domain match
4. manual link by agent

Once linked, store the `customerIndexId`.

Do not rely on a fuzzy match every time a conversation loads.

## v1 Workflow

1. inbound message arrives from Avochato webhook
2. Omni upserts `SupportConversation`
3. Omni stores message in `SupportMessage`
4. Omni attempts customer linkage
5. conversation appears in inbox
6. agent opens thread
7. agent sees customer context
8. agent assigns / tags / changes status
9. agent responds via Avochato channel adapter
10. Omni logs the action in `SupportConversationEvent` and `AuditLog`

## UI Components

Reuse the current Omni v1 language:
- shell/sidebar
- metric cards where needed
- table/list shell
- sheets/drawers
- badges
- filters

### Components to add

- `SupportInboxList`
- `SupportConversationThread`
- `SupportContextPanel`
- `SupportStatusBadge`
- `SupportPriorityBadge`
- `SupportComposer`
- `SupportFilterBar`

## Phase Plan

### Phase 1

Goal:
- a real internal support inbox with account context

Build:
- schema for support conversations/messages
- webhook ingestion stub
- `/support` route
- inbox list
- thread view
- right-side context panel
- assignment/status/priority
- simple notes

### Phase 2

Build:
- outbound reply flow
- better participant linking
- tags
- search
- saved filters
- support-specific work item creation

### Phase 3

Build:
- chat if Avochato supports it well enough
- macros
- SLA timers
- AI summary / suggested reply
- cross-functional views for CSM/finance

## Technical Risks

1. account linkage quality
- the inbox becomes much weaker if threads are not reliably mapped to `CustomerIndex`

2. channel normalization
- SMS, email, and chat may not map cleanly to one message model at first

3. webhook idempotency
- message/event ingestion must be idempotent

4. auth/permissions
- support edits and outbound messages need auditability

5. too much scope too early
- keep v1 as an inbox + context surface, not a full Zendesk replacement

## Recommendation

Start now with:
- support schema
- Avochato adapter boundary
- `/support` route
- inbox + thread + context panel

Do **not** wait for Atlas.

Do **not** overfit reporting first.

Build the support workspace as a focused operational module in Omni, using the current mirrored customer context and leaving room to swap in Atlas-backed reads later.
