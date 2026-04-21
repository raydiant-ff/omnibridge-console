# OmniBridge

OmniBridge is an internal SaaS billing and quoting platform that bridges:

- Stripe as the billing engine
- Salesforce as CRM/account context
- DocuSign for e-signature

This repo is a pnpm + Turborepo monorepo centered on a Next.js console app.

## Start here

- contributor architecture guide: `docs/golden-path.md`
- AI operating model: `docs/ai/operating-plan.md`
- recommended tool stack: `docs/ai/recommended-tool-stack.md`
- connector/setup checklist: `docs/tooling/connector-setup-checklist.md`
- Claude/Codex repo guidance: `CLAUDE.md`

## Recommended tool stack

Default team stance:

- keep local Codex-driven implementation as the primary coding lane
- keep `shadcn` as the UI primitive system
- keep Figma as the design source and code-linking layer
- optionally keep Cursor only if the editor itself or Bugbot is clearly useful
- skip Cursor cloud/background agents as a default workflow

Why:

- Omni's hard problems are billing correctness, webhook safety, auth, and source-of-truth boundaries
- those are best handled in the real repo with full local context
- cloud agents can be useful sidecars, but they are not the preferred default for this codebase

## Workspace hygiene

- `.ai/` is the repo-owned home for AI workflow rules, commands, agents, and handoffs
- `.claude/`, `.vercel/`, `.sfdx/`, and `.v0/` remain root-level because those tools expect their conventional folder locations
- local exports, spreadsheets, and backups belong under `artifacts/local/` and should stay ignored unless explicitly promoted into docs or metadata

## Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Validation ladder

This repo does not have a test runner yet.

Default validation order:

1. `pnpm lint`
2. `pnpm build`
3. manual verification in the running app
