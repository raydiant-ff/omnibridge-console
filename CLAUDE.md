# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OmniBridge

OmniBridge is a SaaS billing and quoting platform that bridges Stripe (billing engine), Salesforce (CRM), and DocuSign (e-signature). It is an internal operations console — not a customer-facing product.

## Monorepo structure

pnpm 9.15.4 + Turborepo. Workspaces: `apps/*`, `packages/*`, `packages/integrations/*`.

| Package | Purpose |
|---|---|
| `apps/console` | Next.js 15 / React 19 app (Tailwind v4, Radix UI). The only app. |
| `packages/db` | Prisma ORM (PostgreSQL). Schema, migrations, seed. Generates client to `packages/db/generated/client`. |
| `packages/auth` | NextAuth v4 credentials provider (JWT strategy, no OAuth). Exports `authOptions`, `getServerSession()`, `requireSession()`. |
| `packages/ui` | Shared UI utility (`cn` helper). |
| `packages/integrations/stripe` | Stripe SDK wrapper. Lazy singleton via `getStripeClient()`. API version `2025-02-24.acacia`. |
| `packages/integrations/salesforce` | Salesforce JWT auth, SOQL executor, SObject CRUD. Token cached 90 min in-process. |
| `packages/integrations/docusign` | DocuSign eSignature JWT auth, envelope creation, Focused View embedded signing, signed PDF download. |

## Commands

```bash
pnpm dev                            # Start dev server (next dev --port 3000)
pnpm build                          # Build all (prisma generate + next build)
pnpm lint                           # Lint all packages
pnpm db:generate                    # Regenerate Prisma client
pnpm db:push                        # Push schema to DB (no migration file)
pnpm db:migrate                     # Create/run migration (prisma migrate dev)
pnpm db:migrate:deploy              # Deploy migrations (production)
pnpm db:seed                        # Seed database
pnpm db:studio                      # Open Prisma Studio
pnpm --filter @omnibridge/db lint   # Lint a single workspace package
pnpm clean                          # Remove build artifacts + node_modules
npx tsx scripts/<name>.ts           # Run one-off scripts (use apps/console/.env.local)
```

No test runner exists. Validation ladder: `pnpm lint` (fast) → `pnpm build` (type-checks) → manual verification in dev server.

## Architecture patterns

### Server actions (`apps/console/src/lib/actions/`)

All files start with `"use server"`. Every user-facing action follows this sequence:
1. `requireSession()` auth gate (from `@omnibridge/auth`)
2. Role check if needed (e.g. `role !== "admin"` → throw `"Forbidden"`)
3. Feature flag check (`flags.useMockStripe` etc.) — short-circuits with mock data when credentials are absent
4. Lazy dynamic imports for integration clients: `const { getStripeClient } = await import("@omnibridge/stripe")`
5. Try/catch around external API calls, returning `{ success: false, error }` — never throws to caller
6. Audit log write to `prisma.auditLog` with actor, action, target, requestId, payload
7. Salesforce timeline events fired without await (fire-and-forget with `.catch()`)

### Queries (`apps/console/src/lib/queries/`)

Also `"use server"`. Pattern:
- `requireSession()` at top
- Prisma queries with explicit `include`/`where`/`orderBy`
- Local `mapRow()` helpers convert `Date` → ISO strings for JSON-serializable return types
- External data (SF accounts) wrapped in `cached()` helper with revalidation
- `searchCustomersUnified()` fans out to Prisma + SF + Stripe in parallel, deduplicates results

### Feature flags (`apps/console/src/lib/feature-flags.ts`)

Three flags auto-activate when real credentials are missing, so the app runs fully with mock data in local dev:
- `flags.useMockStripe` — when `STRIPE_SECRET_KEY` is not set
- `flags.useMockSalesforce` — when `SF_CLIENT_ID` is not set
- `flags.useMockDocuSign` — when `DOCUSIGN_INTEGRATION_KEY` is not set

Env overrides: `USE_MOCK_STRIPE`, `USE_MOCK_SALESFORCE`, `USE_MOCK_DOCUSIGN` (`"true"`/`"false"`).

### Auth and middleware

NextAuth credentials provider only (email + bcrypt password, JWT strategy). Middleware protects all routes except: `/login`, `/accept/*`, `/api/auth/*`, `/api/stripe/webhook`, `/api/docusign/webhook`, `/api/checkout/*`, static assets.

### Routing (`apps/console/src/app/`)

- `(app)/` — authenticated route group: customers, opportunities, quotes (with multi-step wizard), subscriptions, products, coupons, CS renewals
- `accept/[token]/` — public quote acceptance pages (unauthenticated)
- `api/` — NextAuth handler, Stripe webhook (signature-verified), DocuSign webhook (HMAC-verified), checkout endpoints

## Domain rules

- **Stripe is the billing source of truth.** Salesforce is CRM context only. Never spread billing logic into CRM sync code.
- **Idempotency is critical.** Webhooks use `IdempotencyKey` and `ProductLog` for deduplication. Never create duplicate side effects from webhook replays.
- **`AuditLog.actorUserId` is nullable** — webhook/system actions use `null`, not fake user IDs.
- **`escapeSoql()`** from `@omnibridge/salesforce` must be used for any user-provided values in SOQL queries.
- **Quote acceptance** logic must stay consistent with downstream billing creation (subscription/schedule/invoice).
- **Prisma client output** is at `packages/db/generated/client` (custom output path for Vercel compatibility). The console build step runs `prisma generate` before `next build`.

## Environment variables

Stored in `apps/console/.env.local`. Key groups: Database (`DATABASE_URL`, `DIRECT_URL`), NextAuth (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`), Admin seed (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`), Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`), Salesforce (`SF_CLIENT_ID`, `SF_USERNAME`, `SF_PRIVATE_KEY_BASE64`, `SF_LOGIN_URL`), DocuSign (`DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_AUTH_SERVER`, `DOCUSIGN_RSA_PRIVATE_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_APP_URL`), App (`NEXT_PUBLIC_BASE_URL`).
