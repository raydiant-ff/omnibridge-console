 Omni Legacy Code Containment Audit

  ---
  1. Golden Path Definition

  The approved implementation path for all new Omni work:

  Data access

  ┌───────────────────┬────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────┐
  │       Layer       │                                  What to use                                   │                 What never to use                  │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Product UI read   │ lib/projections/* — getCustomerView, getSubscriptionView, getQuoteView,        │ Raw lib/queries/* for product-facing page data     │
  │ models            │ getRenewalView, getInvoiceView                                                 │                                                    │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Guardrails        │ lib/repo/ — SF_ACCOUNT_BASE_WHERE, computeDaysToExpiry(),                      │ Reading SfContract.daysTillExpiry,                 │
  │                   │ classifyRenewalUrgency(), SF_CONTRACT_LIST_SELECT                              │ SfContract.stripeStatus directly                   │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Mutations         │ lib/actions/* — server actions with requireSession(), try/catch, audit log     │ Direct Prisma in page components or route files    │
  │                   │ writes                                                                         │                                                    │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Identity          │ CustomerIndex as a join key for projections only                               │ CustomerIndex as the product-facing Customer       │
  │ resolution        │                                                                                │ entity                                             │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Billing state     │ StripeSubscription.status via projections                                      │ SfContract.stripeStatus cached field               │
  ├───────────────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Contract timing   │ computeDaysToExpiry(contract.endDate)                                          │ SfContract.daysTillExpiry stored field             │
  └───────────────────┴────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────┘

  Workflow state

  New product workflows live in Omni-owned entities (Renewal, CustomerNote, AccountSignal), not in mirror tables. No new workflow state should be embedded into
  SfContract, StripeSubscription, or QuoteRecord.

  Component layer

  ┌──────────────────────────────────────────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────┐
  │                                System                                │        Approved for new work         │        Do not invest in        │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/shell/ — AppShell, ShellProvider, SidebarShell            │ ✅ New page shells                   │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/layout/ — WorkspaceContainer, PageViewport, PageHeader    │ ✅ All new page layouts              │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/panels/ — Panel, PanelHeader, PanelContent                │ ✅ All new content panels            │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/states/ — LoadingBlock, EmptyBlock, ErrorBlock            │ ✅ All new state surfaces            │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/data/ — DataTableShell, DataList, RecordField             │ ✅ All new data surfaces             │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/omni/ — SectionPanel, StatStrip, SignalRow, DataRow       │ ✅ Customer 360 / workspace surfaces │ —                              │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/workspace/ — PageHeader, DetailGrid, FieldRow, TableShell │ Tolerable for existing pages         │ Don't build new pages on these │
  ├──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┤
  │ components/ui/ — shadcn primitives                                   │ ✅ Everywhere                        │ —                              │
  └──────────────────────────────────────────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────┘

  Mirrors

  Mirror tables (stripe_subscriptions, sf_contracts, sf_accounts, etc.) are infrastructure caches. They may be read by projections through guardrails. They must
   not be queried directly by product UI outside of the projection layer.

  ---
  2. Codebase Classification

  Keep and actively build on

  ┌─────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
  │                                  Area                                   │                            Why                            │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ lib/projections/ (all 6 files)                                          │ Correct architecture, guardrails enforced, properly typed │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ lib/repo/ (all 4 files)                                                 │ Centralized guardrails, source-of-truth helpers           │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ lib/actions/quotes.ts, finalize-quote-acceptance.ts, sf-quote-mirror.ts │ Core quote/acceptance workflow, well-structured           │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ lib/actions/create-subscription.ts                                      │ Clean Stripe subscription creation                        │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ packages/integrations/stripe, salesforce, docusign                      │ Live, used, correct lazy singleton pattern                │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ components/shell/, layout/, panels/, states/, data/, omni/              │ New foundation                                            │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ components/ui/ (shadcn primitives)                                      │ Standard                                                  │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ app/(app)/quotes/ (all wizard steps)                                    │ Core product surface, actively maintained                 │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ app/(app)/cs/ renewals workspace                                        │ Core CSM surface                                          │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ app/(app)/customers/[id]/                                               │ Core customer surface                                     │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ app/accept/[token]/                                                     │ Quote acceptance flow (public)                            │
  ├─────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
  │ app/api/stripe/webhook, api/docusign/webhook                            │ Production-critical webhook handlers                      │
  └─────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

  Keep but quarantine

  ┌───────────────────────────────────────────┬──────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
  │                   Area                    │                       Why                        │                    Quarantine action                    │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ lib/queries/cs-renewals.ts (764 LOC)      │ Core to CS renewals but uses $queryRawUnsafe, no │ Add // LEGACY: do not extend header; route new renewal  │
  │                                           │  isStub guard, complex raw SQL aggregation       │ data reads through getRenewalViewsForWindow             │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ lib/queries/customers.ts (541 LOC)        │ Used everywhere but searchCustomers() missing    │ Fix searchCustomers() immediately; add header warning   │
  │                                           │ isStub guard                                     │ against extending                                       │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ lib/queries/sf-contracts.ts (206 LOC)     │ Still returns stripeStatus (violation); used by  │ Fix violation now; long-term replace with               │
  │                                           │ contracts page                                   │ getSubscriptionView                                     │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ lib/queries/subscriptions-dashboard.ts    │ Queries mirrors directly with partial guardrail  │ Replace with getCustomerSubscriptionViews projection    │
  │ (332 LOC)                                 │ adoption                                         │ when Customer 360 is built                              │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ lib/queries/quotes.ts (179 LOC)           │ Direct QuoteRecord queries, not guardrailed      │ Replace with getQuoteView / getQuoteViewList            │
  │                                           │                                                  │ projections                                             │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ components/workspace/ (16 files)          │ Pre-foundation component system, still used in   │ No new investment; existing pages tolerated; new pages  │
  │                                           │ every page                                       │ must use new system                                     │
  ├───────────────────────────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ app/(app)/contracts/[id]/page.tsx         │ Displays raw SfContract.stripeStatus directly    │ Stop extending; rebuild as projection-backed detail     │
  │                                           │ from getContractDetail                           │ when contracts workspace is developed                   │
  └───────────────────────────────────────────┴──────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

  Deprecated — do not extend

  ┌──────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                     Area                     │                                                   Why                                                    │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/opportunity-signals.ts (84 LOC)  │ Missing isStub filter, SF-direct queries with no projection equivalent                                   │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/data-quality.ts (159 LOC)        │ Admin/debug surface, not product code                                                                    │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/sfdc-products.ts (105 LOC)       │ Mock-only product list; superseded by real stripe_products mirror                                        │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/customer-signals.ts (100 LOC)    │ Ad hoc signal computation; superseded by AccountSignal product entity                                    │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/cs-dashboard.ts (186 LOC)        │ Partial guardrail adoption; ad hoc dashboard aggregation                                                 │
  ├──────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ app/(app)/customers/[id]/360/ — entire       │ Fully mocked, not wired to real data, uses Customer360ViewModel mock type that will conflict with real   │
  │ directory                                    │ projection types when wired                                                                              │
  └──────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Safe to delete soon

  ┌───────────────────────────────────────────┬────────────────────────────────────────────────────────────────┐
  │                   Area                    │                           Confidence                           │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ scripts/p2-data-checks.ts                 │ High — one-off audit script, results recorded                  │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ app/(app)/_templates/ (4 files)           │ High — reference templates, not routes, not linked from nav    │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ app/(app)/customers/[id]/360/mock-data.ts │ Medium — mock only; delete when 360 page is wired to real data │
  ├───────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ lib/queries/mrr-sql.ts                    │ Already deleted — ✓                                            │
  └───────────────────────────────────────────┴────────────────────────────────────────────────────────────────┘

  Unclear / needs decision

  ┌───────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
  │                               Area                                │                                  Decision required                                  │
  ├───────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ app/(app)/invoices/page.tsx, payments/page.tsx,                   │ Scaffold pages — decide: build now (wire to projections) or hide from nav and       │
  │ payment-methods/page.tsx                                          │ remove from routing                                                                 │
  ├───────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ app/(app)/products/page.tsx                                       │ Scaffold backed by mock Salesforce data — decide: invest or remove                  │
  ├───────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ app/(app)/admin/sync/                                             │ Admin utility with direct Prisma — decide: protect behind admin role gate or        │
  │                                                                   │ restrict to dev-only                                                                │
  ├───────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe-customer-detail.ts (239 LOC)                   │ Used by scaffold pages; unclear if it should become a projection or stay as a       │
  │                                                                   │ Stripe API pass-through                                                             │
  └───────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘

  ---
  3. Dangerous Legacy Paths

  🔴 High urgency

  lib/queries/customers.ts — searchCustomers() missing isStub: false
  - File: apps/console/src/lib/queries/customers.ts
  - Risk: Returns stub accounts (placeholder SF records) in customer search results, surfaced in customer list and customer lookup dialogs across quote wizard
  and subscription creation. Users see fake customers.
  - New path: Add ...SF_ACCOUNT_BASE_WHERE to the sfAccount where clause in searchCustomersUnified().
  - Urgency: HIGH — affects every customer-facing surface.

  ---
  lib/queries/sf-contracts.ts:57 — returns SfContract.stripeStatus
  - File: apps/console/src/lib/queries/sf-contracts.ts, line 57
  - Risk: stripeStatus is a stale cached copy from Salesforce sync, not live Stripe state. The contracts list and contract detail page may show incorrect
  billing status for active/canceled subscriptions.
  - New path: Remove from getContracts() output. Replace in contract detail with StripeSubscription.status via getSubscriptionView().
  - Urgency: HIGH — actively displayed in contracts page as authoritative billing status.

  ---
  Projection layer fully built, zero pages use it
  - Files: All app/(app)/ page files
  - Risk: Every product-facing page still reads data through legacy queries that lack guardrails. The architecture improvement (projections) exists but has no
  effect. New Customer 360 / renewals development will default to the old query pattern if projections aren't wired first.
  - New path: New Customer 360 page and Renewals workspace must be built on projections from day one. Existing pages should be progressively migrated, not
  extended.
  - Urgency: HIGH — this is the single greatest architectural drift risk for new feature work.

  ---
  🟡 Medium urgency

  app/accept/[token]/page.tsx — direct Prisma in public route
  - Files: app/accept/[token]/page.tsx, success/page.tsx, return/page.tsx
  - Risk: Public route directly imports prisma from @omnibridge/db. No server action wrapper, no audit logging, no consistent error handling contract. Future
  changes to quote acceptance may bypass security patterns.
  - New path: Extract to lib/actions/finalize-quote-acceptance.ts (already partially exists) or dedicated lib/queries/quote-acceptance.ts with explicit shape.
  - Urgency: MEDIUM — currently safe, but the route is public and any new logic added here without moving to actions is dangerous.

  ---
  app/(app)/cs/renewals/create/page.tsx — direct prisma.customerIndex and prisma.stripeSubscription
  - File: apps/console/src/app/(app)/cs/renewals/create/page.tsx
  - Risk: Queries CustomerIndex and StripeSubscription directly in a page component. Bypasses projection layer and any future guardrail additions.
  - New path: Extract to getRenewalView() or a dedicated server action.
  - Urgency: MEDIUM — affects internal CS workflow, not public.

  ---
  lib/queries/cs-renewals.ts — $queryRawUnsafe with no visible parameter binding verification
  - File: apps/console/src/lib/queries/cs-renewals.ts, lines using $queryRawUnsafe
  - Risk: Raw SQL queries with user-controlled values (CSM filter $3, date params $1/$2). Prisma's $queryRawUnsafe does NOT protect against injection. Requires
  manual verification that all interpolated values are properly parameterized.
  - New path: Audit all 4 $queryRawUnsafe call sites and convert to $queryRaw with tagged template literals, or rewrite using Prisma ORM queries.
  - Urgency: MEDIUM — internal-only surface, but injection surface exists.

  ---
  lib/queries/opportunity-signals.ts — missing isStub: false filter
  - File: apps/console/src/lib/queries/opportunity-signals.ts
  - Risk: Queries SfAccount without isStub: false, potentially returning stub placeholder accounts in opportunity signals computations.
  - New path: Add ...SF_ACCOUNT_BASE_WHERE to all SfAccount queries.
  - Urgency: MEDIUM — affects signal quality for opportunity workspace.

  ---
  app/(app)/customers/[id]/360/ — mock data type will conflict with projections
  - Files: customer-360.tsx, mock-data.ts
  - Risk: The Customer360ViewModel type in mock-data.ts defines daysTillExpiry: number | null as a hardcoded field on Customer360Contract. When the 360 page is
  wired to real data, there will be a type mismatch with CustomerView/RenewalView projections (which use daysToExpiry computed, not daysTillExpiry). The mock
  interface will resist the real projection shape.
  - New path: Delete mock-data.ts and Customer360ViewModel. Build directly on CustomerView + RenewalView projections from the start.
  - Urgency: MEDIUM — becomes blocking the moment Customer 360 development begins.

  ---
  🟢 Low urgency

  customers.ts manual SOQL escaping instead of escapeSoql()
  - File: apps/console/src/lib/queries/customers.ts, line 508–510
  - Risk: Manual replace(/'/g, "\\'")  instead of the shared escapeSoql() utility. Minor inconsistency but could diverge as edge cases grow.
  - New path: Import and use escapeSoql() from @omnibridge/salesforce.
  - Urgency: LOW — functionally equivalent for now.

  ---
  lib/queries/customer-signals.ts — ad hoc signal computation, no AccountSignal writes
  - File: apps/console/src/lib/queries/customer-signals.ts
  - Risk: Computes health signals (payment failures, renewal risk) at query time without persisting them to AccountSignal. Results are ephemeral, can't be
  filtered/aggregated across customers.
  - New path: Long-term, these computations should write to AccountSignal via a background job or sync event. Query reads from AccountSignal.
  - Urgency: LOW — no active product surface consuming this yet.

  ---
  4. Legacy Surface Inventory

  Routes: real product surfaces

  ┌──────────────────────────────┬────────────────────────────────┬──────────────────────────┬─────────────────────────────┐
  │            Route             │          Data source           │     Guardrail status     │           Verdict           │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /customers                   │ customers.ts                   │ Missing isStub in search │ Keep, fix search            │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /customers/[id]              │ customers.ts + tab queries     │ Partial                  │ Keep, migrate to projection │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /quotes / /quotes/all        │ quotes.ts                      │ No projection            │ Keep, queue migration       │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /quotes/[id]                 │ quotes.ts                      │ No projection            │ Keep, queue migration       │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /quotes/create/*             │ actions/quotes.ts              │ Actions correct          │ Keep as-is                  │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /subscriptions               │ subscriptions-dashboard.ts     │ Partial                  │ Keep, queue migration       │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /subscriptions/create/*      │ actions/create-subscription.ts │ Correct                  │ Keep                        │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /cs/renewals/*               │ cs-renewals.ts ($queryRaw)     │ No projection            │ Keep, quarantine query      │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /contracts / /contracts/[id] │ sf-contracts.ts                │ stripeStatus violation   │ Keep, fix violation         │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /opportunities/*             │ opportunities.ts               │ Mock/SF                  │ Keep as-is                  │
  ├──────────────────────────────┼────────────────────────────────┼──────────────────────────┼─────────────────────────────┤
  │ /coupons                     │ stripe-coupons.ts              │ Stripe API passthrough   │ Keep                        │
  └──────────────────────────────┴────────────────────────────────┴──────────────────────────┴─────────────────────────────┘

  Routes: scaffolds (no real data)

  ┌──────────────────┬────────────────┬──────────────────────────────────────────────────────┐
  │      Route       │     Status     │                    Recommendation                    │
  ├──────────────────┼────────────────┼──────────────────────────────────────────────────────┤
  │ /invoices        │ Scaffold       │ Hide from nav until built on getCustomerInvoiceViews │
  ├──────────────────┼────────────────┼──────────────────────────────────────────────────────┤
  │ /payments        │ Scaffold       │ Hide from nav until built                            │
  ├──────────────────┼────────────────┼──────────────────────────────────────────────────────┤
  │ /payment-methods │ Scaffold       │ Hide from nav until built                            │
  ├──────────────────┼────────────────┼──────────────────────────────────────────────────────┤
  │ /products        │ Scaffold       │ Hide from nav or invest now                          │
  ├──────────────────┼────────────────┼──────────────────────────────────────────────────────┤
  │ /_templates/*    │ Reference only │ Not linked from nav — acceptable                     │
  └──────────────────┴────────────────┴──────────────────────────────────────────────────────┘

  Routes: mocked — will conflict when wired

  ┌─────────────────────┬───────────────────────────────────┬─────────────────────────────────────────────┐
  │        Route        │              Status               │               Recommendation                │
  ├─────────────────────┼───────────────────────────────────┼─────────────────────────────────────────────┤
  │ /customers/[id]/360 │ Fully mocked Customer360ViewModel │ Delete mock-data.ts; rebuild on projections │
  └─────────────────────┴───────────────────────────────────┴─────────────────────────────────────────────┘

  Routes: admin / dev

  ┌─────────────┬─────────────────────────┬──────────────────────────────────────────────────────────────┐
  │    Route    │         Status          │                        Recommendation                        │
  ├─────────────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
  │ /admin/sync │ Direct Prisma, admin UI │ Protect behind role check if not already; acceptable for now │
  └─────────────┴─────────────────────────┴──────────────────────────────────────────────────────────────┘

  ---
  5. New-vs-Old Component Architecture

  The codebase has two coexisting component systems:

  System A — components/workspace/ (16 files, legacy)

  Pre-foundation system. Used by every current page via:
  import { PageHeader, FieldRow, TableShell, DetailGrid, Section, EmptyState } from "@/components/workspace"

  These components work and are not broken, but they:
  - Predate the new shell/layout/panel design
  - Are not built on the new AppShell / WorkspaceContainer model
  - Will create visual inconsistency as new omni/ components are adopted
  - Should receive zero new investment

  System B — components/shell/, layout/, panels/, states/, data/, omni/ (new)

  Built during the UI foundation pass. Correctly structured. Currently used only in:
  - app/(app)/layout.tsx (AppShell wrapping)
  - _templates/ (reference examples)
  - customers/[id]/360/customer-360.tsx (SectionPanel, StatStrip, etc.)

  Gap: New system exists but nearly all product pages still use System A workspace/ components for their inner content, not layout/ / panels/ / data/
  equivalents.

  Duplication risk

  ┌───────────────┬──────────────────────────────┬────────────────────────────────────────────┬───────────────────────────────────────────────────┐
  │    Concept    │           System A           │                  System B                  │                       Risk                        │
  ├───────────────┼──────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ Page header   │ workspace/PageHeader         │ layout/PageHeader (via WorkspaceContainer) │ New pages may accidentally import from workspace/ │
  ├───────────────┼──────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ Empty state   │ workspace/EmptyState         │ states/EmptyBlock                          │ Two components for same concept                   │
  ├───────────────┼──────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ Data tables   │ One-off <Table> compositions │ data/DataTableShell                        │ New tables may not use TanStack Table             │
  ├───────────────┼──────────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────────────────────┤
  │ Section cards │ workspace/Section            │ panels/Panel + PanelContent                │ Inconsistency growing over time                   │
  └───────────────┴──────────────────────────────┴────────────────────────────────────────────┴───────────────────────────────────────────────────┘

  Recommendation

  - workspace/ components: freeze (no new files, no new props). Document as legacy.
  - All new pages: use layout/ + panels/ + states/ + data/ + omni/ exclusively.
  - workspace/PageHeader specifically: this is the one legacy component most reused. When rebuilding Customer 360 and Renewals workspace, use
  layout/WorkspaceHeader instead.

  ---
  6. Query/Data Access Architecture

  Full classification

  ┌────────────────────────────────────────┬───────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
  │                  File                  │          Classification           │                                 Reason                                 │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/projections/customer-view.ts       │ Approved                          │ Correct, guardrails enforced                                           │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/projections/subscription-view.ts   │ Approved                          │ Correct                                                                │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/projections/invoice-view.ts        │ Approved                          │ Correct, FK now wired                                                  │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/projections/quote-view.ts          │ Approved                          │ Correct                                                                │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/projections/renewal-view.ts        │ Approved                          │ Correct, Renewal entity now wired                                      │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/repo/ all files                    │ Approved                          │ Guardrail helpers, use everywhere                                      │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/quotes.ts                  │ Tolerable legacy                  │ Direct Prisma, projection exists — migrate on next quote page refactor │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/customers.ts               │ Tolerable legacy + 1 fix required │ searchCustomers() missing isStub filter — fix is one line              │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/sf-contracts.ts            │ Tolerable legacy + 1 fix required │ stripeStatus violation — fix is one line                               │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/cs-renewals.ts             │ Tolerable legacy                  │ Core logic, migrate to projection when renewals workspace rebuilt      │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/subscriptions-dashboard.ts │ Tolerable legacy                  │ No active violation, used for dashboard aggregation                    │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/cs-dashboard.ts            │ Tolerable legacy                  │ Dashboard aggregation, no product entity                               │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/contacts.ts                │ Tolerable legacy                  │ SF passthrough, no projection needed                                   │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/salesforce.ts              │ Tolerable legacy                  │ SF SOQL executor wrapper                                               │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe.ts                  │ Tolerable legacy                  │ Stripe API passthrough                                                 │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe-customer-detail.ts  │ Tolerable legacy                  │ Used by scaffold pages only                                            │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe-products.ts         │ Tolerable legacy                  │ Stripe API passthrough                                                 │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe-coupons.ts          │ Tolerable legacy                  │ Stripe API passthrough                                                 │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/stripe-prices.ts           │ Tolerable legacy                  │ Stripe API passthrough                                                 │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/opportunities.ts           │ Tolerable legacy                  │ SF passthrough, mostly mock                                            │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/opportunity-signals.ts     │ Dangerous legacy                  │ Missing isStub, no projection, no product owner                        │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/customer-signals.ts        │ Dangerous legacy                  │ Ad hoc signal computation, superseded by AccountSignal entity          │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/data-quality.ts            │ Dangerous legacy                  │ Admin/QA only — must not be imported in product UI                     │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/sfdc-products.ts           │ Deprecated                        │ Mock-only, superseded by real product mirror                           │
  ├────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ lib/queries/product-logs.ts            │ Tolerable legacy                  │ Webhook dedup infrastructure                                           │
  └────────────────────────────────────────┴───────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘

  Patterns that must not appear in new product work

  1. prisma.sfAccount.findMany({}) without where: { isStub: false } — any query
  2. prisma.sfContract.findMany({select: { stripeStatus: true }}) — reading billing status from mirror
  3. import { prisma } from "@omnibridge/db" in app/(app)/* page files — direct mirror access in pages
  4. Custom MRR computation in page files — use computeMrrCents() from lib/repo/
  5. $queryRawUnsafe with string interpolation — use tagged $queryRaw or Prisma ORM

  ---
  7. Quarantine Recommendations

  Immediate file-level quarantine headers

  Add these headers to files that must not be extended:

  lib/queries/cs-renewals.ts — top of file:
  // QUARANTINE: Legacy query file. Do not extend.
  // New renewal data reads must use getRenewalView() / getRenewalViewsForWindow()
  // from lib/projections/renewal-view.ts.
  // This file remains for the CS renewals dashboard surface until it is rebuilt
  // on the projection layer.

  lib/queries/customer-signals.ts — top of file:
  // DEPRECATED: Ad hoc signal computation. Do not add new signal types here.
  // New signals must be written to AccountSignal via sync events and read from
  // lib/projections/customer-view.ts (AccountSignal relation pending).

  components/workspace/ — add index.ts comment:
  // LEGACY COMPONENT SYSTEM: Do not add new components here.
  // New pages must use components/layout/, components/panels/, components/states/,
  // components/data/, and components/omni/ instead.

  app/(app)/customers/[id]/360/mock-data.ts — top of file:
  // DELETE BEFORE WIRING: This file must be deleted before the Customer 360 page
  // is connected to real data. Customer360ViewModel is incompatible with CustomerView
  // projection types. Build on lib/projections/customer-view.ts instead.

  Route quarantine

  The scaffold routes (/invoices, /payments, /payment-methods, /products) should be removed from the sidebar navigation until they are properly built. They
  currently show empty or placeholder states that erode trust and may attract dev shortcuts.

  $queryRawUnsafe quarantine

  cs-renewals.ts uses $queryRawUnsafe in 4 places. Each call site should have an inline comment confirming parameterization was audited, or be converted to
  $queryRaw tagged template literals which Prisma protects natively.

  ---
  8. Deletion Candidates

  ┌────────────────────────────────────────────────────────────────────────┬──────────────┬─────────────────────────────────────────────────────────────────┐
  │                                  Item                                  │  Confidence  │                              Notes                              │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ scripts/p2-data-checks.ts                                              │ High         │ One-off audit script, results recorded in                       │
  │                                                                        │              │ schema-cleanup-candidates.md                                    │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ app/(app)/_templates/ (4 files)                                        │ High         │ Reference templates, not routed, no nav links                   │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ lib/queries/sfdc-products.ts                                           │ High         │ Mock-only, no real callers in product UI                        │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ app/(app)/customers/[id]/360/mock-data.ts                              │ Probably     │ Safe once 360 page is rebuilt on real projections               │
  │                                                                        │ safe         │                                                                 │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ lib/queries/data-quality.ts                                            │ Probably     │ Admin/QA only — move to scripts/ if needed                      │
  │                                                                        │ safe         │                                                                 │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ lib/queries/customer-signals.ts                                        │ Not safe yet │ Referenced by customer detail tab — tab must be rebuilt on      │
  │                                                                        │              │ AccountSignal first                                             │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ lib/queries/cs-dashboard.ts                                            │ Not safe yet │ May be referenced in CS surface                                 │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ app/(app)/customers/[id]/360/ (entire dir)                             │ Not safe yet │ Must be rebuilt before deletion                                 │
  ├────────────────────────────────────────────────────────────────────────┼──────────────┼─────────────────────────────────────────────────────────────────┤
  │ scripts/debug-context.sh, test-target.sh, repo-status.sh,              │ Probably     │ Dev utility scripts — confirm not in CI                         │
  │ changed-files-summary.sh                                               │ safe         │                                                                 │
  └────────────────────────────────────────────────────────────────────────┴──────────────┴─────────────────────────────────────────────────────────────────┘

  ---
  9. Immediate Follow-Up Plan

  Do now (before any new feature development)

  1. Fix customers.ts isStub gap — one line: add ...SF_ACCOUNT_BASE_WHERE to searchCustomersUnified() SfAccount query. This affects every customer search in the
   app.
  2. Fix sf-contracts.ts stripeStatus violation — remove stripeStatus: c.stripeStatus from getContracts() output and getContractDetail() spread. Replace display
   in contracts/[id]/page.tsx with stripeSubscription.status from the already-fetched stripeSubscription join that exists on line 103 of the same file.
  3. Add quarantine headers to cs-renewals.ts, customer-signals.ts, components/workspace/index.ts, and customers/[id]/360/mock-data.ts.
  4. Remove scaffold pages from nav — /invoices, /payments, /payment-methods, /products until built.

  Freeze

  - lib/queries/ files: freeze surface area. No new query files. No new functions in existing query files that bypass projections. Existing functions are
  tolerated but not extended.
  - components/workspace/: no new components, no new props on existing ones.
  - app/(app)/customers/[id]/360/mock-data.ts: no new mock fields added. It gets deleted when real implementation starts.

  Quarantine (add headers, document)

  - lib/queries/cs-renewals.ts — LEGACY header
  - lib/queries/customer-signals.ts — DEPRECATED header
  - lib/queries/cs-dashboard.ts — LEGACY header
  - components/workspace/ — LEGACY header in index.ts
  - app/(app)/customers/[id]/360/mock-data.ts — DELETE BEFORE WIRING header

  Delete later (after verifying callers)

  - scripts/p2-data-checks.ts
  - app/(app)/_templates/ 4 files
  - lib/queries/sfdc-products.ts

  Protect as golden path

  - lib/projections/ — all files
  - lib/repo/ — all files
  - components/shell/, layout/, panels/, states/, data/, omni/
  - lib/actions/ — all action files (correct pattern)
  - packages/integrations/stripe, salesforce, docusign

  ---
  10. Final Verdict

  Is the repo safe to continue product work?

  Yes, with two required pre-flight fixes and one architectural commitment.

  The schema, projection layer, and component foundation are correct and complete. The dangerous old paths are all known and contained — none are in the
  critical quote/subscription/acceptance workflow. The codebase is not in a state where new feature work would cause irreversible contamination.

  Required pre-flight fixes (take 30 minutes):
  1. customers.ts isStub gap — one line fix
  2. sf-contracts.ts stripeStatus violation — two line fix

  Architectural commitment required:
  The projection layer must be treated as the entry point for all new product data access from this point forward. Customer 360 and Renewals workspace must be
  built on getCustomerView() and getRenewalView() respectively — not on customers.ts or cs-renewals.ts. If this commitment is not made explicit before
  development starts, the old query files will be the path of least resistance and the projection layer will remain permanently unused.

  Single highest-risk area

  The projection layer is 100% built and 0% wired. Every product page still reads from legacy query files. If the next feature (Customer 360, Renewals
  workspace) defaults to importing from lib/queries/ because that's what all existing pages do, the new architecture provides zero benefit and the old patterns
  get further entrenched. This is not a code quality problem — it is an adoption forcing function problem. The most important containment action is making
  projections the obvious default, not the theoretical ideal.