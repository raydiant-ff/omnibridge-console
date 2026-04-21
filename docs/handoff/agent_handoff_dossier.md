# OmniBridge-v2 — Complete Agent Handoff Dossier

## 0. Repo Scan Plan

**Directories/files inspected first:**
- `package.json`, `pnpm-workspace.yaml`, `turbo.json` — monorepo structure
- `AGENTS.md` — operating guide
- `packages/db/prisma/schema.prisma` — data model
- `apps/console/package.json`, `next.config.ts` — app config
- `apps/console/src/middleware.ts` — auth matcher
- `apps/console/src/app/api/**` — API routes
- `packages/auth`, `packages/integrations/*` — integrations

**Keywords/patterns searched:**
- `process.env`, `NEXT_PUBLIC` — env vars
- `TODO`, `FIXME`, `HACK`, `XXX`, `@ts-ignore` — debt (none found)
- `"use server"` — server actions
- `mock`, `Mock`, `MOCK` — mock paths
- `webhook`, `stripe`, `auth`, `subscription`, `quote`, `checkout`
- `pandadoc`, `escapeSoql`

**Most business-critical areas:**
- Quote creation and acceptance flow
- Stripe webhook handlers
- Co-term quote flow
- Embedded checkout
- Salesforce sync (sf-quote-mirror, sf-contract-from-quote)
- DocuSign signing

**Deprioritized:**
- `.ai/` agent definitions (agent-specific)
- `sf-metadata/` (Salesforce metadata, large)
- Individual component styling details

---

## 1. Executive Summary

**What this is:** Omni (OmniBridge) is an internal B2B SaaS console for Displai. It bridges Stripe (billing), Salesforce (CRM), and DocuSign (e-signature) to support quote-to-cash, subscription lifecycle, and customer success workflows.

**Stage:** Production-hardening. Core quoting, checkout, and co-term flows are implemented. Several CSM pages (amendments, downgrades, cancellations) are "Coming Soon" placeholders. No automated tests exist.

**Main workflows:**
1. **Quote creation** — New, Expansion, Renewal, Amendment quote types; optional co-term for Expansion
2. **Quote acceptance** — Public `/accept/[token]` page with DocuSign signing and embedded Stripe Checkout for Pay Now
3. **Subscription management** — Dashboard from local mirror, create subscription wizard
4. **Customer 360** — Search, Stripe + Salesforce tabs, audit log
5. **Opportunities** — SFDC sync, create/assign

**Most complete:** Quote creation wizards, embedded checkout, co-term flow, Stripe webhook handlers, local subscription mirror

**Least complete:** CSM pages (amendments, downgrades, cancellations), renewals create flow, tests

**Next agent must understand first:**
- Billing domain: Stripe is source of truth; idempotency is critical
- Webhook flow: IdempotencyKey deduplication, subscription mirror sync
- Quote acceptance: two paths (charge_automatically → embedded checkout, send_invoice → direct accept)
- Co-term: contract term + billing frequency filter subscriptions before selection

---

## 2. Project Identity

| Attribute | Value |
|-----------|-------|
| **Project name** | Omni / OmniBridge |
| **Repo name** | OmniBridge-v2 |
| **Package names** | `@omnibridge/console`, `@omnibridge/db`, `@omnibridge/auth`, `@omnibridge/ui`, `@omnibridge/stripe`, `@omnibridge/salesforce`, `@omnibridge/docusign` |
| **Structure** | Monorepo (pnpm workspaces + Turborepo) |
| **Branding** | Displai (logo, product language in docs) |

**Major domains:**
- Customer Search & 360
- Opportunities (SFDC)
- Quotes (create, accept, co-term)
- Products & Coupons
- Subscriptions (dashboard, create, cross-sell)
- Customer Success (dashboard, renewals, amendments, downgrades, cancellations)

**User personas:** Internal sales, CSM, finance, support. Roles: admin, sales, csm, finance, support.

**Business purpose:** Replace clunky Salesforce workflows with a fast internal console; keep Salesforce and Stripe as systems of record; add audit logs and guardrails.

**Ecosystem:** Part of Displai platform. SF metadata in `sf-metadata/` for Salesforce custom objects (Stripe_Quote__c, etc.).

---

## 3. Tech Stack Inventory

| Item | Version | Where | Purpose |
|------|---------|-------|---------|
| **Next.js** | 15 | apps/console | App framework |
| **React** | 19 | apps/console | UI |
| **TypeScript** | 5 | root | Typing |
| **Tailwind CSS** | 4 | apps/console | Styling |
| **Radix UI** | 1.4 | apps/console | Components |
| **Prisma** | 6 | packages/db | ORM |
| **PostgreSQL** | — | Supabase | Database |
| **NextAuth** | 4 | packages/auth | Auth (credentials, JWT) |
| **Stripe** | SDK 2025-02-24.acacia | packages/integrations/stripe | Billing |
| **DocuSign** | REST API | packages/integrations/docusign | E-signature |
| **Salesforce** | JWT OAuth, SOQL | packages/integrations/salesforce | CRM |
| **pnpm** | 9.15.4 | root | Package manager |
| **Turborepo** | 2 | root | Build orchestration |
| **recharts** | 3.7 | apps/console | Charts |
| **pdf-lib** | 1.17 | apps/console | PDF generation |
| **bcryptjs** | 3 | apps/console | Password hashing |

**Auth:** Credentials provider (email/password), no Google SSO despite PRODUCT.md mention. JWT session strategy.

**Billing:** Stripe Quotes API, Checkout Sessions (embedded), Subscriptions, Invoices. Webhooks for product events, checkout.session.completed, invoice.paid, subscription created/updated/deleted.

**Queue/background:** None. All work is synchronous (server actions, API routes, webhooks).

**Caching:** None explicit. Prisma client singleton in dev.

**Infra:** No Vercel/Docker config found. Likely Vercel or similar for Next.js deployment.

**Observability:** `console.error` in webhooks; no Sentry/DataDog.

**Testing:** None. No test framework or test files.

**Mocks:** `USE_MOCK_STRIPE`, `USE_MOCK_SALESFORCE`, `USE_MOCK_DOCUSIGN` env flags. When set, server actions and queries return mock data instead of calling Stripe/SF/DocuSign.

---

## 4. Repository Topography

```
OmniBridge-v2/
├── apps/
│   └── console/                 # Next.js app
│       ├── src/
│       │   ├── app/(app)/        # Protected routes
│       │   │   ├── customers/    # Customer search, [id] 360
│       │   │   ├── opportunities/
│       │   │   ├── quotes/       # List, [id], create, co-term
│       │   │   ├── products/
│       │   │   ├── coupons/
│       │   │   ├── subscriptions/
│       │   │   └── cs/           # Customer Success
│       │   ├── accept/[token]/   # Public quote acceptance
│       │   ├── api/              # API routes
│       │   ├── login/, auth/
│       │   └── layout.tsx
│       │   ├── components/      # UI, sidebar
│       │   ├── lib/
│       │   │   ├── actions/      # Server actions
│       │   │   ├── queries/      # Data fetching
│       │   │   ├── feature-flags.ts
│       │   │   └── billing-utils.ts
│       │   └── middleware.ts
│       └── next.config.ts
├── packages/
│   ├── db/                       # Prisma schema, migrations, seed
│   ├── auth/                     # NextAuth config
│   ├── ui/                       # cn() utility
│   ├── eslint-config/
│   ├── typescript-config/
│   └── integrations/
│       ├── stripe/
│       ├── salesforce/
│       └── docusign/
├── scripts/                      # Backfill, audit, CSM tools
├── sf-metadata/                  # Salesforce metadata
├── docs/stripe/                  # Stripe API docs (reference)
├── .ai/                          # Repo-local AI rules, agents, handoffs
└── AGENTS.md
```

**Critical entry points:**
- `apps/console/src/app/(app)/layout.tsx` — App shell with sidebar
- `apps/console/src/app/page.tsx` — Home (likely redirect or dashboard)
- `apps/console/src/app/login/page.tsx` — Login
- `apps/console/src/app/accept/[token]/page.tsx` — Quote acceptance (public)

**API routes:**
- `POST /api/auth/[...nextauth]` — NextAuth
- `POST /api/stripe/webhook` — Stripe webhooks
- `POST /api/docusign/webhook` — DocuSign webhooks
- `POST /api/checkout/embedded` — Create embedded Checkout Session
- `GET /api/checkout/session-status` — Session status after payment
- `GET /api/subscriptions-dashboard` — Dashboard data from local mirror

**Data access:** Server actions in `lib/actions/`, queries in `lib/queries/`. Prisma via `@omnibridge/db`.

---

## 5. Runbook: How This Project Actually Runs

**Install:**
```bash
pnpm install
```

**Dev:**
```bash
pnpm dev
```
Turbo runs `next dev --port 3000` for console. Single dev server.

**Build:**
```bash
pnpm build
```
Runs `prisma generate` then `next build` for console.

**Lint:**
```bash
pnpm lint
```

**DB:**
```bash
pnpm db:generate   # Regenerate Prisma client
pnpm db:push       # Push schema (no migration)
pnpm db:migrate    # Run migrations (prisma migrate dev)
pnpm db:migrate:deploy  # Production migrations
pnpm db:seed       # Seed admin + demo customer
pnpm db:studio     # Prisma Studio
```

**Local env:** `apps/console/.env.local` (gitignored). Scripts load from there via `export $(grep -v '^#' apps/console/.env.local | xargs)` or similar.

**Backfill subscriptions (one-time):**
```bash
npx tsx scripts/backfill-subscriptions.ts
```
Load env first; run after mirror tables exist.

**Docker/devcontainer:** None found.

**Gotchas:**
- No test runner; validation relies on `pnpm lint` and `pnpm build`
- One-off scripts use `npx tsx` and expect env from `.env.local`
- Stripe webhook needs ngrok or similar for local testing

---

## 6. Environment Variables and Secrets Map

| Variable | Purpose | Where |
|----------|---------|-------|
| `DATABASE_URL` | Postgres connection | Prisma, turbo globalEnv |
| `DIRECT_URL` | Prisma direct connection | Prisma |
| `NEXTAUTH_URL` | Auth callback base | NextAuth |
| `NEXTAUTH_SECRET` | JWT signing | NextAuth |
| `ADMIN_EMAIL` | Seed admin user | seed.ts |
| `ADMIN_PASSWORD` | Seed admin password | seed.ts |
| `ADMIN_NAME` | Seed admin name | seed.ts |
| `STRIPE_SECRET_KEY` | Stripe API | stripe package, webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | stripe package |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe | accept-client |
| `USE_MOCK_STRIPE` | Mock Stripe | feature-flags |
| `SF_CLIENT_ID` | Salesforce JWT | salesforce package |
| `SF_USERNAME` | Salesforce JWT | salesforce package |
| `SF_LOGIN_URL` | Salesforce auth URL | salesforce package |
| `SF_PRIVATE_KEY_BASE64` | Salesforce JWT key | salesforce package |
| `USE_MOCK_SALESFORCE` | Mock Salesforce | feature-flags |
| `DOCUSIGN_INTEGRATION_KEY` | DocuSign | docusign package |
| `DOCUSIGN_USER_ID` | DocuSign | docusign package |
| `DOCUSIGN_ACCOUNT_ID` | DocuSign | docusign package |
| `DOCUSIGN_AUTH_SERVER` | DocuSign | docusign package |
| `DOCUSIGN_APP_URL` | DocuSign | docusign package |
| `DOCUSIGN_RSA_PRIVATE_KEY` | DocuSign | docusign package |
| `DOCUSIGN_HMAC_SECRET` | DocuSign webhook | docusign webhook route |
| `USE_MOCK_DOCUSIGN` | Mock DocuSign | feature-flags |
| `NEXT_PUBLIC_BASE_URL` | Public URL for redirects | checkout, redirects |
| `NEXT_PUBLIC_SF_ORG_URL` | Salesforce org URL | customer links |
| `SLACK_PRODUCT_WEBHOOK_URL` | Product alerts | product-log |

**No `.env.example`** in repo. Env vars must be inferred from code.

**Server-only:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SF_*, DOCUSIGN_*, NEXTAUTH_SECRET, ADMIN_*

**Client-exposed:** NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_SF_ORG_URL

---

## 7. Architecture and Data Flow

**Request lifecycle:**
```
Browser → Next.js middleware (auth check) → Page/API
         ↓
         Excluded: /login, /accept/*, /api/auth, /api/stripe/webhook, /api/docusign/webhook, /api/checkout
```

**Auth flow:**
```
Credentials (email/password) → NextAuth authorize → Prisma User lookup → JWT session
```

**Quote creation flow:**
```
Operator → PickCustomer → ConfigureQuote/ConfigureCoTerm → ReviewQuote/ReviewCoTerm → createQuote/createCoTermQuote
         → Stripe API (quotes.create) → QuoteRecord in DB → SF sync (Quote__c) → DocuSign envelope (if enabled)
         → DocumentPreview → Send to customer
```

**Quote acceptance flow (Pay Now):**
```
Customer → /accept/[token] → AcceptQuoteClient → Terms + scroll → Accept & Pay
         → POST /api/checkout/embedded → Stripe Checkout Session (ui_mode: embedded)
         → EmbeddedCheckout iframe → Payment → onComplete
         → GET /api/checkout/session-status → Update QuoteRecord → SF sync
         → Success state inline
```

**Quote acceptance flow (Send Invoice):**
```
Customer → /accept/[token] → AcceptQuoteClient → Terms → Accept Quote
         → acceptQuote() server action → QuoteRecord → SF sync
         → No payment collection
```

**Webhook flow:**
```
Stripe → POST /api/stripe/webhook → verify signature → IdempotencyKey create (dedupe)
       → Switch on event.type → handleProductEvent, handleCheckoutCompleted, handleInvoicePaid, handleSubscriptionSync
       → Prisma writes, ProductLog, AuditLog
```

**Subscription mirror:**
```
Stripe → customer.subscription.created/updated/deleted → handleSubscriptionSync
       → Prisma StripeSubscription + StripeSubscriptionItem upsert
       → Dashboard queries use local mirror (no Stripe API)
```

---

## 8. Domain Model / Data Model

**Prisma models (summary):**

| Model | Purpose |
|-------|---------|
| User | NextAuth user, role, passwordHash |
| Account, Session, VerificationToken | NextAuth |
| CustomerIndex | Links SF Account ↔ Stripe Customer |
| WorkItem | Workflow items (type, status, payload) |
| AuditLog | Immutable event log |
| ProductLog | Product change log |
| IdempotencyKey | Webhook/request deduplication |
| QuoteRecord | Quote metadata, Stripe quote ID, SF sync, DocuSign envelope |
| StripeSubscription | Local mirror of Stripe subscriptions |
| StripeSubscriptionItem | Mirror of subscription items |

**QuoteRecord** is central: stores stripeQuoteId, customerId, status, acceptToken, collectionMethod, lineItemsJson, docusignEnvelopeId, sfQuoteId, parentSubscriptionId (co-term), etc.

**Source-of-truth:** Stripe for billing; Salesforce for accounts/opportunities; local DB for QuoteRecord, CustomerIndex, AuditLog, mirror tables.

**Duplicate concepts:** `pandadocDocId` in schema (PandaDoc removed; DocuSign used). SF metadata still references PandaDoc fields.

---

## 9. API Surface Audit

**Internal API routes:**

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| /api/auth/[...nextauth] | GET, POST | — | NextAuth |
| /api/stripe/webhook | POST | Signature | Stripe events |
| /api/docusign/webhook | POST | HMAC | DocuSign events |
| /api/checkout/embedded | POST | None (token) | Create embedded Checkout Session |
| /api/checkout/session-status | GET | None (session_id) | Session status, DB update |
| /api/subscriptions-dashboard | GET | Session | Dashboard data |

**Server actions:** All in `lib/actions/`. Require session except where used from public accept page (acceptQuote is called from client).

**External APIs called:**
- Stripe API (quotes, checkout, subscriptions, products, invoices)
- Salesforce API (SOQL, CRUD)
- DocuSign API (envelopes, signing URLs)

**Webhooks received:** Stripe, DocuSign

**Fragile:** Checkout embedded uses `(stripeQuote as any)`; session-status updates DB on completion. No retry logic for SF sync failures.

---

## 10. UI / Product Surface Audit

**Major pages:**

| Route | Purpose | Completion |
|-------|---------|------------|
| / | Home | — |
| /login | Login | Complete |
| /customers | Customer search | Complete |
| /customers/[id] | Customer 360 | Complete |
| /opportunities | Opportunities dashboard | Complete |
| /opportunities/create | Create opportunity | Complete |
| /quotes | My quotes | Complete |
| /quotes/create | New quote wizard | Complete |
| /quotes/create/expansion | Expansion (New Contract or Co-term) | Complete |
| /quotes/create/renewal | Renewal quote | Complete |
| /quotes/create/amendment | Amendment quote | Complete |
| /quotes/co-term | Co-term wizard (standalone) | Complete |
| /quotes/[id] | Quote detail | Complete |
| /products | Products | Complete |
| /coupons | Coupons | Complete |
| /subscriptions | Dashboard | Complete |
| /subscriptions/create | Create subscription | Complete |
| /subscriptions/cross-sell | Redirects to /quotes/co-term | Complete |
| /subscriptions/cancellation | Coming Soon | Placeholder |
| /subscriptions/downgrade | Coming Soon | Placeholder |
| /subscriptions/upsell | Coming Soon | Placeholder |
| /subscriptions/renewal | Coming Soon | Placeholder |
| /cs | CS Dashboard | Complete |
| /cs/renewals | Renewals dashboard | Complete |
| /cs/renewals/create | Create renewal | Complete |
| /cs/amendments | **404** | Sidebar links, no page |
| /cs/downgrades | **404** | Sidebar links, no page |
| /cs/cancellations | **404** | Sidebar links, no page |
| /accept/[token] | Quote acceptance | Complete |

**Navigation bug:** Sidebar links to /cs/amendments, /cs/downgrades, /cs/cancellations but those routes do not exist. Cancellation, downgrade, upsell pages exist under /subscriptions/ (different paths).

---

## 11. Business Workflow Reconstruction

**Quote creation:**
1. Operator selects customer, opportunity, bill-to contact
2. For Expansion: chooses New Contract or Co-term
3. For Co-term: selects contract term, billing frequency, subscription (filtered), timing, line items
4. For New Contract: selects terms, payment path, line items
5. Review → Create Quote (Stripe API) → QuoteRecord → SF sync → DocuSign if enabled
6. Send to customer

**Quote acceptance:**
1. Customer opens /accept/[token]
2. Reviews line items, terms; scrolls to bottom; checks "I agree"
3. If DocuSign: signs document; then payment flow
4. If Pay Now: embedded Stripe Checkout → payment → success
5. If Send Invoice: direct accept, no payment

**Co-term:**
1. Select subscription matching term + billing frequency
2. Add new line items
3. Choose timing (immediate, next invoice, end of cycle)
4. createCoTermQuote → Stripe quote with parent subscription

**Subscription mirror:**
1. Webhook: subscription created/updated/deleted → upsert to StripeSubscription + StripeSubscriptionItem
2. Backfill script for initial sync
3. Dashboard reads from local mirror

---

## 12. Current State of Implementation

**Working confidently:**
- Quote creation (all types)
- Co-term with subscription filtering
- Embedded checkout
- Stripe webhooks (product, checkout, invoice, subscription)
- DocuSign signing
- Customer search, 360
- Opportunities
- Subscriptions dashboard
- Products, coupons

**Likely works but needs verification:**
- SF sync on quote acceptance
- Co-term proration
- Invoice creation for send_invoice

**Stubbed/mocked:**
- USE_MOCK_STRIPE, USE_MOCK_SALESFORCE, USE_MOCK_DOCUSIGN

**Broken or high risk:**
- /cs/amendments, /cs/downgrades, /cs/cancellations — 404 (sidebar links)

**Half-built:**
- Renewals create flow
- CSM pages (amendments, downgrades, cancellations) — placeholders under subscriptions, not under cs

**Recently changed:**
- Embedded checkout (replaced redirect)
- Co-term subscription filtering
- Configure step consolidation

---

## 13. Open TODOs, FIXMEs, and Implicit Debt

**Explicit:** No TODO, FIXME, HACK, XXX found in codebase.

**Implicit:**
- No tests
- No .env.example
- PandaDoc schema fields unused (DocuSign used)
- Sidebar links to non-existent /cs routes
- escapeSoql over-escaping for Stripe_Customer_ID__c (fixed in customers.ts with manual escape)
- Many `any` casts in Stripe/DocuSign handlers (ESLint warnings)

---

## 14. Risk Register

| Risk | Severity | Evidence | Mitigation |
|------|----------|----------|------------|
| Webhook replay | High | IdempotencyKey used | Keep; verify on changes |
| Billing double-charge | High | Checkout flow | Ensure idempotency in session-status |
| SF sync failure | Medium | No retry in session-status | Add retry or queue |
| SOQL injection | Medium | escapeSoql used | Verify all user input |
| Auth bypass | Medium | Unauthenticated /api/checkout | Token/session_id validated |
| Missing env in prod | High | No env.example | Document required vars |
| No tests | Medium | No test runner | Add smoke tests |
| 404 on CS routes | Low | Sidebar links | Create pages or fix links |

---

## 15. Testing and Quality Posture

**Tests:** None. No test framework.

**Lint:** ESLint v8, `pnpm lint` runs Next lint + eslint.

**Typecheck:** Via `pnpm build` (Next.js).

**Minimum smoke-test checklist:**
1. `pnpm install && pnpm build`
2. `pnpm db:generate` (if schema changed)
3. Login at /login
4. Create quote (New) → dry run
5. Visit /accept/[token] for a valid quote
6. Check Stripe webhook returns 200 (with signature)

---

## 16. Documentation Audit

| Doc | Accuracy |
|-----|----------|
| AGENTS.md | Accurate, primary |
| PRODUCT.md | Partially stale (Google SSO, workflows) |
| REPO_PLAN.md | Stale (initial plan) |
| docs/stripe/* | Reference docs, not implementation |
| .ai/rules/* | Accurate, always apply |

**Missing:** .env.example, deployment runbook, webhook setup guide.

---

## 17. File-by-File Priority Reading List

**Tier 1 (must read first):**
- `AGENTS.md` — operating rules
- `packages/db/prisma/schema.prisma` — data model
- `apps/console/src/middleware.ts` — auth matcher
- `apps/console/src/lib/feature-flags.ts` — mock flags
- `apps/console/src/lib/actions/quotes.ts` — quote creation

**Tier 2 (read next):**
- `apps/console/src/app/api/stripe/webhook/route.ts` — webhook handlers
- `apps/console/src/app/accept/[token]/accept-client.tsx` — acceptance flow
- `apps/console/src/app/api/checkout/embedded/route.ts` — embedded checkout
- `packages/integrations/stripe/src/index.ts` — Stripe client
- `packages/integrations/salesforce/src/index.ts` — SF client, escapeSoql

**Tier 3 (if working in those areas):**
- `apps/console/src/lib/actions/co-term-quote.ts` — co-term
- `apps/console/src/lib/actions/sf-quote-mirror.ts` — SF sync
- `apps/console/src/lib/queries/subscriptions-dashboard.ts` — mirror queries
- `apps/console/src/lib/actions/docusign-session.ts` — DocuSign

---

## 18. Recommended Continuation Plan

1. **Verify first:** Run `pnpm build`, `pnpm lint`. Confirm no regressions.
2. **Run:** `pnpm dev`, login, create a quote (dry run), visit accept page.
3. **Fix navigation:** Create /cs/amendments, /cs/downgrades, /cs/cancellations pages (or redirect to subscriptions equivalents) so sidebar links work.
4. **Document:** Add .env.example with all required vars.
5. **Do not change casually:** Webhook handlers, idempotency logic, billing flows, quote acceptance.
6. **Refactors to wait:** Broad architectural changes until tests exist.

---

## 19. Questions the Next Agent Should Ask Immediately

1. What is the production deployment URL and environment?
2. Is there a separate Stripe webhook for production vs staging?
3. Are USE_MOCK_* flags ever used in production?
4. What is the intended behavior for /cs/amendments, /cs/downgrades, /cs/cancellations — create pages or redirect?
5. Is there a runbook for webhook failures or SF sync failures?
6. Who owns the Stripe and Salesforce Connected App credentials?

---

## 20. Anthropic Agent Boot Prompt

```
You are taking over the OmniBridge-v2 (Omni) codebase. Omni is an internal B2B SaaS console for Displai that bridges Stripe (billing), Salesforce (CRM), and DocuSign (e-signature).

Key facts:
- Monorepo: pnpm + Turborepo, Next.js 15 / React 19
- No test framework; validate with pnpm lint and pnpm build
- Stripe is billing source of truth; preserve idempotency in webhooks and checkout
- Use escapeSoql() for user input in SOQL
- AuditLog.actorUserId is nullable for webhook/system logs

Before making changes:
1. Read AGENTS.md and docs/handoff/agent_handoff_dossier.md
2. Inspect relevant files and summarize current behavior
3. Propose the smallest safe implementation path
4. Do not change webhook handlers, idempotency logic, or billing flows without explicit plan

First work session:
1. Run pnpm install && pnpm build
2. Run pnpm dev and manually test login, quote creation (dry run), accept page
3. Fix sidebar links to /cs/amendments, /cs/downgrades, /cs/cancellations (currently 404)
4. Document env vars in .env.example

When uncertain, state clearly what you inferred vs verified. Do not assume documentation is accurate without checking code.
```

---

## 21. Project Facts Ledger

| Fact | Confidence | Evidence |
|------|------------|----------|
| pnpm 9.15.4 is package manager | High | package.json packageManager |
| Stripe API version 2025-02-24.acacia | High | packages/integrations/stripe |
| NextAuth uses credentials + JWT | High | packages/auth |
| No test framework | High | AGENTS.md, no test files |
| IdempotencyKey used for Stripe webhooks | High | webhook route |
| Embedded checkout for Pay Now | High | accept-client, checkout/embedded |
| DocuSign used for e-signature (not PandaDoc) | High | docusign package, schema has both |
| Local mirror for subscriptions | High | StripeSubscription model, webhook handlers |
| /cs/amendments etc 404 | High | No page files under cs/ |

---

## 22. Unsafe Assumptions Ledger

**Do not assume without verification:**
- PRODUCT.md is correct (mentions Google SSO; auth uses credentials)
- REPO_PLAN.md reflects current state
- All env vars are documented
- Webhook secret is the same for all environments
- SF sync always succeeds on quote acceptance
- Mock flags are never used in production
- escapeSoql is correct for all SOQL contexts (Stripe_Customer_ID__c had issues)
- Sidebar links match existing routes

---

## 23. Engineering Working Memory

**Naming:** `QuoteRecord` (DB), `stripeQuoteId` (Stripe), `sfQuoteId` (Salesforce). `CustomerIndex` links SF + Stripe.

**Patterns:** Server actions for mutations; queries for reads. `"use server"` on action files. No React Query or SWR; fetch in client components.

**Inconsistent:** Co-term accessible via Expansion (contract mode) and via /quotes/co-term. Cross-sell redirects to co-term. Amendments/downgrades/cancellations under subscriptions vs cs sidebar.

**Fragile:** Stripe webhook handlers use `as any` casts. DocuSign HMAC in production only. No retry for SF sync.

**Vocabulary:** co-term, charge_automatically, send_invoice, dry run, QuoteRecord, CustomerIndex, IdempotencyKey.

---

## 24. Copy-Paste Brief for the Next Agent

**What this is:** Omni (OmniBridge-v2) — internal B2B console for Displai. Stripe + Salesforce + DocuSign. Quote-to-cash, subscription lifecycle, customer 360.

**Current state:** Production-hardening. Core quoting, embedded checkout, co-term work. No tests. Several CSM pages placeholder or 404.

**Key systems:** Stripe (billing), Salesforce (CRM), DocuSign (e-sign), local Postgres (Prisma), subscription mirror.

**Biggest risks:** Webhook replay, billing double-charge, SF sync failure, no tests.

**First 5 things to inspect:**
1. AGENTS.md
2. schema.prisma
3. middleware.ts
4. api/stripe/webhook/route.ts
5. accept-client.tsx

**First 5 things to test:**
1. pnpm build
2. pnpm dev + login
3. Create quote (dry run)
4. Visit /accept/[token]
5. /cs/amendments (will 404)

**Unsafe assumptions:** Docs may be stale; env vars undocumented; sidebar links to non-existent routes.

---

## Suggested Files to Save

The following files have been created in this handoff:

| File | Purpose |
|------|---------|
| `docs/handoff/agent_handoff_dossier.md` | Full handoff document (this file) |
| `docs/handoff/anthropic_agent_boot_prompt.md` | Copy-paste prompt for new agent |
| `docs/handoff/project_facts_ledger.md` | High-confidence facts |
| `docs/handoff/unsafe_assumptions_ledger.md` | Assumptions to verify |
| `docs/handoff/engineering_working_memory.md` | Tacit context and patterns |
