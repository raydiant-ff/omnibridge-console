# Opus Execution Prompt — Omni Containment Pass

You are performing a **short containment pass** on the Omni repo before any new product feature work resumes.

This is **not** a broad cleanup, redesign, or migration. Do **not** expand scope. Do **not** refactor unrelated code. Do **not** rebuild existing pages unless explicitly listed below.

Your job is to apply the containment audit exactly:

- fix the two active legacy hazards first
- add quarantine markers to legacy surfaces
- hide scaffold routes from navigation
- lock in the projection layer + new component system as the default path for all new work

## Operating rules

1. **Do not perform a giant cleanup.**
2. **Do not migrate existing product pages unless explicitly required below.**
3. **Do not delete uncertain legacy code during this pass.**
4. **Do not introduce new product-facing reads from `lib/queries/*`.**
5. **Do not add new components or props under `components/workspace/`.**
6. **Do not use raw mirror fields as product truth when a projection/source-of-truth helper exists.**
7. Keep diffs small, targeted, and easy to review.

---

## Why this containment pass exists

The audit conclusion is:

- the repo is safe enough to continue product work
- but only if two pre-flight fixes happen immediately
- and only if the projection layer becomes the enforced default going forward

The main risk is **adoption drift**, not missing infrastructure.

The projection layer and new UI foundation already exist. The problem is that most product pages still read from legacy query paths, so new work could easily relapse into the old architecture if we do not force the golden path now.

---

## Golden path — enforce this

For all **new** Omni product work:

### Data reads
Use:
- `lib/projections/*`
  - `getCustomerView()`
  - `getSubscriptionView()`
  - `getQuoteView()`
  - `getRenewalView()`
  - `getInvoiceView()`

Do **not** use:
- raw `lib/queries/*` for new product-facing page data

### Guardrails / derived truth
Use:
- `lib/repo/*`
- `SF_ACCOUNT_BASE_WHERE`
- `computeDaysToExpiry()`
- `classifyRenewalUrgency()`
- `SF_CONTRACT_LIST_SELECT`

Do **not** use directly as product truth:
- `SfContract.stripeStatus`
- `SfContract.daysTillExpiry`

### Mutations
Use:
- `lib/actions/*`

Do **not** use:
- direct Prisma calls in page files or route files for new workflow logic

### Components
Use only:
- `components/shell/`
- `components/layout/`
- `components/panels/`
- `components/states/`
- `components/data/`
- `components/omni/`
- `components/ui/`

Do **not** invest further in:
- `components/workspace/`

### Hard rule for upcoming product work
- Customer 360 starts on `getCustomerView()`
- Renewals starts on `getRenewalView()`
- no new page should read from `lib/queries/*` unless it is an explicitly tolerated legacy/admin/scaffold path

---

## Required work in this containment pass

### 1) Pre-flight fix #1 — patch `customers.ts`

File:
- `apps/console/src/lib/queries/customers.ts`

Problem:
- customer search paths can return stub Salesforce accounts

Required fix:
- patch the search path so search always excludes stub SF accounts
- specifically, add `...SF_ACCOUNT_BASE_WHERE` to the `SfAccount` where clause in `searchCustomersUnified()`

Intent:
- customer search must never surface placeholder/stub Salesforce records

Acceptance criteria:
- all customer search paths exclude stub accounts
- no unrelated refactor in this file
- if a legacy warning header is appropriate here, add it without changing runtime behavior

---

### 2) Pre-flight fix #2 — patch `sf-contracts.ts`

File:
- `apps/console/src/lib/queries/sf-contracts.ts`

Problem:
- contract surfaces currently expose cached `stripeStatus` as if it were product truth
- that field is stale mirror state, not authoritative billing state

Required fix:
- stop returning/exposing `SfContract.stripeStatus` as authoritative contract billing status
- remove `stripeStatus: c.stripeStatus` from contract list outputs
- remove the spread-through exposure in contract detail if present
- update the consuming contract detail display to use `stripeSubscription.status` from the already-available relationship or the appropriate subscription-backed source

Intent:
- contract UI must stop treating cached Salesforce mirror status as truth

Acceptance criteria:
- list/detail surfaces no longer present `SfContract.stripeStatus` as authoritative state
- contract detail reads live/real subscription status from the correct joined/subscription source
- no large contract workspace rebuild during this pass

---

### 3) Add quarantine / deprecated headers

Add file-level comments to clearly mark legacy surfaces that must not be extended.

#### `apps/console/src/lib/queries/cs-renewals.ts`
Add a header equivalent to:

```ts
// QUARANTINE: Legacy query file. Do not extend.
// New renewal data reads must use getRenewalView() / getRenewalViewsForWindow()
// from lib/projections/renewal-view.ts.
// This file remains for the CS renewals dashboard surface until it is rebuilt
// on the projection layer.
```

#### `apps/console/src/lib/queries/customer-signals.ts`
Add a header equivalent to:

```ts
// DEPRECATED: Ad hoc signal computation. Do not add new signal types here.
// New signals must be written to AccountSignal via sync events and read from
// lib/projections/customer-view.ts.
```

#### `apps/console/src/lib/queries/cs-dashboard.ts`
Add a legacy header indicating it is tolerated legacy dashboard aggregation and must not be extended for new product work.

#### `apps/console/src/components/workspace/index.ts`
Add a header equivalent to:

```ts
// LEGACY COMPONENT SYSTEM: Do not add new components here.
// New pages must use components/layout/, components/panels/, components/states/,
// components/data/, and components/omni/ instead.
```

#### `apps/console/src/app/(app)/customers/[id]/360/mock-data.ts`
Add a header equivalent to:

```ts
// DELETE BEFORE WIRING: This file must be deleted before the Customer 360 page
// is connected to real data. Customer360ViewModel is incompatible with CustomerView
// projection types. Build on lib/projections/customer-view.ts instead.
```

Acceptance criteria:
- headers are added cleanly
- comments are specific, firm, and instruct future contributors away from legacy paths
- no runtime behavior changes from these comment-only edits

---

### 4) Freeze `components/workspace/`

This is a policy enforcement step, not a rewrite.

Required action:
- add the legacy comment in the index/barrel
- do not add any new components
- do not add any new props
- do not migrate old pages during this pass

Acceptance criteria:
- the repo clearly signals that `components/workspace/` is legacy
- no new development path points into this folder

---

### 5) Remove scaffold pages from navigation

Scaffold pages currently erode trust and invite shortcuts.

Hide these routes from sidebar/navigation until they are properly rebuilt on projections:
- `/invoices`
- `/payments`
- `/payment-methods`
- `/products`

Notes:
- this is a navigation containment step, not necessarily route deletion
- prefer removing them from nav rather than deleting files in this pass
- do not break direct route access unless the current nav architecture requires a different safe containment approach

Acceptance criteria:
- these scaffold routes no longer appear in app navigation
- no unrelated nav restructuring

---

### 6) Document / enforce the architectural default in-repo

Wherever the repo has a concise contributor-facing architectural note, ensure it reflects the following rules:

- new product pages must read from `lib/projections/*`
- new product pages must use `lib/repo/*` helpers for guardrails and derivations
- new product pages must use the new shell/layout/panel/state/data/omni systems
- `lib/queries/*` is tolerated legacy, not the default for new product page data
- `components/workspace/` is legacy and frozen

This can be done via the most appropriate lightweight repo mechanism already present:
- a local README
- an architecture note
- a contributor doc
- a clearly named inline policy file

Do **not** create documentation sprawl. One concise enforcement note is enough.

Acceptance criteria:
- future contributors have an obvious golden path
- the repo’s path of least resistance shifts toward projections and the new component foundation

---

## Explicitly out of scope

Do **not** do any of the following in this pass unless a tiny edit is strictly required to complete the listed tasks:

- no broad migration of `/customers/[id]`
- no broad migration of `/quotes`
- no broad migration of `/subscriptions`
- no rebuild of renewals workspace
- no rebuild of contracts workspace
- no rebuild of Customer 360
- no deletion of whole legacy directories except nav hiding/comment headers if required
- no sweeping Prisma-to-actions rewrite
- no large raw SQL rewrite in `cs-renewals.ts`

This pass is about containment, not completion.

---

## Nice-to-have only if trivial and directly adjacent

Only do these if they are extremely small, obviously correct, and do not expand scope:

- add a warning header to `lib/queries/customers.ts`
- add a warning header to `lib/queries/sf-contracts.ts`
- add an inline audit note near any `cs-renewals.ts` `$queryRawUnsafe` call sites indicating they require follow-up verification/migration

Do not let these delay the required tasks.

---

## Deliverables

When done, provide:

1. A short summary of exactly what changed.
2. A file-by-file change list.
3. Any follow-up items you intentionally did **not** do because they were out of scope.
4. Any risks or ambiguities discovered during implementation.

---

## Definition of done

This containment pass is complete only when all of the following are true:

- `customers.ts` search path excludes stub Salesforce accounts
- `sf-contracts.ts` no longer exposes cached `stripeStatus` as product truth
- the contract detail surface uses the correct subscription-backed status source
- quarantine/deprecated headers are added to the named legacy files
- `components/workspace/` is explicitly marked legacy/frozen
- scaffold routes are removed from navigation
- the repo contains a concise contributor-facing note that new product work must use projections + repo helpers + the new component system
- no large unrelated cleanup was performed

If you encounter a decision point, choose the **smallest containment-preserving change**.
