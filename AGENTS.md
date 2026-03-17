# Omni Agent Operating Guide

Omni is a production SaaS platform centered on:
- Next.js / TypeScript (monorepo via pnpm + Turborepo)
- Stripe billing, quoting, subscriptions, invoicing
- Salesforce-backed CRM/account context
- DocuSign e-signature (Stripe PDF + Focused View embedded signing)
- strict production safety, idempotency, and auditability

## Repo structure

```
apps/console/          — Next.js 15 app (React 19, Tailwind, Radix UI)
packages/db/           — Prisma ORM, schema, migrations, seed
packages/auth/         — NextAuth credentials provider, JWT, roles
packages/ui/           — Shared UI utilities (cn)
packages/integrations/
  salesforce/          — Salesforce JWT auth, SOQL, CRUD
  stripe/              — Stripe client, webhook verification
  docusign/            — DocuSign eSignature REST API client (JWT auth, envelopes, Focused View)
scripts/               — Operational scripts (audits, backfills, CSM tools)
sf-metadata/           — Salesforce custom object/field metadata (sfdx)
```

## Core principles

1. Prefer safe, typed, incremental changes.
2. Never make broad architectural assumptions without checking the current codebase.
3. For non-trivial tasks, research first and produce a short plan before coding.
4. Keep changes scoped to the minimum relevant files.
5. Preserve billing correctness over convenience.
6. Preserve idempotency in webhooks, async jobs, and retryable flows.
7. Avoid duplicate business logic across quoting, checkout, subscriptions, invoices, and CRM sync.
8. Favor explicit logging and diagnosability in critical flows.
9. When editing existing code, preserve local conventions unless they are clearly harmful.
10. Do not silently weaken validation, auth, or financial controls.

## Domain priorities

### Billing domain
- Stripe is the billing engine.
- Do not create duplicate side effects from webhook replays.
- Treat invoice, quote, subscription, schedule, and payment transitions as auditable state changes.
- Any mutation affecting billing should make it easy to explain:
  - what triggered it
  - whether it is idempotent
  - whether it can be retried safely

### Salesforce domain
- Salesforce is a CRM/account context source, but avoid spreading billing source-of-truth logic into CRM sync code.
- Changes touching both Stripe and Salesforce should clearly document source-of-truth boundaries.
- SOQL queries must use the `escapeSoql()` utility for user-provided inputs.

### Quoting / checkout domain
- Quote acceptance logic must remain consistent with downstream billing creation.
- If a change affects quote acceptance, payment collection, invoicing, or subscription start dates, call that out explicitly.
- DocuSign handles e-signature via Focused View; Stripe generates the quote PDF. No template/merge logic needed.

## Required work style

For every substantial task:
1. identify relevant files
2. summarize current behavior
3. list assumptions
4. propose the smallest safe implementation path
5. only then edit code

For debugging:
1. reproduce or restate the failure
2. identify where the failure is observed
3. identify likely root-cause files
4. add or inspect instrumentation before speculative rewrites
5. confirm the fix with tests or explicit reproduction steps

## Repo hygiene

- Prefer narrow diffs over sweeping rewrites.
- Reuse existing utilities before introducing new abstractions.
- Avoid leaving TODOs unless explicitly requested.
- Do not change unrelated formatting in touched files.
- If a migration, env var, webhook, or operational change is required, state it explicitly.

## Terminal / CLI behavior

Before major edits, gather repo status:
- current branch
- changed files
- test/lint status if relevant
- recent commits if task needs context

After edits:
- run the smallest relevant validation first
- summarize what changed
- report any unverified assumptions or remaining risk

## Tooling

- **Package manager**: pnpm 9.15.4 (declared in `packageManager` field)
- **Monorepo orchestrator**: Turborepo v2 (`turbo.json`)
- **Workspaces**: `apps/*`, `packages/*`, `packages/integrations/*`
- **Test runner**: none -- no test framework or test files exist yet
- **Type checking**: performed implicitly by `pnpm build` (via `next build`)
- **Lint**: ESLint v8 with per-package `.eslintrc.js` files
- **One-off scripts**: run via `npx tsx scripts/<name>.ts` (load env from `apps/console/.env.local`)

## Key commands

```bash
pnpm dev                          # Start dev server (turbo → next dev --port 3000)
pnpm build                        # Build all packages (turbo → prisma generate + next build)
pnpm lint                         # Lint all packages (turbo → next lint + eslint src/)
pnpm db:generate                  # Regenerate Prisma client
pnpm db:push                      # Push schema to DB (no migration)
pnpm db:migrate                   # Run migrations (prisma migrate dev)
pnpm db:migrate:deploy            # Deploy migrations (production)
pnpm db:seed                      # Seed database
pnpm db:studio                    # Open Prisma Studio
pnpm --filter @omnibridge/db lint # Lint a single workspace package
pnpm clean                        # Remove all build artifacts and node_modules
```

### Validation priority

Since there is no test runner, the validation ladder is:
1. `pnpm lint` -- fast, catches ESLint issues
2. `pnpm build` -- slower, catches type errors and build failures
3. Manual verification in the running dev server

When a test runner is added, prefer `pnpm test` and add a `test` task to `turbo.json`.

## Delegation policy

- Architecture, high-risk design, and cross-domain reviews belong to the `omni-architect` subagent.
- Straightforward feature implementation belongs to the `omni-implementer` subagent.
- Reproduction, root-cause analysis, and failing test loops belong to the `omni-debugger` subagent.
- Repo scans, branch status, changed-files analysis, and "what is the current state?" tasks belong to the `omni-repo-auditor` subagent.
