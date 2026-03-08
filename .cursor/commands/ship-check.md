Before proposing that something is ready:

1. Run `scripts/repo-status.sh`
2. Run `pnpm lint` (fast validation)
3. If the change touches types, schema, or build config, also run `pnpm build`
4. If the Prisma schema was modified, verify `pnpm db:generate` succeeds
5. Note: this repo has no test runner yet — type safety relies on `pnpm build` (next build)

Summarize:
- files changed
- validations run and their results
- anything not validated (and why)
- operational follow-ups needed:
  - new env vars (check `.env.example`)
  - Prisma migrations (`pnpm db:migrate`)
  - webhook registration changes
  - Salesforce metadata deployment
