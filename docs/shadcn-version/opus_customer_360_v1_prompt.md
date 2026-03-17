# Opus Build Prompt — Customer 360 v1 on Projections

You are implementing the **first real projection-backed Omni product surface**.

This is **not** a brainstorming task and **not** a broad cleanup pass. Execute the build.

The containment pass is already complete. The architectural decision is already made:
- new product pages must use `lib/projections/*`
- new product pages must use `lib/repo/*` guardrails
- new product UI must use the new shell/layout/panels/states/data/omni component system
- `components/workspace/*` is frozen legacy
- `/customers/[id]/360` must be rebuilt on projections, not extended on mock types or legacy query paths

Your job is to build **Customer 360 v1** as the first undeniable proof of the new Omni architecture.

---

## 1. Mission

Rebuild `app/(app)/customers/[id]/360` as a **real customer operating workspace** backed by projections.

This page is **not a dashboard**.
It is an **account workspace** for CS / renewals / sales / billing operators.

The page should answer, in order:
1. Who is this customer?
2. What matters right now?
3. What is the commercial state?
4. What happened recently?
5. What should I do next?

This is the first vertical slice that turns the projection layer from infrastructure into actual product.

---

## 2. Product framing you must follow

Treat shadcn as the **foundation**, not the product language.

Build in 4 layers:

### Layer 1 — Foundation
Use existing shadcn/ui primitives and existing internal primitives where appropriate:
- buttons
- inputs
- badges
- tabs
- sheets/dialogs
- tables
- separators
- skeletons
- tooltips/popovers
- scroll areas

### Layer 2 — Omni primitives
Prefer or create small product-facing primitives that make the UI feel like Omni, not like generic admin UI. Examples of acceptable patterns:
- entity header pieces
- signal chips / status pills
- metric pills
- owner chips
- risk flags
- linked record pills
- timeline event rows
- action dock items

### Layer 3 — Omni modules
The page should be composed out of business modules, not random cards. Expected module shapes:
- Customer Identity Bar
- Signal Strip
- Account Snapshot / Commercial Summary
- Subscriptions + Contracts panel
- Renewal panel
- Activity / Timeline panel
- Action rail
- Related records sections

### Layer 4 — Workspace template
This page should feel like a **customer workspace**, not a company-wide homepage and not a chart-heavy dashboard.

---

## 3. Hard architecture rules (non-negotiable)

### Data access
Approved:
- `lib/projections/customer-view.ts`
- `lib/projections/renewal-view.ts`
- other projection helpers only if truly needed
- `lib/repo/*` guardrails/utilities

Forbidden for this page:
- new reads from `lib/queries/*`
- direct Prisma in the page or page-local loader
- page-level reads from stale Salesforce/Stripe mirrored status fields when projection/live view exists

### UI system
Approved:
- `components/shell/*`
- `components/layout/*`
- `components/panels/*`
- `components/states/*`
- `components/data/*`
- `components/omni/*`
- `components/ui/*`

Forbidden:
- new imports from `components/workspace/*`
- adding new props or new files to `components/workspace/*`

### Mocking
Forbidden:
- extending `mock-data.ts`
- introducing new page-local view models that compete with projections

Expected:
- delete or bypass `customers/[id]/360/mock-data.ts`
- build directly on real projection types

---

## 4. Route target

Primary route:
- `app/(app)/customers/[id]/360/*`

The page must start from:
- `getCustomerView()`

If renewal-specific data is needed and not already present in the customer projection, pull it through approved projection/repo paths only.

Do **not** solve missing data by regressing to legacy query files.

---

## 5. Build target: Customer 360 v1 scope

Build only the first meaningful slice.
Do not try to complete the whole platform.

### Required v1 page anatomy

#### A. Sticky Customer Identity Bar
Must sit at the top of the workspace content area and stay visible.

Should include as available from real data:
- customer/account name
- parent / billing context if available
- lifecycle or status badge
- ARR / commercial headline metric if available
- owner / CSM / account owner if available
- compact set of key identifiers or linked entities if available

Goal:
The user should immediately know which account they are in and what commercial posture they are looking at.

#### B. Signal Strip
A dense horizontal row directly beneath the identity bar.

Target signal categories:
- health / risk
- renewal urgency
- subscription state
- billing risk / failed payment / delinquency if available
- open tasks / open opportunities / open work if available

This row should feel operational, not decorative.
Use concise pills / compact cards, not oversized marketing tiles.

#### C. Main 3-column workspace
Use a 12-column grid.
Desktop target:
- left = narrative / context
- center = commercial / revenue / contracts
- right = sticky execution rail

##### Left column — Narrative / context
Build one or two panels from real data, with best-effort fallbacks:
- recent activity / timeline
- customer journey / recent milestones
- notes / contextual summary if available
- product or billing signal summary if timeline depth is limited

The point of this column is answering: “What has happened lately, and what is the story?”

##### Center column — Commercial state
This is the most important column.
It should prove Omni understands the account commercially.

Required panels:
1. **Subscriptions / Contracts panel**
   - show active and relevant records
   - display plan / product / term / dates / amounts when available
   - surface relationship between subscription and contract where possible
   - do not display stale `stripeStatus` from legacy contract mirrors as truth

2. **Renewal panel**
   - show next renewal / urgency / amount / timing if available
   - include a strong visual “what is upcoming” summary
   - use computed/projection-backed date/urgency logic, not old local fields

Optional if data is already easy:
- locations / billing entity summary
- invoice or quote summary block

##### Right column — Action rail
Sticky on desktop.
Focus on operator usefulness.

Include best-effort sections such as:
- owner / assignment
- next best action
- quick actions (safe placeholders allowed only if clearly UI-only)
- open tasks / reminders / risk callouts
- links to adjacent records

This rail should answer: “What do I do from here?”

#### D. Lower related-record sections
Below the main 3-column workspace, add one or two deeper sections only if supported cleanly by data:
- contacts
- invoices
- quotes
- renewal history
- related subscriptions/contracts table

Do not add empty module spam.
If a section is weak, omit it and keep the page dense and credible.

---

## 6. UX / layout rules

### Overall feel
This should feel closer to a **Vitally / Gainsight-style account workspace** than to a generic SaaS KPI dashboard.

### Density
Prefer:
- concise information density
- compact spacing
- clear scanning hierarchy
- high signal-to-noise

Avoid:
- giant hero cards
- decorative charts with weak meaning
- generic admin-dashboard filler
- lots of empty whitespace pretending to be premium

### Composition
Use panels/modules with clear section hierarchy.
Favor a consistent shell:
- workspace header / breadcrumb where appropriate
- sticky identity bar
- signal strip
- content grid
- deeper related sections

### Responsiveness
- Desktop: 12-col grid, 3 main columns
- Tablet: collapse right rail below center
- Mobile: single-column stack in priority order:
  identity → signals → actions → commercial → narrative → related

---

## 7. Engineering approach

Implement in this order:

### Step 1 — Remove mock coupling
- eliminate dependence on `mock-data.ts`
- remove competing mock `Customer360ViewModel` assumptions
- align page typing to real projection data

### Step 2 — Wire real loader
- start from `getCustomerView()`
- resolve route/account identity cleanly
- add projection-backed renewal/commercial data only via approved paths

### Step 3 — Build shell using approved components only
- use `layout/*`, `panels/*`, `states/*`, `data/*`, `omni/*`, `ui/*`
- do not import from frozen workspace components

### Step 4 — Build the identity bar + signal strip first
These two pieces should immediately make the page feel real even before deeper panels are complete.

### Step 5 — Build commercial center column next
This is the most important proof of value.
The subscriptions/contracts panel + renewal panel should be the strongest part of the page.

### Step 6 — Add narrative/context + action rail
Best effort, but make them coherent and useful.

### Step 7 — Tighten states
Add clean:
- loading state
- empty state
- partial-data resilience
- error state

The page must still feel intentional when some data is absent.

---

## 8. Explicit guardrails for missing data

If the current projections do not expose every ideal field:
- do not regress to legacy query architecture
- do not invent a second data model
- do not over-engineer new backend abstractions unless truly necessary

Instead:
- build a strong page from what is already available
- identify any missing projection fields cleanly
- add small projection-safe extensions only if required
- keep the page credible under partial data

Best effort is preferred over architectural relapse.

---

## 9. Visual / semantic guidance

Use this information hierarchy:

### Top layer
Identity + status + commercial headline

### Second layer
Signals / urgency / health / renewal timing / billing issues

### Third layer
Commercial truth:
- subscriptions
- contracts
- renewal state
- linked billing data

### Fourth layer
Narrative + actions:
- recent events
- notes/context
- next actions
- linked records

The page should feel like:
- customer-centric
- commercially aware
- operator-friendly
- serious and enterprise-ready

It should **not** feel like:
- a BI homepage
- a placeholder CRM record page
- a random card collage

---

## 10. Out of scope for this pass

Do not spend time on these unless absolutely necessary for the page to render:
- global repo cleanup
- broad migration of other pages
- renewals workspace rebuild
- invoices/payments/product scaffold resurrection
- speculative chart systems
- pixel-perfect design system expansion
- large new backend modeling efforts

This pass is about making **Customer 360 v1 real**.

---

## 11. Acceptance criteria

The implementation is complete only if all of the following are true:

1. `/customers/[id]/360` is backed by real projection data, not mock data.
2. The page starts from `getCustomerView()`.
3. No new product-facing reads were added through `lib/queries/*`.
4. No new `components/workspace/*` usage was introduced.
5. The page has a visible sticky identity bar.
6. The page has a visible signal strip.
7. The page has a real commercial center column with subscriptions/contracts + renewal emphasis.
8. The page has a coherent action rail and at least one narrative/context area.
9. Empty / partial data states look intentional.
10. The implementation clearly establishes the new golden path for future product pages.

---

## 12. Deliverable format

Return:
1. concise summary of what was implemented
2. list of files added/changed
3. any small projection-safe follow-ups still recommended
4. confirmation that no forbidden legacy paths were introduced

Do not return a strategy essay.
Execute the build.
