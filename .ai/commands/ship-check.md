Before proposing that something is ready:

1. Run `scripts/repo-status.sh`
2. Run `pnpm lint` (fast validation)
3. If the change touches types, schema, or build config, also run `pnpm build`
4. If the Prisma schema was modified, verify `pnpm db:generate` succeeds
5. If shared barrels were touched, confirm every new export has a real non-local consumer or was removed before ship
6. If the UI exposes actions that imply persistence or external side effects, confirm they are wired end-to-end or explicitly disabled
7. If `.ai/rules/`, `.ai/agents/`, or `.ai/commands/` changed, call that out as a workflow-policy decision
8. Note: this repo has no test runner yet — type safety relies on `pnpm build` (next build)

Summarize:
- files changed
- validations run and their results
- anything not validated (and why)
- operational follow-ups needed:
  - new env vars (check `.env.example`)
  - Prisma migrations (`pnpm db:migrate`)
  - webhook registration changes
  - Salesforce metadata deployment
